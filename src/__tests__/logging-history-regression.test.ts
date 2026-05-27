import { MIGRATIONS } from '@/db/migrations';
import { insertEvent, getEventsBySession } from '@/db/repositories/events.repo';
import {
  getExerciseHistory,
  updateExerciseHistoryCache,
  updateSessionExerciseHistoryCache,
} from '@/db/repositories/history.repo';
import { createSession, discardSession, endSession } from '@/db/repositories/sessions.repo';
import {
  getSetsBySession,
  insertSet,
  rebuildSets,
  softDeleteSet,
  updateSet,
} from '@/db/repositories/sets.repo';
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

async function applyMigrations(db: ExpoLikeDb): Promise<void> {
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
}

async function setupDb(): Promise<ExpoLikeDb> {
  const db = createSqliteDb();
  await applyMigrations(db);
  return db;
}

async function createExercise(
  db: ExpoLikeDb,
  input: Partial<Pick<Exercise, 'id' | 'name' | 'category' | 'default_unit'>> = {},
): Promise<Exercise> {
  const id = input.id ?? newId();
  const name = input.name ?? `Exercise ${id.slice(-6)}`;
  const now = Date.now();
  const exercise: Exercise = {
    id,
    name,
    normalized_name: name.toLowerCase(),
    category: input.category ?? 'barbell',
    primary_muscle: null,
    default_unit: input.default_unit ?? 'kg',
    is_custom: 1,
    archived_at: null,
    created_at: now,
    updated_at: now,
  };

  await db.runAsync(
    `INSERT INTO exercises
       (id, name, normalized_name, category, primary_muscle, default_unit,
        is_custom, archived_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      exercise.id,
      exercise.name,
      exercise.normalized_name,
      exercise.category,
      exercise.primary_muscle,
      exercise.default_unit,
      exercise.is_custom,
      exercise.archived_at,
      exercise.created_at,
      exercise.updated_at,
    ],
  );

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

async function setSessionStartedAt(
  db: ExpoLikeDb,
  sessionId: string,
  startedAt: number,
): Promise<void> {
  await db.runAsync('UPDATE workout_sessions SET started_at = ?, created_at = ? WHERE id = ?', [
    startedAt,
    startedAt,
    sessionId,
  ]);
}

describe('logging and history regression coverage', () => {
  let db: ExpoLikeDb | null;
  let nowMs: number;
  let dateNowSpy: jest.SpyInstance<number, []>;

  beforeEach(() => {
    db = null;
    nowMs = 1_900_000_000_000;
    dateNowSpy = jest.spyOn(Date, 'now').mockImplementation(() => {
      nowMs += 1;
      return nowMs;
    });
  });

  afterEach(async () => {
    await db?.closeAsync();
    dateNowSpy.mockRestore();
  });

  it('stores a logged set and its append-only event with matching ids and payload data', async () => {
    db = await setupDb();
    const bench = await createExercise(db, { name: 'Bench Press' });
    const session = await createSession(db as never, { templateId: null, name: 'Logging' });

    const set = await appendSet(db, session, {
      exerciseId: bench.id,
      position: 0,
      weight: 100,
      reps: 5,
      rpe: 8,
      unit: 'kg',
      setType: 'working',
      source: 'voice',
      loggedAt: 1234,
      clientSetId: 'client-set-1',
      clientEventId: 'client-event-1',
    });

    expect(await getSetsBySession(db as never, session.id)).toEqual([
      expect.objectContaining({
        id: set.id,
        exercise_id: bench.id,
        weight: 100,
        reps: 5,
        rpe: 8,
        source: 'voice',
        client_set_id: 'client-set-1',
      }),
    ]);

    const events = await getEventsBySession(db as never, session.id);
    const payload = JSON.parse(events[1].payload_json) as SetAddedPayload;
    expect(events.map((event) => event.event_type)).toEqual(['session_started', 'set_added']);
    expect(payload).toEqual(
      expect.objectContaining({ set_id: set.id, client_set_id: 'client-set-1' }),
    );
  });

  it('keeps set and event writes idempotent when client ids are retried', async () => {
    db = await setupDb();
    const bench = await createExercise(db);
    const session = await createSession(db as never, { templateId: null, name: 'Retry' });
    const setId = newId();

    await appendSet(db, session, {
      exerciseId: bench.id,
      position: 0,
      weight: 80,
      reps: 8,
      setId,
      clientSetId: 'retry-set',
      clientEventId: 'retry-event',
    });
    await appendSet(db, session, {
      exerciseId: bench.id,
      position: 0,
      weight: 80,
      reps: 8,
      setId,
      clientSetId: 'retry-set',
      clientEventId: 'retry-event',
    });

    expect(
      await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) AS count FROM workout_sets WHERE client_set_id = ?',
        ['retry-set'],
      ),
    ).toEqual({ count: 1 });
    expect(
      (await getEventsBySession(db as never, session.id)).filter(
        (event) => event.client_event_id === 'retry-event',
      ),
    ).toHaveLength(1);
  });

  it('updates every editable set field and keeps set_type synchronized with is_warmup', async () => {
    db = await setupDb();
    const bench = await createExercise(db);
    const session = await createSession(db as never, { templateId: null, name: 'Edit' });
    const set = await appendSet(db, session, {
      exerciseId: bench.id,
      position: 0,
      weight: 60,
      reps: 10,
      rpe: null,
      unit: 'kg',
    });

    await editSetWithEvent(db, session.id, set.id, {
      weight: 135,
      reps: 6,
      rpe: 7.5,
      unit: 'lb',
      set_type: 'warmup',
    });

    expect(await getSetsBySession(db as never, session.id)).toEqual([
      expect.objectContaining({
        id: set.id,
        weight: 135,
        reps: 6,
        rpe: 7.5,
        unit: 'lb',
        set_type: 'warmup',
        is_warmup: 1,
      }),
    ]);
  });

  it('soft deletes sets without removing their audit rows', async () => {
    db = await setupDb();
    const bench = await createExercise(db);
    const session = await createSession(db as never, { templateId: null, name: 'Delete' });
    const deleted = await appendSet(db, session, {
      exerciseId: bench.id,
      position: 0,
      weight: 75,
      reps: 5,
    });
    const kept = await appendSet(db, session, {
      exerciseId: bench.id,
      position: 1,
      weight: 80,
      reps: 5,
    });

    await deleteSetWithEvent(db, session.id, deleted.id, 555);

    expect(await getSetsBySession(db as never, session.id)).toEqual([
      expect.objectContaining({ id: kept.id }),
    ]);
    expect(
      await db.getAllAsync<WorkoutSet>(
        'SELECT * FROM workout_sets WHERE session_id = ? ORDER BY position ASC',
        [session.id],
      ),
    ).toEqual([
      expect.objectContaining({ id: deleted.id, deleted_at: 555 }),
      expect.objectContaining({ id: kept.id, deleted_at: null }),
    ]);
  });

  it('rebuilds missing materialized sets from the event log', async () => {
    db = await setupDb();
    const bench = await createExercise(db);
    const session = await createSession(db as never, { templateId: null, name: 'Rebuild missing' });
    const set = await appendSet(db, session, {
      exerciseId: bench.id,
      position: 0,
      weight: 90,
      reps: 4,
      clientSetId: 'rebuild-set',
    });
    await db.runAsync('DELETE FROM workout_sets WHERE id = ?', [set.id]);

    await rebuildSets(db as never, session.id);

    expect(await getSetsBySession(db as never, session.id)).toEqual([
      expect.objectContaining({ id: set.id, weight: 90, reps: 4, client_set_id: 'rebuild-set' }),
    ]);
  });

  it('rebuilds corrupted materialized sets back to the append-only log state', async () => {
    db = await setupDb();
    const bench = await createExercise(db);
    const session = await createSession(db as never, { templateId: null, name: 'Rebuild stale' });
    const set = await appendSet(db, session, {
      exerciseId: bench.id,
      position: 0,
      weight: 100,
      reps: 3,
      setType: 'working',
    });
    await db.runAsync(
      "UPDATE workout_sets SET weight = 1, reps = 1, set_type = 'warmup', is_warmup = 1, deleted_at = 777 WHERE id = ?",
      [set.id],
    );

    await rebuildSets(db as never, session.id);

    expect(await getSetsBySession(db as never, session.id)).toEqual([
      expect.objectContaining({
        id: set.id,
        weight: 100,
        reps: 3,
        set_type: 'working',
        is_warmup: 0,
        deleted_at: null,
      }),
    ]);
  });

  it('removes materialized set rows that have no corresponding set_added event', async () => {
    db = await setupDb();
    const bench = await createExercise(db);
    const session = await createSession(db as never, { templateId: null, name: 'Rebuild stray' });
    const logged = await appendSet(db, session, {
      exerciseId: bench.id,
      position: 0,
      weight: 100,
      reps: 5,
      clientSetId: 'logged-set',
    });

    await db.runAsync(
      `INSERT INTO workout_sets
         (id, session_id, exercise_id, position, weight, reps, rpe,
          unit, is_warmup, set_type, logged_at, source, client_set_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'stray-set',
        session.id,
        bench.id,
        1,
        999,
        1,
        null,
        'kg',
        0,
        'working',
        999,
        'tap',
        'stray-client-set',
      ],
    );

    await rebuildSets(db as never, session.id);

    expect(
      await db.getAllAsync<WorkoutSet>('SELECT * FROM workout_sets WHERE session_id = ?', [
        session.id,
      ]),
    ).toEqual([expect.objectContaining({ id: logged.id, client_set_id: 'logged-set' })]);
  });

  it('replays add, edit, and delete events in append order when they share a timestamp', async () => {
    db = await setupDb();
    const bench = await createExercise(db);
    const session = await createSession(db as never, { templateId: null, name: 'Same ms' });
    const setId = newId();
    const createdAt = 42;
    const addPayload: SetAddedPayload = {
      set_id: setId,
      exercise_id: bench.id,
      position: 0,
      weight: 50,
      reps: 10,
      rpe: null,
      unit: 'kg',
      is_warmup: 0,
      set_type: 'working',
      logged_at: 100,
      source: 'tap',
      client_set_id: 'same-ms-set',
    };
    const editPayload: SetEditedPayload = { set_id: setId, weight: 55, reps: 8 };
    const deletePayload: SetDeletedPayload = { set_id: setId };

    for (const [eventType, payload, clientEventId] of [
      ['set_added', addPayload, 'same-ms-add'],
      ['set_edited', editPayload, 'same-ms-edit'],
      ['set_deleted', deletePayload, 'same-ms-delete'],
    ] as const) {
      await db.runAsync(
        `INSERT INTO workout_events
           (id, session_id, event_type, payload_json, client_event_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [newId(), session.id, eventType, JSON.stringify(payload), clientEventId, createdAt],
      );
    }

    await rebuildSets(db as never, session.id);

    expect(
      await db.getAllAsync<WorkoutSet>('SELECT * FROM workout_sets WHERE id = ?', [setId]),
    ).toEqual([expect.objectContaining({ weight: 55, reps: 8, deleted_at: createdAt })]);
    expect(await getSetsBySession(db as never, session.id)).toEqual([]);
  });

  it('defaults old set_added payloads without set_type to working sets during rebuild', async () => {
    db = await setupDb();
    const bench = await createExercise(db);
    const session = await createSession(db as never, { templateId: null, name: 'Old payload' });
    const setId = newId();

    await appendEvent(db, session.id, 'set_added', {
      set_id: setId,
      exercise_id: bench.id,
      position: 0,
      weight: 70,
      reps: 7,
      rpe: null,
      unit: 'kg',
      is_warmup: 0,
      logged_at: 123,
      source: 'tap',
      client_set_id: 'old-payload-set',
    });

    await rebuildSets(db as never, session.id);

    expect(await getSetsBySession(db as never, session.id)).toEqual([
      expect.objectContaining({ id: setId, set_type: 'working', is_warmup: 0 }),
    ]);
  });

  it('maps old warmup payloads without set_type back to warmup during rebuild', async () => {
    db = await setupDb();
    const bench = await createExercise(db);
    const session = await createSession(db as never, { templateId: null, name: 'Old warmup' });
    const setId = newId();

    await appendEvent(db, session.id, 'set_added', {
      set_id: setId,
      exercise_id: bench.id,
      position: 0,
      weight: 40,
      reps: 10,
      rpe: null,
      unit: 'kg',
      is_warmup: 1,
      logged_at: 123,
      source: 'tap',
      client_set_id: 'old-warmup-set',
    });

    await rebuildSets(db as never, session.id);

    expect(await getSetsBySession(db as never, session.id)).toEqual([
      expect.objectContaining({ id: setId, set_type: 'warmup', is_warmup: 1 }),
    ]);
  });

  it('ignores non-set events during rebuild', async () => {
    db = await setupDb();
    const bench = await createExercise(db);
    const session = await createSession(db as never, { templateId: null, name: 'Rest event' });

    await appendEvent(db, session.id, 'rest_timer_started', {
      duration_seconds: 90,
      started_at: 100,
      exercise_id: bench.id,
    });
    await appendEvent(db, session.id, 'rest_timer_cancelled', { cancelled_at: 150 });
    await rebuildSets(db as never, session.id);

    expect(await getSetsBySession(db as never, session.id)).toEqual([]);
  });

  it('keeps history limited to completed sessions with non-deleted sets', async () => {
    db = await setupDb();
    const bench = await createExercise(db);
    const complete = await createSession(db as never, { templateId: null, name: 'Complete' });
    await setSessionStartedAt(db, complete.id, 1000);
    await appendSet(db, complete, { exerciseId: bench.id, position: 0, weight: 100, reps: 5 });
    await endSession(db as never, complete.id, 500);

    const active = await createSession(db as never, { templateId: null, name: 'Active' });
    await setSessionStartedAt(db, active.id, 2000);
    await appendSet(db, active, { exerciseId: bench.id, position: 0, weight: 999, reps: 1 });

    const discarded = await createSession(db as never, { templateId: null, name: 'Discarded' });
    await setSessionStartedAt(db, discarded.id, 3000);
    await appendSet(db, discarded, { exerciseId: bench.id, position: 0, weight: 888, reps: 1 });
    await discardSession(db as never, discarded.id);

    const deletedOnly = await createSession(db as never, { templateId: null, name: 'Deleted' });
    await setSessionStartedAt(db, deletedOnly.id, 4000);
    const deleted = await appendSet(db, deletedOnly, {
      exerciseId: bench.id,
      position: 0,
      weight: 777,
      reps: 1,
    });
    await deleteSetWithEvent(db, deletedOnly.id, deleted.id);
    await endSession(db as never, deletedOnly.id, 777);

    expect(await getExerciseHistory(db as never, bench.id, 10)).toEqual([
      expect.objectContaining({
        sessionId: complete.id,
        sets: [expect.objectContaining({ weight: 100, reps: 5 })],
      }),
    ]);
  });

  it('orders history sessions newest first and each session sets by position', async () => {
    db = await setupDb();
    const bench = await createExercise(db);
    const older = await createSession(db as never, { templateId: null, name: 'Older' });
    await setSessionStartedAt(db, older.id, 1000);
    await appendSet(db, older, { exerciseId: bench.id, position: 1, weight: 90, reps: 5 });
    await appendSet(db, older, { exerciseId: bench.id, position: 0, weight: 80, reps: 8 });
    await endSession(db as never, older.id, 1090);

    const newer = await createSession(db as never, { templateId: null, name: 'Newer' });
    await setSessionStartedAt(db, newer.id, 2000);
    await appendSet(db, newer, { exerciseId: bench.id, position: 1, weight: 110, reps: 3 });
    await appendSet(db, newer, { exerciseId: bench.id, position: 0, weight: 100, reps: 5 });
    await endSession(db as never, newer.id, 1100);

    const history = await getExerciseHistory(db as never, bench.id, 5);

    expect(history.map((session) => session.sessionId)).toEqual([newer.id, older.id]);
    expect(history[0].sets.map((set) => set.weight)).toEqual([100, 110]);
    expect(history[1].sets.map((set) => set.weight)).toEqual([80, 90]);
  });

  it('limits history by distinct sessions, not by set rows', async () => {
    db = await setupDb();
    const bench = await createExercise(db);

    for (const [index, startedAt] of [1000, 2000, 3000].entries()) {
      const session = await createSession(db as never, {
        templateId: null,
        name: `Session ${index}`,
      });
      await setSessionStartedAt(db, session.id, startedAt);
      await appendSet(db, session, {
        exerciseId: bench.id,
        position: 0,
        weight: 100 + index,
        reps: 5,
      });
      await appendSet(db, session, {
        exerciseId: bench.id,
        position: 1,
        weight: 90 + index,
        reps: 8,
      });
      await endSession(db as never, session.id, 1000);
    }

    const history = await getExerciseHistory(db as never, bench.id, 2);

    expect(history).toHaveLength(2);
    expect(history.map((session) => session.startedAt)).toEqual([3000, 2000]);
    expect(history.every((session) => session.sets.length === 2)).toBe(true);
  });

  it('computes top set by estimated 1RM and volume from logged history sets', async () => {
    db = await setupDb();
    const bench = await createExercise(db);
    const session = await createSession(db as never, { templateId: null, name: 'Top set' });
    await setSessionStartedAt(db, session.id, 1000);
    await appendSet(db, session, { exerciseId: bench.id, position: 0, weight: 100, reps: 1 });
    await appendSet(db, session, { exerciseId: bench.id, position: 1, weight: 90, reps: 10 });
    await appendSet(db, session, { exerciseId: bench.id, position: 2, weight: null, reps: 10 });
    await endSession(db as never, session.id, 1900);

    expect(await getExerciseHistory(db as never, bench.id, 1)).toEqual([
      expect.objectContaining({
        volume: 100 + 900,
        topSetWeight: 90,
        topSetReps: 10,
        est1rm: 120,
      }),
    ]);
  });

  it('records empty-but-valid cache entries when an exercise has no completed history', async () => {
    db = await setupDb();
    const bench = await createExercise(db);

    await updateExerciseHistoryCache(db as never, bench.id);

    expect(
      await db.getFirstAsync('SELECT * FROM exercise_history_cache WHERE exercise_id = ?', [
        bench.id,
      ]),
    ).toEqual(
      expect.objectContaining({
        exercise_id: bench.id,
        last_session_id: null,
        last_session_at: null,
        last_top_set_weight: null,
        last_top_set_reps: null,
        last_session_volume: null,
        est_1rm: null,
        recent_sessions_json: '[]',
      }),
    );
  });

  it('refreshes history cache with the latest session summary and recent sessions JSON', async () => {
    db = await setupDb();
    const bench = await createExercise(db);
    const older = await createSession(db as never, { templateId: null, name: 'Older cache' });
    await setSessionStartedAt(db, older.id, 1000);
    await appendSet(db, older, { exerciseId: bench.id, position: 0, weight: 80, reps: 5 });
    await endSession(db as never, older.id, 400);

    const newer = await createSession(db as never, { templateId: null, name: 'Newer cache' });
    await setSessionStartedAt(db, newer.id, 2000);
    await appendSet(db, newer, { exerciseId: bench.id, position: 0, weight: 100, reps: 6 });
    await endSession(db as never, newer.id, 600);

    await updateExerciseHistoryCache(db as never, bench.id);

    const cache = await db.getFirstAsync<
      { recent_sessions_json: string } & Record<string, unknown>
    >('SELECT * FROM exercise_history_cache WHERE exercise_id = ?', [bench.id]);
    expect(cache).toEqual(
      expect.objectContaining({
        exercise_id: bench.id,
        last_session_id: newer.id,
        last_session_at: 2000,
        last_top_set_weight: 100,
        last_top_set_reps: 6,
        last_session_volume: 600,
      }),
    );
    expect(JSON.parse(cache?.recent_sessions_json ?? '')).toEqual([
      expect.objectContaining({ sessionId: newer.id }),
      expect.objectContaining({ sessionId: older.id }),
    ]);
  });

  it('refreshes caches for every exercise present in a completed session', async () => {
    db = await setupDb();
    const bench = await createExercise(db, { name: 'Bench' });
    const squat = await createExercise(db, { name: 'Squat' });
    const session = await createSession(db as never, { templateId: null, name: 'Multi exercise' });
    await setSessionStartedAt(db, session.id, 3000);
    await appendSet(db, session, { exerciseId: bench.id, position: 0, weight: 100, reps: 5 });
    await appendSet(db, session, { exerciseId: squat.id, position: 0, weight: 140, reps: 3 });
    await endSession(db as never, session.id, 920);

    await updateSessionExerciseHistoryCache(db as never, session.id);

    expect(
      await db.getAllAsync<{ exercise_id: string }>(
        'SELECT exercise_id FROM exercise_history_cache ORDER BY exercise_id ASC',
      ),
    ).toEqual(
      [{ exercise_id: bench.id }, { exercise_id: squat.id }].sort((a, b) =>
        a.exercise_id.localeCompare(b.exercise_id),
      ),
    );
  });

  it('keeps deleted sets out of cache refreshes after history changes', async () => {
    db = await setupDb();
    const bench = await createExercise(db);
    const first = await createSession(db as never, { templateId: null, name: 'Cache first' });
    await setSessionStartedAt(db, first.id, 1000);
    await appendSet(db, first, { exerciseId: bench.id, position: 0, weight: 100, reps: 5 });
    await endSession(db as never, first.id, 500);
    await updateExerciseHistoryCache(db as never, bench.id);

    const second = await createSession(db as never, { templateId: null, name: 'Cache deleted' });
    await setSessionStartedAt(db, second.id, 2000);
    const deleted = await appendSet(db, second, {
      exerciseId: bench.id,
      position: 0,
      weight: 200,
      reps: 5,
    });
    await deleteSetWithEvent(db, second.id, deleted.id);
    await endSession(db as never, second.id, 1000);
    await updateExerciseHistoryCache(db as never, bench.id);

    expect(
      await db.getFirstAsync('SELECT * FROM exercise_history_cache WHERE exercise_id = ?', [
        bench.id,
      ]),
    ).toEqual(
      expect.objectContaining({
        last_session_id: first.id,
        last_top_set_weight: 100,
        last_session_volume: 500,
      }),
    );
  });
});
