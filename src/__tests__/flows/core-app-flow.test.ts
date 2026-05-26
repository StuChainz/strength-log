import { MIGRATIONS } from '@/db/migrations';
import { seedExercises, SEED_EXERCISES, SEED_EXERCISE_METADATA } from '@/db/seed/exercises';
import {
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
  getTemplateById,
  getTemplateItemsWithExercise,
  updateTemplate,
} from '@/db/repositories/templates.repo';
import { createSession, endSession, getInProgressSession } from '@/db/repositories/sessions.repo';
import { insertEvent, getEventsBySession } from '@/db/repositories/events.repo';
import {
  getSetsBySession,
  insertSet,
  rebuildSets,
  softDeleteSet,
  updateSet,
} from '@/db/repositories/sets.repo';
import {
  getExerciseHistory,
  updateSessionExerciseHistoryCache,
} from '@/db/repositories/history.repo';
import { getWorkoutSummary } from '@/db/repositories/sessionSummary.repo';
import {
  detectAndInsertFinalPrsForSession,
  getFinalPRsBySession,
} from '@/db/repositories/prs.repo';
import { getSavedTags, savePostSessionDetails, SESSION_TAGS } from '@/db/repositories/tags.repo';
import { maybeGenerateWeeklyInsight } from '@/db/repositories/insights.repo';
import { exportDatabase } from '@/db/repositories/export.repo';
import { EXPORT_TABLES } from '@/export/schema';
import { getProgressionSuggestion } from '@/domain/progression';
import { estimateOneRepMax } from '@/domain/volume';
import { newId } from '@/domain/ids';
import { PostSessionTagSchema } from '@/domain/validation';
import { parseVoiceCommand } from '@/voice/parser';
import type { SetAddedPayload, SetDeletedPayload, SetEditedPayload } from '@/domain/events';
import type {
  EventType,
  Exercise,
  SetType,
  Unit,
  WorkoutSession,
  WorkoutSet,
} from '@/domain/types';

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

