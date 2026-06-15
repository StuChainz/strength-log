import { MIGRATIONS } from '@/db/migrations';
import { seedExercises, SEED_EXERCISE_METADATA, SEED_EXERCISES } from '@/db/seed/exercises';
import {
  archiveExercise,
  createExercise,
  getExerciseCount,
  getExerciseLibraryDiagnostics,
  getExercisesWithMetadata,
  searchExercises,
} from '@/db/repositories/exercises.repo';
import {
  archiveTemplate,
  createTemplate,
  getAllTemplates,
  getTemplateItemsWithExercise,
  updateTemplate,
} from '@/db/repositories/templates.repo';
import {
  createSession,
  discardSession,
  endSession,
  getInProgressSession,
  getSessionRecovery,
} from '@/db/repositories/sessions.repo';
import { insertEvent, getEventsBySession } from '@/db/repositories/events.repo';
import {
  getSetsBySession,
  insertSet,
  rebuildSets,
  softDeleteSet,
  updateSet,
} from '@/db/repositories/sets.repo';
import { updateSessionExerciseHistoryCache } from '@/db/repositories/history.repo';
import {
  detectAndInsertFinalPrsForSession,
  getFinalPRsBySession,
} from '@/db/repositories/prs.repo';
import { getWorkoutSummary } from '@/db/repositories/sessionSummary.repo';
import { exportDatabase } from '@/db/repositories/export.repo';
import { getSavedTags, savePostSessionDetails } from '@/db/repositories/tags.repo';
import { getProgressionSuggestion } from '@/domain/progression';
import { calculateEstimated1RM, detectLivePotentialPRs } from '@/domain/prs';
import { addRestTimerSeconds, getRestTimerRemainingSeconds } from '@/domain/restTimer';
import { SessionNoteSchema } from '@/domain/validation';
import { newId } from '@/domain/ids';
import type {
  EventType,
  Exercise,
  SetType,
  Unit,
  WorkoutSession,
  WorkoutSet,
} from '@/domain/types';
import type { SetAddedPayload, SetDeletedPayload, SetEditedPayload } from '@/domain/events';

type SqlParam = string | number | null;

interface StatementSync {
  all: (...params: SqlParam[]) => Record<string, unknown>[];
  get: (...params: SqlParam[]) => Record<string, unknown> | undefined;
  run: (...params: SqlParam[]) => { changes: number; lastInsertRowid: number | bigint };
}

interface DatabaseSyncInstance {
  close: () => void;
  exec: (sql: string) => void;
  prepare: (sql: string) => StatementSync;
}

interface SqliteModule {
  DatabaseSync: new (location: string) => DatabaseSyncInstance;
}

interface ExpoLikeDb {
  closeAsync: () => Promise<void>;
  execAsync: (sql: string) => Promise<void>;
  getAllAsync: <T>(sql: string, params?: SqlParam[]) => Promise<T[]>;
  getFirstAsync: <T>(sql: string, params?: SqlParam[]) => Promise<T | null>;
  runAsync: (
    sql: string,
    params?: SqlParam[],
  ) => Promise<{ changes: number; lastInsertRowId: number }>;
  withTransactionAsync: (task: () => Promise<void>) => Promise<void>;
}

const { DatabaseSync } = jest.requireActual<SqliteModule>('node:sqlite');

function createSqliteDb(): ExpoLikeDb {
  const native = new DatabaseSync(':memory:');

  return {
    closeAsync: async () => native.close(),
    execAsync: async (sql) => native.exec(sql),
    getAllAsync: async <T>(sql: string, params: SqlParam[] = []) =>
      native.prepare(sql).all(...params) as T[],
    getFirstAsync: async <T>(sql: string, params: SqlParam[] = []) =>
      (native.prepare(sql).get(...params) as T | undefined) ?? null,
    runAsync: async (sql, params: SqlParam[] = []) => {
      const result = native.prepare(sql).run(...params);
      return {
        changes: result.changes,
        lastInsertRowId: Number(result.lastInsertRowid),
      };
    },
    withTransactionAsync: async (task) => {
      native.exec('BEGIN');
      try {
        await task();
        native.exec('COMMIT');
      } catch (error) {
        native.exec('ROLLBACK');
        throw error;
      }
    },
  };
}

async function applyMigrationsAndSeed(db: ExpoLikeDb): Promise<void> {
  await db.execAsync(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );
  `);

  for (const migration of MIGRATIONS) {
    const row = await db.getFirstAsync<{ name: string }>(
      'SELECT name FROM _migrations WHERE name = ?',
      [migration.name],
    );
    if (row) continue;
    await db.execAsync(migration.sql);
    await db.runAsync('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)', [
      migration.name,
      Date.now(),
    ]);
  }

  await seedExercises(db as never);
}

async function setupDb(): Promise<ExpoLikeDb> {
  const db = createSqliteDb();
  await applyMigrationsAndSeed(db);
  return db;
}

async function exerciseByName(db: ExpoLikeDb, name: string): Promise<Exercise> {
  const exercise = await db.getFirstAsync<Exercise>('SELECT * FROM exercises WHERE name = ?', [
    name,
  ]);
  if (!exercise) throw new Error(`Missing exercise fixture: ${name}`);
  return exercise;
}

async function appendEvent(
  db: ExpoLikeDb,
  sessionId: string,
  eventType: EventType,
  payload: unknown,
  clientEventId = newId(),
): Promise<void> {
  await insertEvent(db as never, {
    id: newId(),
    session_id: sessionId,
    event_type: eventType,
    payload_json: JSON.stringify(payload),
    client_event_id: clientEventId,
  });
}

async function appendSet(
  db: ExpoLikeDb,
  session: WorkoutSession,
  input: {
    exerciseId: string;
    position: number;
    weight: number | null;
    reps: number | null;
    rpe?: number | null;
    unit?: Unit;
    setType?: SetType;
    source?: 'tap' | 'voice';
    loggedAt?: number;
    setId?: string;
    clientSetId?: string;
    clientEventId?: string;
  },
): Promise<WorkoutSet> {
  const setId = input.setId ?? newId();
  const clientSetId = input.clientSetId ?? newId();
  const loggedAt = input.loggedAt ?? Date.now();
  const setType = input.setType ?? 'working';
  const isWarmup: 0 | 1 = setType === 'warmup' ? 1 : 0;
  const payload: SetAddedPayload = {
    set_id: setId,
    exercise_id: input.exerciseId,
    position: input.position,
    weight: input.weight,
    reps: input.reps,
    rpe: input.rpe ?? null,
    unit: input.unit ?? 'kg',
    is_warmup: isWarmup,
    set_type: setType,
    logged_at: loggedAt,
    source: input.source ?? 'tap',
    client_set_id: clientSetId,
  };

  await db.withTransactionAsync(async () => {
    await appendEvent(db, session.id, 'set_added', payload, input.clientEventId);
    await insertSet(db as never, {
      id: setId,
      session_id: session.id,
      exercise_id: input.exerciseId,
      position: input.position,
      weight: input.weight,
      reps: input.reps,
      rpe: input.rpe ?? null,
      unit: input.unit ?? 'kg',
      is_warmup: isWarmup,
      set_type: setType,
      logged_at: loggedAt,
      source: input.source ?? 'tap',
      client_set_id: clientSetId,
    });
  });

  return {
    id: setId,
    session_id: session.id,
    exercise_id: input.exerciseId,
    position: input.position,
    weight: input.weight,
    reps: input.reps,
    rpe: input.rpe ?? null,
    unit: input.unit ?? 'kg',
    is_warmup: isWarmup,
    set_type: setType,
    logged_at: loggedAt,
    source: input.source ?? 'tap',
    client_set_id: clientSetId,
    deleted_at: null,
  };
}

async function editSetWithEvent(
  db: ExpoLikeDb,
  sessionId: string,
  setId: string,
  fields: Partial<Pick<WorkoutSet, 'weight' | 'reps' | 'rpe' | 'unit' | 'set_type'>>,
): Promise<void> {
  const payload: SetEditedPayload = { set_id: setId, ...fields };
  await db.withTransactionAsync(async () => {
    await appendEvent(db, sessionId, 'set_edited', payload);
    await updateSet(db as never, setId, fields);
  });
}

async function deleteSetWithEvent(
  db: ExpoLikeDb,
  sessionId: string,
  setId: string,
  deletedAt = Date.now(),
): Promise<void> {
  const payload: SetDeletedPayload = { set_id: setId };
  await db.withTransactionAsync(async () => {
    await appendEvent(db, sessionId, 'set_deleted', payload);
    await softDeleteSet(db as never, setId, deletedAt);
  });
}

describe('beta bug-hunt repository flows', () => {
  let db: ExpoLikeDb | null;
  let nowMs: number;
  let dateNowSpy: jest.SpyInstance<number, []>;

  beforeEach(() => {
    nowMs = 1_800_000_000_000;
    dateNowSpy = jest.spyOn(Date, 'now').mockImplementation(() => {
      nowMs += 1;
      return nowMs;
    });
  });

  afterEach(async () => {
    await db?.closeAsync();
    db = null;
    dateNowSpy.mockRestore();
  });

  it('fresh install migrations seed the library, filters, aliases, custom rows, archive hiding, and reseed path', async () => {
    db = await setupDb();

    expect(await getExerciseCount(db as never)).toBe(SEED_EXERCISES.length);
    expect(await getExerciseLibraryDiagnostics(db as never)).toEqual({
      total: SEED_EXERCISES.length,
      seed: SEED_EXERCISES.length,
      custom: 0,
      metadata: SEED_EXERCISE_METADATA.length,
    });

    const migrationRows = await db.getAllAsync<{ name: string }>(
      'SELECT name FROM _migrations ORDER BY name ASC',
    );
    expect(migrationRows.map((row) => row.name)).toEqual(
      MIGRATIONS.map((migration) => migration.name),
    );

    for (const forceType of ['push', 'pull', 'legs', 'hinge', 'core'] as const) {
      const rows = await getExercisesWithMetadata(db as never, { force_type: forceType });
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((row) => row.metadata?.force_type === forceType)).toBe(true);
    }

    expect(await searchExercises(db as never, 'bench')).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'Barbell Bench Press' })]),
    );
    expect(await searchExercises(db as never, 'dl')).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'Barbell Deadlift' })]),
    );

    const custom = await createExercise(db as never, {
      name: 'Beta Carry',
      category: 'other',
      primary_muscle: null,
      default_unit: null,
    });
    expect(await getExercisesWithMetadata(db as never, { custom: true })).toEqual([
      expect.objectContaining({ id: custom.id, metadata: null }),
    ]);

    await archiveExercise(db as never, custom.id);
    expect((await getExercisesWithMetadata(db as never)).some((row) => row.id === custom.id)).toBe(
      false,
    );

    await db.execAsync(`
      DROP TABLE IF EXISTS app_settings;
      DROP TABLE IF EXISTS weekly_insight_cards;
      DROP TABLE IF EXISTS metric_samples;
      DROP TABLE IF EXISTS session_notes;
      DROP TABLE IF EXISTS post_session_tags;
      DROP TABLE IF EXISTS exercise_history_cache;
      DROP TABLE IF EXISTS issue_checkins;
      DROP TABLE IF EXISTS issue_routines;
      DROP TABLE IF EXISTS issue_exercise_links;
      DROP TABLE IF EXISTS exercise_issue_events;
      DROP TABLE IF EXISTS issues;
      DROP TABLE IF EXISTS exercise_prs;
      DROP TABLE IF EXISTS workout_sets;
      DROP TABLE IF EXISTS workout_events;
      DROP TABLE IF EXISTS workout_sessions;
      DROP TABLE IF EXISTS template_items;
      DROP TABLE IF EXISTS templates;
      DROP TABLE IF EXISTS exercise_metadata;
      DROP TABLE IF EXISTS exercise_aliases;
      DROP TABLE IF EXISTS exercises;
      DROP TABLE IF EXISTS users;
      DROP TABLE IF EXISTS _migrations;
    `);
    await applyMigrationsAndSeed(db);

    expect(await getExerciseCount(db as never)).toBe(SEED_EXERCISES.length);
    expect(await searchExercises(db as never, 'dl')).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'Barbell Deadlift' })]),
    );
  });

  it('creates, edits, reorders, validates, and archives templates without deleting workout history', async () => {
    db = await setupDb();
    const bench = await exerciseByName(db, 'Barbell Bench Press');
    const squat = await exerciseByName(db, 'Barbell Back Squat');

    const template = await createTemplate(db as never, {
      name: 'Beta Full Body',
      notes: 'friend beta',
      items: [
        {
          exercise_id: bench.id,
          target_sets: 3,
          target_reps: 5,
          target_weight: 80,
          target_rpe: 8,
          rest_seconds: 90,
          progression_rule: 'linear',
          increment_kg: 2.5,
          increment_lb: null,
          rep_range_min: null,
          rep_range_max: null,
          rpe_cap: null,
        },
        {
          exercise_id: squat.id,
          target_sets: 3,
          target_reps: 8,
          target_weight: 100,
          target_rpe: null,
          rest_seconds: 120,
          progression_rule: 'double',
          increment_kg: 5,
          increment_lb: null,
          rep_range_min: 8,
          rep_range_max: 12,
          rpe_cap: null,
        },
      ],
    });

    await updateTemplate(db as never, template.id, {
      name: 'Beta Full Body Edited',
      notes: null,
      items: [
        {
          exercise_id: squat.id,
          target_sets: 3,
          target_reps: 8,
          target_weight: 100,
          target_rpe: null,
          rest_seconds: 120,
          progression_rule: 'double',
          increment_kg: 5,
          increment_lb: null,
          rep_range_min: 8,
          rep_range_max: 12,
          rpe_cap: null,
        },
        {
          exercise_id: bench.id,
          target_sets: 3,
          target_reps: 5,
          target_weight: 82.5,
          target_rpe: 8,
          rest_seconds: 90,
          progression_rule: 'rpe_gated',
          increment_kg: 2.5,
          increment_lb: null,
          rep_range_min: null,
          rep_range_max: null,
          rpe_cap: 8.5,
        },
      ],
    });

    expect(await getTemplateItemsWithExercise(db as never, template.id)).toEqual([
      expect.objectContaining({
        exercise_id: squat.id,
        position: 0,
        rest_seconds: 120,
        progression_rule: 'double',
        rep_range_min: 8,
        rep_range_max: 12,
      }),
      expect.objectContaining({
        exercise_id: bench.id,
        position: 1,
        rest_seconds: 90,
        progression_rule: 'rpe_gated',
        rpe_cap: 8.5,
      }),
    ]);
    expect(
      await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) AS count FROM template_items WHERE template_id = ?',
        [template.id],
      ),
    ).toEqual({ count: 2 });

    await expect(
      createTemplate(db as never, {
        name: 'Invalid beta template',
        notes: null,
        items: [
          {
            exercise_id: bench.id,
            target_sets: null,
            target_reps: null,
            target_weight: null,
            target_rpe: null,
            rest_seconds: -30,
            progression_rule: 'linear',
            increment_kg: -2.5,
            increment_lb: null,
            rep_range_min: null,
            rep_range_max: null,
            rpe_cap: null,
          },
        ],
      }),
    ).rejects.toThrow(/rest_seconds|increment_kg/);

    const session = await createSession(db as never, {
      templateId: template.id,
      name: 'Archive history',
    });
    await appendSet(db, session, { exerciseId: bench.id, position: 0, weight: 80, reps: 5 });
    await endSession(db as never, session.id, 400);
    await updateSessionExerciseHistoryCache(db as never, session.id);
    await archiveTemplate(db as never, template.id);

    expect(await getAllTemplates(db as never)).toEqual([]);
    expect(await getWorkoutSummary(db as never, session.id)).toEqual(
      expect.objectContaining({
        session: expect.objectContaining({ template_id: template.id, status: 'completed' }),
        setCount: 1,
        volume: 400,
      }),
    );
  });

  it('logs a live workout path with set types, edits, delete, undo, finish, and idempotency', async () => {
    db = await setupDb();
    const bench = await exerciseByName(db, 'Barbell Bench Press');
    const session = await createSession(db as never, { templateId: null, name: 'Beta logging' });

    const warmup = await appendSet(db, session, {
      exerciseId: bench.id,
      position: 0,
      weight: 40,
      reps: 8,
      setType: 'warmup',
      clientSetId: 'warmup-client-set',
      clientEventId: 'warmup-client-event',
      loggedAt: 10_000,
    });
    await appendSet(db, session, {
      exerciseId: bench.id,
      position: 0,
      weight: 40,
      reps: 8,
      setType: 'warmup',
      setId: warmup.id,
      clientSetId: 'warmup-client-set',
      clientEventId: 'warmup-client-event',
      loggedAt: 10_000,
    });
    const working = await appendSet(db, session, {
      exerciseId: bench.id,
      position: 1,
      weight: 80,
      reps: 5,
      rpe: 8,
      setType: 'working',
      loggedAt: 20_000,
    });
    const drop = await appendSet(db, session, {
      exerciseId: bench.id,
      position: 2,
      weight: 60,
      reps: 10,
      rpe: 9,
      setType: 'drop',
      loggedAt: 30_000,
    });

    await editSetWithEvent(db, session.id, working.id, {
      weight: 82.5,
      reps: 4,
      rpe: 8.5,
      set_type: 'drop',
    });
    await deleteSetWithEvent(db, session.id, drop.id, 40_000);
    await deleteSetWithEvent(db, session.id, working.id, 50_000);
    await endSession(db as never, session.id, 320);

    expect(
      await db.getAllAsync<WorkoutSet>(
        'SELECT * FROM workout_sets WHERE session_id = ? ORDER BY position ASC',
        [session.id],
      ),
    ).toEqual([
      expect.objectContaining({ id: warmup.id, set_type: 'warmup', deleted_at: null }),
      expect.objectContaining({ id: working.id, set_type: 'drop', deleted_at: 50_000 }),
      expect.objectContaining({ id: drop.id, set_type: 'drop', deleted_at: 40_000 }),
    ]);
    expect(await getSetsBySession(db as never, session.id)).toEqual([
      expect.objectContaining({ id: warmup.id, set_type: 'warmup' }),
    ]);

    const events = await getEventsBySession(db as never, session.id);
    expect(events.map((event) => event.event_type)).toEqual([
      'session_started',
      'set_added',
      'set_added',
      'set_added',
      'set_edited',
      'set_deleted',
      'set_deleted',
      'session_ended',
    ]);
    expect(events.filter((event) => event.client_event_id === 'warmup-client-event')).toHaveLength(
      1,
    );
    expect(
      await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) AS count FROM workout_sets WHERE client_set_id = ?',
        ['warmup-client-set'],
      ),
    ).toEqual({ count: 1 });
  });

  it('rebuilds event logs safely across old payloads, edits, deletes, rest events, and repeated recovery', async () => {
    db = await setupDb();
    const bench = await exerciseByName(db, 'Barbell Bench Press');
    const session = await createSession(db as never, { templateId: null, name: 'Event rebuild' });
    const setId = newId();

    await appendEvent(db, session.id, 'set_added', {
      set_id: setId,
      exercise_id: bench.id,
      position: 0,
      weight: 75,
      reps: 5,
      rpe: null,
      unit: 'kg',
      is_warmup: 0,
      logged_at: 100,
      source: 'tap',
      client_set_id: 'old-client-set',
    });
    await appendEvent(db, session.id, 'rest_timer_started', {
      duration_seconds: 90,
      started_at: 110,
      exercise_id: bench.id,
    });
    await appendEvent(db, session.id, 'set_edited', {
      set_id: setId,
      weight: 77.5,
      reps: 6,
      set_type: 'drop',
    });
    await appendEvent(db, session.id, 'set_deleted', { set_id: setId });

    await rebuildSets(db as never, session.id);
    await rebuildSets(db as never, session.id);

    expect(
      await db.getAllAsync<WorkoutSet>('SELECT * FROM workout_sets WHERE session_id = ?', [
        session.id,
      ]),
    ).toEqual([
      expect.objectContaining({
        id: setId,
        weight: 77.5,
        reps: 6,
        set_type: 'drop',
        deleted_at: expect.any(Number),
      }),
    ]);
    expect(await getSetsBySession(db as never, session.id)).toEqual([]);
  });

  it('detects stale sessions and prevents new duplicate active sessions without losing data', async () => {
    db = await setupDb();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const bench = await exerciseByName(db, 'Barbell Bench Press');
    const stale = await createSession(db as never, { templateId: null, name: 'Stale active' });
    await db.runAsync('UPDATE workout_sessions SET started_at = ?, updated_at = ? WHERE id = ?', [
      Date.now() - 13 * 60 * 60 * 1000,
      Date.now() - 13 * 60 * 60 * 1000,
      stale.id,
    ]);
    await appendSet(db, stale, { exerciseId: bench.id, position: 0, weight: 80, reps: 5 });

    expect((await getInProgressSession(db as never))?.id).toBe(stale.id);
    await expect(getSessionRecovery(db as never)).resolves.toEqual(
      expect.objectContaining({ status: 'stale', session: expect.objectContaining({ id: stale.id }) }),
    );

    await expect(
      createSession(db as never, { templateId: null, name: 'Newest active' }),
    ).rejects.toThrow();
    expect(
      await db.getFirstAsync<{ status: string }>(
        'SELECT status FROM workout_sessions WHERE id = ?',
        [stale.id],
      ),
    ).toEqual({ status: 'in_progress' });
    expect(await getSetsBySession(db as never, stale.id)).toEqual([
      expect.objectContaining({ exercise_id: bench.id, weight: 80, reps: 5 }),
    ]);

    await discardSession(db as never, stale.id);
    expect(
      (await getEventsBySession(db as never, stale.id)).map((event) => event.event_type),
    ).toEqual(['session_started', 'set_added', 'session_discarded']);
    expect(await getInProgressSession(db as never)).toBeNull();

    warnSpy.mockRestore();
  });

  it('keeps rest timers out of set mutations and restores countdown math safely', async () => {
    db = await setupDb();
    const bench = await exerciseByName(db, 'Barbell Bench Press');
    const session = await createSession(db as never, { templateId: null, name: 'Rest timers' });

    await appendEvent(db, session.id, 'rest_timer_started', {
      duration_seconds: 90,
      started_at: 1_000,
      exercise_id: bench.id,
    });
    await appendEvent(db, session.id, 'rest_timer_cancelled', { cancelled_at: 2_000 });
    await rebuildSets(db as never, session.id);

    expect(await getSetsBySession(db as never, session.id)).toEqual([]);
    expect(getRestTimerRemainingSeconds({ durationSeconds: 90, startedAt: 1_000 }, 31_000)).toBe(
      60,
    );
    expect(addRestTimerSeconds({ durationSeconds: 60, startedAt: 1_000 }, 15)).toEqual({
      durationSeconds: 75,
      startedAt: 1_000,
    });
    expect(addRestTimerSeconds({ durationSeconds: 10, startedAt: 1_000 }, -15)).toEqual({
      durationSeconds: 1,
      startedAt: 1_000,
    });
  });

  it('keeps progression suggestions opt-in and ignores stale history until current evidence exists', () => {
    const suggestion = getProgressionSuggestion({
      exercise: {
        category: 'barbell',
        movementPattern: 'squat',
        bodyRegion: 'lower_body',
        mechanics: 'compound',
        equipment: ['barbell'],
      },
      templateTarget: { targetSets: 3, targetReps: 5, targetWeight: 100, unit: 'kg' },
      progressionRule: { rule: 'linear' },
      recentSets: [],
      previousSessionSets: [{ weight: 100, reps: 3, rpe: 9, unit: 'kg', set_type: 'working' }],
    });

    expect(suggestion).toEqual(
      expect.objectContaining({
        source: 'template_rule',
        reason: 'Repeat target',
        weight: 100,
        reps: 5,
      }),
    );

    const linearNext = getProgressionSuggestion({
      exercise: {
        category: 'barbell',
        movementPattern: 'hinge',
        bodyRegion: 'lower_body',
        mechanics: 'compound',
        equipment: ['barbell'],
      },
      templateTarget: { targetSets: 1, targetReps: 5, targetWeight: 120, unit: 'kg' },
      progressionRule: { rule: 'linear' },
      recentSets: [{ weight: 120, reps: 5, rpe: 8, unit: 'kg', set_type: 'working' }],
    });

    expect(linearNext).toEqual(expect.objectContaining({ weight: 125, reps: 5 }));
  });

  it('final PR processing excludes warmups and deleted sets, includes drop sets, and stays idempotent', async () => {
    db = await setupDb();
    const bench = await exerciseByName(db, 'Barbell Bench Press');
    const baseline = await createSession(db as never, { templateId: null, name: 'Baseline PR' });
    await appendSet(db, baseline, { exerciseId: bench.id, position: 0, weight: 80, reps: 5 });
    await endSession(db as never, baseline.id, 400);
    await detectAndInsertFinalPrsForSession(db as never, baseline.id);

    const weaker = await createSession(db as never, { templateId: null, name: 'Weaker PR' });
    await appendSet(db, weaker, { exerciseId: bench.id, position: 0, weight: 75, reps: 5 });
    await endSession(db as never, weaker.id, 375);
    await detectAndInsertFinalPrsForSession(db as never, weaker.id);
    expect(await getFinalPRsBySession(db as never, weaker.id)).toEqual([]);

    const stronger = await createSession(db as never, { templateId: null, name: 'Stronger PR' });
    await appendSet(db, stronger, {
      exerciseId: bench.id,
      position: 0,
      weight: 120,
      reps: 5,
      setType: 'warmup',
    });
    const deleted = await appendSet(db, stronger, {
      exerciseId: bench.id,
      position: 1,
      weight: 130,
      reps: 5,
    });
    await deleteSetWithEvent(db, stronger.id, deleted.id);
    const drop = await appendSet(db, stronger, {
      exerciseId: bench.id,
      position: 2,
      weight: 85,
      reps: 11,
      setType: 'drop',
    });
    await endSession(db as never, stronger.id, 935);
    await detectAndInsertFinalPrsForSession(db as never, stronger.id);
    await detectAndInsertFinalPrsForSession(db as never, stronger.id);

    const prs = await getFinalPRsBySession(db as never, stronger.id);
    expect(prs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          record_type: 'rep_max',
          set_id: drop.id,
          reps: 11,
          weight: 85,
        }),
        expect.objectContaining({ record_type: 'session_volume', value: 935 }),
      ]),
    );
    expect(prs.some((pr) => pr.set_id === deleted.id)).toBe(false);
    expect(prs.some((pr) => pr.record_type === 'estimated_1rm' && pr.set_id === drop.id)).toBe(
      false,
    );
    expect(calculateEstimated1RM(85, 11)).toBeNull();

    expect(
      detectLivePotentialPRs(await getSetsBySession(db as never, stronger.id), {
        repMaxes: [{ exerciseId: bench.id, reps: 11, weight: 85 }],
        estimated1RMs: [],
        sessionVolumes: [{ exerciseId: bench.id, value: 935 }],
      }),
    ).toEqual([]);
  });

  it('ends workouts, saves replaceable tags, enforces note limits, and exports optional sparse data', async () => {
    db = await setupDb();
    const bench = await exerciseByName(db, 'Barbell Bench Press');
    const session = await createSession(db as never, { templateId: null, name: 'Tags export' });
    await appendSet(db, session, { exerciseId: bench.id, position: 0, weight: 100, reps: 5 });
    await endSession(db as never, session.id, 500);
    await detectAndInsertFinalPrsForSession(db as never, session.id);

    const summary = await getWorkoutSummary(db as never, session.id);
    expect(summary).toEqual(
      expect.objectContaining({
        session: expect.objectContaining({ status: 'completed' }),
        setCount: 1,
        volume: 500,
        prCount: 3,
      }),
    );
    expect(SessionNoteSchema.safeParse({ energy_rating: 7, note: 'x'.repeat(280) }).success).toBe(
      true,
    );
    expect(SessionNoteSchema.safeParse({ energy_rating: 7, note: 'x'.repeat(281) }).success).toBe(
      false,
    );

    await savePostSessionDetails(db as never, {
      sessionId: session.id,
      tags: ['felt_strong', 'evening_session'],
      energyRating: 8,
      note: 'Good beta run',
      metrics: {
        volume: 500,
        durationMin: summary?.durationMin ?? 0,
        setCount: 1,
        sampledAt: summary?.session.ended_at ?? 1,
      },
    });
    await savePostSessionDetails(db as never, {
      sessionId: session.id,
      tags: ['sore'],
      energyRating: 6,
      note: null,
      metrics: {
        volume: 500,
        durationMin: summary?.durationMin ?? 0,
        setCount: 1,
        sampledAt: summary?.session.ended_at ?? 1,
      },
    });

    expect(await getSavedTags(db as never, session.id)).toEqual(['sore']);

    await db.runAsync('DELETE FROM exercise_metadata WHERE exercise_id = ?', [bench.id]);
    const exported = await exportDatabase(db as never);
    expect(exported.tables.workout_sessions).toEqual([
      expect.objectContaining({ id: session.id, status: 'completed' }),
    ]);
    expect(exported.tables.exercise_metadata.length).toBe(SEED_EXERCISE_METADATA.length - 1);
    expect(exported.tables.session_notes).toEqual([
      expect.objectContaining({ session_id: session.id, energy_rating: 6, note: null }),
    ]);
  });
});