async function setupDb(): Promise<ExpoLikeDb> {
  const db = createSqliteDb();
  await db.execAsync(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );
  `);
  for (const migration of MIGRATIONS) {
    await db.execAsync(migration.sql);
    await db.runAsync('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)', [
      migration.name,
      Date.now(),
    ]);
  }
  await seedExercises(db as never);
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

async function createCompletedSession(
  db: ExpoLikeDb,
  startedAt: number,
  volume: number,
  tags: string[] = [],
): Promise<string> {
  const id = newId();
  const endedAt = startedAt + 45 * 60_000;
  await db.runAsync(
    `INSERT INTO workout_sessions
       (id, template_id, name, status, started_at, ended_at, total_volume_cached, created_at, updated_at)
     VALUES (?, NULL, ?, 'completed', ?, ?, ?, ?, ?)`,
    [id, 'fixture', startedAt, endedAt, volume, startedAt, endedAt],
  );
  for (const tag of tags) {
    await db.runAsync(
      'INSERT INTO post_session_tags (id, session_id, tag, created_at) VALUES (?, ?, ?, ?)',
      [newId(), id, tag, endedAt],
    );
  }
  return id;
}

describe('core app flow repository acceptance', () => {
  let db: ExpoLikeDb;
  let nowMs: number;
  let dateNowSpy: jest.SpyInstance<number, []>;

  beforeEach(() => {
    nowMs = 1_700_000_000_000;
    dateNowSpy = jest.spyOn(Date, 'now').mockImplementation(() => {
      nowMs += 1;
      return nowMs;
    });
  });

  afterEach(async () => {
    await db?.closeAsync();
    dateNowSpy.mockRestore();
  });

  it('seeds the exercise library and keeps custom exercises visible without metadata', async () => {
    db = await setupDb();

    expect(await getExerciseCount(db as never)).toBe(SEED_EXERCISES.length);
    expect(await getExerciseLibraryDiagnostics(db as never)).toEqual({
      total: SEED_EXERCISES.length,
      seed: SEED_EXERCISES.length,
      custom: 0,
      metadata: SEED_EXERCISE_METADATA.length,
    });

    const custom = await createExercise(db as never, {
      name: 'Garage Sled Push',
      category: 'other',
      primary_muscle: null,
      default_unit: null,
    });
    const libraryRows = await getExercisesWithMetadata(db as never);
    expect(libraryRows.find((exercise) => exercise.id === custom.id)).toEqual(
      expect.objectContaining({ name: 'Garage Sled Push', metadata: null }),
    );

    const customRows = await getExercisesWithMetadata(db as never, { custom: true });
    expect(customRows.map((exercise) => exercise.id)).toEqual([custom.id]);

    await expect(searchExercises(db as never, 'bench')).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Barbell Bench Press' }),
        expect.objectContaining({ name: 'Dumbbell Bench Press' }),
      ]),
    );
    await expect(searchExercises(db as never, 'dl')).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'Barbell Deadlift' })]),
    );

    for (const forceType of ['push', 'pull', 'legs', 'hinge', 'core'] as const) {
      const rows = await getExercisesWithMetadata(db as never, { force_type: forceType });
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((exercise) => exercise.metadata?.force_type === forceType)).toBe(true);
    }
  });

  it('persists template items in order and archives templates without deleting rows', async () => {
    db = await setupDb();
    const bench = await exerciseByName(db, 'Barbell Bench Press');
    const squat = await exerciseByName(db, 'Barbell Back Squat');

    const template = await createTemplate(db as never, {
      name: 'Core acceptance template',
      notes: 'Repository flow',
      items: [
        {
          exercise_id: bench.id,
          target_sets: 3,
          target_reps: 5,
          target_weight: 80,
          target_rpe: 8,
          rest_seconds: 90,
        },
        {
          exercise_id: squat.id,
          target_sets: 4,
          target_reps: 5,
          target_weight: 100,
          target_rpe: 8,
          rest_seconds: null,
        },
      ],
    });

    expect(await getTemplateById(db as never, template.id)).toEqual(
      expect.objectContaining({ name: 'Core acceptance template', notes: 'Repository flow' }),
    );
    expect(await getTemplateItemsWithExercise(db as never, template.id)).toEqual([
      expect.objectContaining({
        exercise_id: bench.id,
        position: 0,
        target_reps: 5,
        rest_seconds: 90,
      }),
      expect.objectContaining({ exercise_id: squat.id, position: 1, target_weight: 100 }),
    ]);

    await archiveTemplate(db as never, template.id);

    expect(await getAllTemplates(db as never)).toEqual([]);
    expect(await getTemplateById(db as never, template.id)).toEqual(
      expect.objectContaining({ archived_at: expect.any(Number) }),
    );
  });

  it('keeps template rest_seconds nullable, persistent, and positive', async () => {
    db = await setupDb();
    const bench = await exerciseByName(db, 'Barbell Bench Press');

    const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(template_items)');
    expect(columns).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'rest_seconds' })]),
    );

    const template = await createTemplate(db as never, {
      name: 'Rest template',
      notes: null,
      items: [
        {
          exercise_id: bench.id,
          target_sets: null,
          target_reps: null,
          target_weight: null,
          target_rpe: null,
          rest_seconds: 90,
        },
      ],
    });

    expect(await getTemplateItemsWithExercise(db as never, template.id)).toEqual([
      expect.objectContaining({ exercise_id: bench.id, rest_seconds: 90 }),
    ]);

    await updateTemplate(db as never, template.id, {
      name: 'Rest template',
      notes: null,
      items: [
        {
          exercise_id: bench.id,
          target_sets: null,
          target_reps: null,
          target_weight: null,
          target_rpe: null,
          rest_seconds: null,
        },
      ],
    });

    expect(await getTemplateItemsWithExercise(db as never, template.id)).toEqual([
      expect.objectContaining({ exercise_id: bench.id, rest_seconds: null }),
    ]);

    await expect(
      createTemplate(db as never, {
        name: 'Invalid rest template',
        notes: null,
        items: [
          {
            exercise_id: bench.id,
            target_sets: null,
            target_reps: null,
            target_weight: null,
            target_rpe: null,
            rest_seconds: 0,
          },
        ],
      }),
    ).rejects.toThrow('rest_seconds must be a positive integer when set');
  });

  it('persists and reloads template progression fields', async () => {
    db = await setupDb();
    const bench = await exerciseByName(db, 'Barbell Bench Press');

    const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(template_items)');
    expect(columns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'progression_rule' }),
        expect.objectContaining({ name: 'increment_kg' }),
        expect.objectContaining({ name: 'increment_lb' }),
        expect.objectContaining({ name: 'rep_range_min' }),
        expect.objectContaining({ name: 'rep_range_max' }),
        expect.objectContaining({ name: 'rpe_cap' }),
      ]),
    );

    const template = await createTemplate(db as never, {
      name: 'Progression template',
      notes: null,
      items: [
        {
          exercise_id: bench.id,
          target_sets: 3,
          target_reps: 5,
          target_weight: 80,
          target_rpe: null,
          rest_seconds: null,
          progression_rule: 'linear',
          increment_kg: 2.5,
          increment_lb: null,
          rep_range_min: null,
          rep_range_max: null,
          rpe_cap: null,
        },
      ],
    });

    expect(await getTemplateItemsWithExercise(db as never, template.id)).toEqual([
      expect.objectContaining({
        exercise_id: bench.id,
        progression_rule: 'linear',
        increment_kg: 2.5,
        increment_lb: null,
        rep_range_min: null,
        rep_range_max: null,
        rpe_cap: null,
        exercise_movement_pattern: 'horizontal_push',
        exercise_mechanics: 'compound',
      }),
    ]);

    await updateTemplate(db as never, template.id, {
      name: 'Progression template',
      notes: null,
      items: [
        {
          exercise_id: bench.id,
          target_sets: 3,
          target_reps: null,
          target_weight: 20,
          target_rpe: null,
          rest_seconds: null,
          progression_rule: 'double',
          increment_kg: 2.5,
          increment_lb: null,
          rep_range_min: 8,
          rep_range_max: 12,
          rpe_cap: null,
        },
      ],
    });

    expect(await getTemplateItemsWithExercise(db as never, template.id)).toEqual([
      expect.objectContaining({
        progression_rule: 'double',
        rep_range_min: 8,
        rep_range_max: 12,
      }),
    ]);
  });

  it('loads old-style template item inputs as progression none', async () => {
    db = await setupDb();
    const bench = await exerciseByName(db, 'Barbell Bench Press');

    const template = await createTemplate(db as never, {
      name: 'Old template',
      notes: null,
      items: [
        {
          exercise_id: bench.id,
          target_sets: null,
          target_reps: null,
          target_weight: null,
          target_rpe: null,
          rest_seconds: null,
        },
      ],
    });

    expect(await getTemplateItemsWithExercise(db as never, template.id)).toEqual([
      expect.objectContaining({
        progression_rule: 'none',
        increment_kg: null,
        rep_range_min: null,
        rpe_cap: null,
      }),
    ]);
  });

  it('rejects invalid template progression ranges and RPE caps', async () => {
    db = await setupDb();
    const bench = await exerciseByName(db, 'Barbell Bench Press');
    const baseItem = {
      exercise_id: bench.id,
      target_sets: 3,
      target_reps: 8,
      target_weight: 20,
      target_rpe: null,
      rest_seconds: null,
      increment_kg: null,
      increment_lb: null,
    };

    await expect(
      createTemplate(db as never, {
        name: 'Bad double',
        notes: null,
        items: [
          {
            ...baseItem,
            progression_rule: 'double',
            rep_range_min: 12,
            rep_range_max: 8,
            rpe_cap: null,
          },
        ],
      }),
    ).rejects.toThrow('rep_range_min must be less than or equal to rep_range_max');

    await expect(
      createTemplate(db as never, {
        name: 'Bad RPE',
        notes: null,
        items: [
          {
            ...baseItem,
            progression_rule: 'rpe_gated',
            rep_range_min: null,
            rep_range_max: null,
            rpe_cap: 11,
          },
        ],
      }),
    ).rejects.toThrow('rpe_cap must be between 1 and 10 when set');
  });

  it('adds set_type to workout_sets with a working default', async () => {
    db = await setupDb();

    const columns = await db.getAllAsync<{ name: string; dflt_value: string | null }>(
      'PRAGMA table_info(workout_sets)',
    );

    expect(columns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'set_type', dflt_value: "'working'" }),
      ]),
    );
  });

  it('adds the exercise_prs table with an idempotency key', async () => {
    db = await setupDb();

    const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(exercise_prs)');
    const indexes = await db.getAllAsync<{ name: string }>('PRAGMA index_list(exercise_prs)');

    expect(columns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'record_key' }),
        expect.objectContaining({ name: 'record_type' }),
        expect.objectContaining({ name: 'achieved_at' }),
      ]),
    );
    expect(indexes.map((index) => index.name)).toEqual(
      expect.arrayContaining([
        'idx_exercise_prs_exercise_id',
        'idx_exercise_prs_session_id',
        'idx_exercise_prs_record_type',
        'idx_exercise_prs_achieved_at',
      ]),
    );
  });

  it('starts, logs, edits, deletes, undoes, and rebuilds workout sets from append-only events', async () => {
    db = await setupDb();
    const bench = await exerciseByName(db, 'Barbell Bench Press');
    const session = await createSession(db as never, { templateId: null, name: 'Acceptance loop' });

    const first = await appendSet(db, session, {
      exerciseId: bench.id,
      position: 0,
      weight: 80,
      reps: 5,
      clientSetId: 'client-set-one',
      clientEventId: 'client-event-one',
      loggedAt: 10_000,
    });
    await appendEvent(
      db,
      session.id,
      'set_added',
      {
        set_id: first.id,
        exercise_id: bench.id,
        position: 0,
        weight: 80,
        reps: 5,
        rpe: null,
        unit: 'kg',
        is_warmup: 0,
        set_type: 'working',
        logged_at: 10_000,
        source: 'tap',
        client_set_id: 'client-set-one',
      },
      'client-event-one',
    );
    await insertSet(db as never, {
      id: first.id,
      session_id: session.id,
      exercise_id: bench.id,
      position: 0,
      weight: 80,
      reps: 5,
      rpe: null,
      unit: 'kg',
      is_warmup: 0,
      set_type: 'working',
      logged_at: 10_000,
      source: 'tap',
      client_set_id: 'client-set-one',
    });

    const second = await appendSet(db, session, {
      exerciseId: bench.id,
      position: 1,
      weight: 82.5,
      reps: 5,
      rpe: 8,
      loggedAt: 20_000,
    });
    expect(await getSetsBySession(db as never, session.id)).toHaveLength(2);

    const eventsAfterAdds = await getEventsBySession(db as never, session.id);
    const firstSetAddedPayload = JSON.parse(
      eventsAfterAdds.find((event) => event.event_type === 'set_added')?.payload_json ?? '{}',
    ) as SetAddedPayload;
    expect(firstSetAddedPayload.set_type).toBe('working');

    await editSetWithEvent(db, session.id, first.id, {
      weight: 85,
      reps: 4,
      rpe: 8.5,
      set_type: 'drop',
    });
    expect(await getSetsBySession(db as never, session.id)).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: first.id, set_type: 'drop' })]),
    );
    await deleteSetWithEvent(db, session.id, second.id, 30_000);
    await deleteSetWithEvent(db, session.id, first.id, 40_000);

    expect(await getSetsBySession(db as never, session.id)).toEqual([]);
    const materialized = await db.getAllAsync<WorkoutSet>(
      'SELECT * FROM workout_sets WHERE session_id = ? ORDER BY position ASC',
      [session.id],
    );
    expect(materialized).toEqual([
      expect.objectContaining({
        id: first.id,
        weight: 85,
        reps: 4,
        set_type: 'drop',
        deleted_at: 40_000,
      }),
      expect.objectContaining({ id: second.id, weight: 82.5, reps: 5, deleted_at: 30_000 }),
    ]);

    const eventsBeforeRebuild = await getEventsBySession(db as never, session.id);
    expect(eventsBeforeRebuild.map((event) => event.event_type)).toEqual([
      'session_started',
      'set_added',
      'set_added',
      'set_edited',
      'set_deleted',
      'set_deleted',
    ]);

    await db.runAsync('DELETE FROM workout_sets WHERE session_id = ?', [session.id]);
    await rebuildSets(db as never, session.id);
    await rebuildSets(db as never, session.id);

    expect(
      await db.getAllAsync<WorkoutSet>('SELECT * FROM workout_sets WHERE session_id = ?', [
        session.id,
      ]),
    ).toHaveLength(2);
    expect(await getSetsBySession(db as never, session.id)).toEqual([]);
    expect(await getEventsBySession(db as never, session.id)).toHaveLength(
      eventsBeforeRebuild.length,
    );
  });

  it('keeps rest timer events append-only and out of workout set rebuilds', async () => {
    db = await setupDb();
    const bench = await exerciseByName(db, 'Barbell Bench Press');
    const session = await createSession(db as never, { templateId: null, name: null });

    await appendEvent(db, session.id, 'rest_timer_started', {
      duration_seconds: 90,
      started_at: 10_000,
      exercise_id: bench.id,
    });
    await appendEvent(db, session.id, 'rest_timer_cancelled', { cancelled_at: 20_000 });
    await appendEvent(db, session.id, 'rest_timer_completed', { completed_at: 30_000 });

    expect(
      (await getEventsBySession(db as never, session.id)).map((event) => event.event_type),
    ).toEqual([
      'session_started',
      'rest_timer_started',
      'rest_timer_cancelled',
      'rest_timer_completed',
    ]);

    await rebuildSets(db as never, session.id);
    expect(await getSetsBySession(db as never, session.id)).toEqual([]);
  });

  it('recovers an in-progress workout and avoids duplicate materialized sets after restart rebuilds', async () => {
    db = await setupDb();
    const bench = await exerciseByName(db, 'Barbell Bench Press');
    const squat = await exerciseByName(db, 'Barbell Back Squat');
    const session = await createSession(db as never, { templateId: null, name: null });

    await appendSet(db, session, {
      exerciseId: bench.id,
      position: 0,
      weight: 80,
      reps: 5,
      loggedAt: 100,
    });
    await appendSet(db, session, {
      exerciseId: squat.id,
      position: 1,
      weight: 100,
      reps: 3,
      loggedAt: 200,
    });

    await db.runAsync('DELETE FROM workout_sets WHERE session_id = ?', [session.id]);
    expect((await getInProgressSession(db as never))?.id).toBe(session.id);

    await rebuildSets(db as never, session.id);
    await rebuildSets(db as never, session.id);

    expect(await getSetsBySession(db as never, session.id)).toEqual([
      expect.objectContaining({ exercise_id: bench.id, weight: 80, reps: 5 }),
      expect.objectContaining({ exercise_id: squat.id, weight: 100, reps: 3 }),
    ]);
  });

  it('returns the newest in-progress session without discarding older session data', async () => {
    db = await setupDb();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const older = await createSession(db as never, { templateId: null, name: 'Older active' });
    const newest = await createSession(db as never, { templateId: null, name: 'Newest active' });

    expect((await getInProgressSession(db as never))?.id).toBe(newest.id);
    expect(
      await db.getAllAsync<WorkoutSession>(
        "SELECT * FROM workout_sessions WHERE status = 'in_progress' ORDER BY started_at DESC",
      ),
    ).toEqual([
      expect.objectContaining({ id: newest.id, status: 'in_progress' }),
      expect.objectContaining({ id: older.id, status: 'in_progress' }),
    ]);
    expect(warnSpy).toHaveBeenCalledWith(
      '[sessions] Multiple in-progress sessions found; leaving older sessions intact',
      { keptSessionId: newest.id, olderSessionIds: [older.id] },
    );

    warnSpy.mockRestore();
  });

  it('rebuilds old set_added events without set_type as working sets', async () => {
    db = await setupDb();
    const bench = await exerciseByName(db, 'Barbell Bench Press');
    const session = await createSession(db as never, { templateId: null, name: null });
    const setId = newId();

    await appendEvent(db, session.id, 'set_added', {
      set_id: setId,
      exercise_id: bench.id,
      position: 0,
      weight: 40,
      reps: 8,
      rpe: null,
      unit: 'kg',
      is_warmup: 0,
      logged_at: 100,
      source: 'tap',
      client_set_id: 'old-client-set',
    });

    await rebuildSets(db as never, session.id);

    expect(await getSetsBySession(db as never, session.id)).toEqual([
      expect.objectContaining({ id: setId, set_type: 'working', is_warmup: 0 }),
    ]);
  });

  it('persists warm-up and drop sets in materialized workout_sets', async () => {
    db = await setupDb();
    const bench = await exerciseByName(db, 'Barbell Bench Press');
    const session = await createSession(db as never, { templateId: null, name: null });

    await appendSet(db, session, {
      exerciseId: bench.id,
      position: 0,
      weight: 20,
      reps: 8,
      setType: 'warmup',
    });
    await appendSet(db, session, {
      exerciseId: bench.id,
      position: 1,
      weight: 60,
      reps: 8,
      setType: 'drop',
    });

    expect(await getSetsBySession(db as never, session.id)).toEqual([
      expect.objectContaining({ set_type: 'warmup', is_warmup: 1 }),
      expect.objectContaining({ set_type: 'drop', is_warmup: 0 }),
    ]);
  });

  it('ends workouts, caches summary volume, updates history, and keeps suggestions opt-in', async () => {
    db = await setupDb();
    const bench = await exerciseByName(db, 'Barbell Bench Press');
    const highRepCustom = await createExercise(db as never, {
      name: 'High Rep Test Move',
      category: 'other',
      primary_muscle: null,
      default_unit: 'kg',
    });

    const session = await createSession(db as never, { templateId: null, name: 'Completed' });
    await appendSet(db, session, {
      exerciseId: bench.id,
      position: 0,
      weight: 100,
      reps: 5,
      loggedAt: 1_000,
    });
    await appendSet(db, session, {
      exerciseId: bench.id,
      position: 1,
      weight: 80,
      reps: 12,
      loggedAt: 2_000,
    });

    await endSession(db as never, session.id, 1_460);
    await updateSessionExerciseHistoryCache(db as never, session.id);

    expect(await getWorkoutSummary(db as never, session.id)).toEqual(
      expect.objectContaining({ setCount: 2, volume: 1_460 }),
    );
    expect(await getExerciseHistory(db as never, bench.id, 5)).toEqual([
      expect.objectContaining({
        sessionId: session.id,
        volume: 1_460,
        topSetWeight: 100,
        topSetReps: 5,
        est1rm: estimateOneRepMax(100, 5),
      }),
    ]);
    expect(
      await db.getFirstAsync('SELECT * FROM exercise_history_cache WHERE exercise_id = ?', [
        bench.id,
      ]),
    ).toEqual(expect.objectContaining({ last_session_id: session.id }));

    const highRepSession = await createSession(db as never, {
      templateId: null,
      name: 'High reps',
    });
    await appendSet(db, highRepSession, {
      exerciseId: highRepCustom.id,
      position: 0,
      weight: 50,
      reps: 12,
    });
    await endSession(db as never, highRepSession.id, 600);
    expect((await getExerciseHistory(db as never, highRepCustom.id, 1))[0]).toEqual(
      expect.objectContaining({ est1rm: null }),
    );

    const suggestion = getProgressionSuggestion({
      exercise: {
        category: bench.category,
        movementPattern: 'horizontal_push',
        bodyRegion: 'upper_body',
        mechanics: 'compound',
        equipment: ['barbell'],
      },
      templateTarget: {
        targetSets: null,
        targetReps: 5,
        targetWeight: null,
        unit: 'kg',
      },
      progressionRule: { rule: 'none' },
      recentSets: [{ weight: 100, reps: 5, rpe: 7, unit: 'kg', set_type: 'working' }],
    });
    expect(suggestion).toEqual(expect.objectContaining({ weight: 102.5, reps: 5 }));
    expect(await getSetsBySession(db as never, session.id)).toEqual(
      expect.arrayContaining([expect.objectContaining({ weight: 100, reps: 5 })]),
    );
  });

  it('creates final PR records at workout end and reprocessing is idempotent', async () => {
    db = await setupDb();
    const bench = await exerciseByName(db, 'Barbell Bench Press');
    const session = await createSession(db as never, { templateId: null, name: 'First PRs' });

    await appendSet(db, session, {
      exerciseId: bench.id,
      position: 0,
      weight: 20,
      reps: 8,
      setType: 'warmup',
    });
    await appendSet(db, session, {
      exerciseId: bench.id,
      position: 1,
      weight: 80,
      reps: 5,
    });

    expect(await getFinalPRsBySession(db as never, session.id)).toEqual([]);

    await endSession(db as never, session.id, 1_060);
    await updateSessionExerciseHistoryCache(db as never, session.id);
    await detectAndInsertFinalPrsForSession(db as never, session.id);
    await detectAndInsertFinalPrsForSession(db as never, session.id);

    const prs = await getFinalPRsBySession(db as never, session.id);
    expect(prs).toHaveLength(3);
    expect(prs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ record_type: 'rep_max', reps: 5, weight: 80 }),
        expect.objectContaining({ record_type: 'estimated_1rm', value: estimateOneRepMax(80, 5) }),
        expect.objectContaining({ record_type: 'session_volume', value: 400 }),
      ]),
    );
    expect(await getWorkoutSummary(db as never, session.id)).toEqual(
      expect.objectContaining({ prCount: 3, prs: expect.arrayContaining(prs) }),
    );
  });

  it('does not append duplicate end events when endSession is called twice', async () => {
    db = await setupDb();
    const session = await createSession(db as never, { templateId: null, name: 'Double end' });

    await endSession(db as never, session.id, 0);
    await endSession(db as never, session.id, 0);

    expect(
      (await getEventsBySession(db as never, session.id)).filter(
        (event) => event.event_type === 'session_ended',
      ),
    ).toHaveLength(1);
    expect(
      await db.getFirstAsync<WorkoutSession>('SELECT * FROM workout_sessions WHERE id = ?', [
        session.id,
      ]),
    ).toEqual(expect.objectContaining({ status: 'completed' }));
  });

  it('compares final PRs against completed sessions only and ignores invalid current sets', async () => {
    db = await setupDb();
    const bench = await exerciseByName(db, 'Barbell Bench Press');

    const baseline = await createSession(db as never, { templateId: null, name: 'Baseline' });
    await appendSet(db, baseline, {
      exerciseId: bench.id,
      position: 0,
      weight: 80,
      reps: 5,
    });
    await endSession(db as never, baseline.id, 400);
    await detectAndInsertFinalPrsForSession(db as never, baseline.id);

    const inProgress = await createSession(db as never, {
      templateId: null,
      name: 'Ignore active',
    });
    await appendSet(db, inProgress, {
      exerciseId: bench.id,
      position: 0,
      weight: 120,
      reps: 5,
    });

    const discarded = await createSession(db as never, {
      templateId: null,
      name: 'Ignore discarded',
    });
    await appendSet(db, discarded, {
      exerciseId: bench.id,
      position: 0,
      weight: 130,
      reps: 5,
    });
    await db.runAsync(
      "UPDATE workout_sessions SET status = 'discarded', ended_at = ?, updated_at = ? WHERE id = ?",
      [Date.now(), Date.now(), discarded.id],
    );

    const weaker = await createSession(db as never, { templateId: null, name: 'Weaker' });
    await appendSet(db, weaker, {
      exerciseId: bench.id,
      position: 0,
      weight: 75,
      reps: 5,
    });
    await endSession(db as never, weaker.id, 375);
    await detectAndInsertFinalPrsForSession(db as never, weaker.id);
    expect(await getFinalPRsBySession(db as never, weaker.id)).toEqual([]);

    const warmupOnly = await createSession(db as never, { templateId: null, name: 'Warmups' });
    await appendSet(db, warmupOnly, {
      exerciseId: bench.id,
      position: 0,
      weight: 140,
      reps: 5,
      setType: 'warmup',
    });
    await endSession(db as never, warmupOnly.id, 700);
    await detectAndInsertFinalPrsForSession(db as never, warmupOnly.id);
    expect(await getFinalPRsBySession(db as never, warmupOnly.id)).toEqual([]);

    const stronger = await createSession(db as never, { templateId: null, name: 'Stronger' });
    const deleted = await appendSet(db, stronger, {
      exerciseId: bench.id,
      position: 0,
      weight: 200,
      reps: 5,
    });
    await deleteSetWithEvent(db, stronger.id, deleted.id);
    await appendSet(db, stronger, {
      exerciseId: bench.id,
      position: 1,
      weight: 85,
      reps: 5,
      setType: 'drop',
    });
    await appendSet(db, stronger, {
      exerciseId: bench.id,
      position: 2,
      weight: 60,
      reps: 10,
      setType: 'working',
    });
    await endSession(db as never, stronger.id, 1_025);
    await detectAndInsertFinalPrsForSession(db as never, stronger.id);

    const strongerPrs = await getFinalPRsBySession(db as never, stronger.id);
    expect(strongerPrs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          record_type: 'rep_max',
          set_id: expect.not.stringMatching(deleted.id),
          reps: 5,
        }),
        expect.objectContaining({ record_type: 'estimated_1rm', weight: 85 }),
        expect.objectContaining({ record_type: 'session_volume', value: 1_025 }),
      ]),
    );
    expect(strongerPrs.some((pr) => pr.set_id === deleted.id)).toBe(false);
  });

  it('saves post-session tags, notes, metric samples, and replaces prior fixed tags', async () => {
    db = await setupDb();
    const session = await createSession(db as never, { templateId: null, name: 'Post tags' });
    await endSession(db as never, session.id, 900);
    const ended = await db.getFirstAsync<{ ended_at: number }>(
      'SELECT ended_at FROM workout_sessions WHERE id = ?',
      [session.id],
    );
    const sampledAt = ended?.ended_at ?? 1;

    await savePostSessionDetails(db as never, {
      sessionId: session.id,
      tags: ['evening_session', 'felt_strong'],
      energyRating: 8,
      note: 'x'.repeat(280),
      metrics: { volume: 900, durationMin: 45, setCount: 3, sampledAt },
    });
    expect(await getSavedTags(db as never, session.id)).toEqual(['evening_session', 'felt_strong']);

    await savePostSessionDetails(db as never, {
      sessionId: session.id,
      tags: ['sore'],
      energyRating: 6,
      note: 'Changed',
      metrics: { volume: 900, durationMin: 45, setCount: 3, sampledAt },
    });

    expect(await getSavedTags(db as never, session.id)).toEqual(['sore']);
    expect(
      await db.getFirstAsync('SELECT * FROM session_notes WHERE session_id = ?', [session.id]),
    ).toEqual(expect.objectContaining({ energy_rating: 6, note: 'Changed' }));
    const metricKeys = (
      await db.getAllAsync<{ metric_key: string }>(
        'SELECT metric_key FROM metric_samples WHERE sampled_at = ? ORDER BY metric_key ASC',
        [sampledAt],
      )
    ).map((row) => row.metric_key);
    expect(metricKeys).toEqual([
      'energy_rating',
      'session_duration_min',
      'session_set_count',
      'session_volume',
      'tag.sore',
    ]);
    expect(SESSION_TAGS).toContain('sore');
    expect(PostSessionTagSchema.safeParse('custom_tag').success).toBe(false);
  });

  it('generates weekly insights only when thresholds are met and uses cautious copy', async () => {
    db = await setupDb();
    const sundayEvening = new Date(2026, 4, 24, 20).getTime();

    expect(await maybeGenerateWeeklyInsight(db as never, sundayEvening)).toBeNull();

    for (let index = 0; index < 4; index += 1) {
      await createCompletedSession(
        db,
        sundayEvening - (index + 1) * 24 * 60 * 60 * 1000,
        120 + index * 2,
        ['evening_session'],
      );
      await createCompletedSession(
        db,
        sundayEvening - (index + 8) * 24 * 60 * 60 * 1000,
        100 + index * 2,
      );
    }

    const card = await maybeGenerateWeeklyInsight(db as never, sundayEvening);
    const secondRun = await maybeGenerateWeeklyInsight(db as never, sundayEvening);

    expect(secondRun?.id).toBe(card?.id);
    expect(card).toEqual(expect.objectContaining({ sample_size: 8 }));
    expect(card?.body).toContain('across 8 workouts');
    expect(card?.body).toContain('Sample:');
    expect(card?.body).toContain('Confidence:');
    expect(card?.body).not.toMatch(/\b(caused|causes|proves|should|must|definitely)\b/i);
    expect(
      await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) AS count FROM weekly_insight_cards',
      ),
    ).toEqual({ count: 1 });
  });

  it('exports representative local tables and does not crash on custom exercises missing metadata', async () => {
    db = await setupDb();
    const custom = await createExercise(db as never, {
      name: 'No Metadata Carry',
      category: 'other',
      primary_muscle: null,
      default_unit: null,
    });
    const bench = await exerciseByName(db, 'Barbell Bench Press');
    const template = await createTemplate(db as never, {
      name: 'Export template',
      notes: null,
      items: [
        {
          exercise_id: custom.id,
          target_sets: 2,
          target_reps: 10,
          target_weight: null,
          target_rpe: null,
          rest_seconds: null,
        },
      ],
    });
    const session = await createSession(db as never, { templateId: template.id, name: 'Export' });
    await appendSet(db, session, { exerciseId: custom.id, position: 0, weight: null, reps: 10 });
    await appendSet(db, session, { exerciseId: bench.id, position: 1, weight: 90, reps: 5 });
    await endSession(db as never, session.id, 450);
    await updateSessionExerciseHistoryCache(db as never, session.id);
    await detectAndInsertFinalPrsForSession(db as never, session.id);
    await savePostSessionDetails(db as never, {
      sessionId: session.id,
      tags: ['felt_strong'],
      energyRating: 9,
      note: 'Export covered',
      metrics: { volume: 450, durationMin: 30, setCount: 2, sampledAt: Date.now() },
    });

    const exported = await exportDatabase(db as never);

    expect(Object.keys(exported.tables).sort()).toEqual([...EXPORT_TABLES].sort());
    expect(exported.tables.exercise_metadata.length).toBe(SEED_EXERCISE_METADATA.length);
    expect(exported.tables.exercises).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: custom.id, name: 'No Metadata Carry' }),
      ]),
    );
    expect(exported.tables.template_items).toEqual([
      expect.objectContaining({ template_id: template.id, exercise_id: custom.id }),
    ]);
    expect(exported.tables.workout_events.length).toBeGreaterThanOrEqual(3);
    expect(exported.tables.workout_sets).toHaveLength(2);
    expect(exported.tables.exercise_prs).toEqual(
      expect.arrayContaining([expect.objectContaining({ session_id: session.id })]),
    );
    expect(exported.tables.post_session_tags).toEqual([
      expect.objectContaining({ session_id: session.id, tag: 'felt_strong' }),
    ]);
    expect(exported.tables.session_notes).toEqual([
      expect.objectContaining({ session_id: session.id, energy_rating: 9 }),
    ]);
    expect(exported.tables.metric_samples.length).toBeGreaterThanOrEqual(5);
    expect(exported.tables.exercise_history_cache.length).toBeGreaterThan(0);
  });
});

describe('core app flow parser and platform guardrails', () => {
  it('parses supported typed voice commands into workout intents', () => {
    const parsed = parseVoiceCommand('bench 80 for 5', {
      activeExerciseId: 'bench',
      defaultUnit: 'kg',
      now: 100,
      exercises: [{ id: 'bench', normalizedName: 'bench press', aliases: ['bench'] }],
      lastSet: null,
    });

    expect(parsed).toEqual(
      expect.objectContaining({
        intent: 'log_set',
        args: expect.objectContaining({ exerciseId: 'bench', weight: 80, reps: 5, unit: 'kg' }),
      }),
    );
  });

  it('documents that the web database client is a non-persistent mock, not native SQLite', async () => {
    const webClient = jest.requireActual<typeof import('@/db/client.web')>('@/db/client.web');
    const webDb = await webClient.openDb();

    expect(await webDb.getAllAsync('SELECT * FROM exercises')).toEqual([]);
    await expect(webClient.resetLocalData()).resolves.toBeUndefined();
  });
});
