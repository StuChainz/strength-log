/**
 * Idempotency constraint tests.
 *
 * Verifies that the sets and events repositories use INSERT OR IGNORE,
 * ensuring that retrying a write after a crash never produces duplicate rows.
 */

import { insertSet } from '@/db/repositories/sets.repo';
import { insertEvent } from '@/db/repositories/events.repo';
import { newId } from '@/domain/ids';
import { MIGRATIONS } from '@/db/migrations';
import type { EventType, Unit } from '@/domain/types';

// ─── Minimal mock DB ──────────────────────────────────────────────────────────

function createMockDb() {
  const rows: { sql: string; params: unknown[] }[] = [];

  return {
    _rows: rows,
    runAsync: jest.fn(async (sql: string, params: unknown[] = []) => {
      rows.push({ sql, params });
      return { lastInsertRowId: 1, changes: 1 };
    }),
    getFirstAsync: jest.fn(async () => null),
    getAllAsync: jest.fn(async () => []),
    execAsync: jest.fn(async () => {}),
    withTransactionAsync: jest.fn(async (task: () => Promise<void>) => task()),
  };
}

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

async function setupSqliteDb(): Promise<ExpoLikeDb> {
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
  return db;
}

async function insertSessionAndExercise(db: ExpoLikeDb): Promise<{
  sessionId: string;
  exerciseId: string;
}> {
  const now = Date.now();
  const sessionId = newId();
  const exerciseId = newId();

  await db.runAsync(
    `INSERT INTO exercises
       (id, name, normalized_name, category, primary_muscle, default_unit, is_custom, archived_at, created_at, updated_at)
     VALUES (?, 'Bench', 'bench', 'barbell', NULL, 'kg', 1, NULL, ?, ?)`,
    [exerciseId, now, now],
  );
  await db.runAsync(
    `INSERT INTO workout_sessions
       (id, template_id, name, status, started_at, ended_at, total_volume_cached, created_at, updated_at)
     VALUES (?, NULL, 'Retry session', 'in_progress', ?, NULL, NULL, ?, ?)`,
    [sessionId, now, now, now],
  );

  return { sessionId, exerciseId };
}

async function appendSetWrite(
  db: ExpoLikeDb,
  input: {
    sessionId: string;
    exerciseId: string;
    setId: string;
    clientSetId: string;
    clientEventId: string;
    weight?: number;
    reps?: number;
    unit?: Unit;
  },
): Promise<void> {
  const loggedAt = Date.now();
  const payload = {
    set_id: input.setId,
    exercise_id: input.exerciseId,
    position: 0,
    weight: input.weight ?? 80,
    reps: input.reps ?? 5,
    rpe: null,
    unit: input.unit ?? 'kg',
    is_warmup: 0,
    set_type: 'working',
    logged_at: loggedAt,
    source: 'tap',
    client_set_id: input.clientSetId,
  };

  await db.withTransactionAsync(async () => {
    await insertEvent(db as never, {
      id: newId(),
      session_id: input.sessionId,
      event_type: 'set_added' as EventType,
      payload_json: JSON.stringify(payload),
      client_event_id: input.clientEventId,
    });
    await insertSet(db as never, {
      id: input.setId,
      session_id: input.sessionId,
      exercise_id: input.exerciseId,
      position: 0,
      weight: input.weight ?? 80,
      reps: input.reps ?? 5,
      rpe: null,
      unit: input.unit ?? 'kg',
      is_warmup: 0,
      set_type: 'working',
      logged_at: loggedAt,
      source: 'tap',
      client_set_id: input.clientSetId,
    });
  });
}

// ─── Sets repo ────────────────────────────────────────────────────────────────

describe('insertSet — idempotency', () => {
  it('uses INSERT OR IGNORE (not plain INSERT)', async () => {
    const db = createMockDb();
    await insertSet(db as never, {
      id: newId(),
      session_id: newId(),
      exercise_id: newId(),
      position: 0,
      weight: 100,
      reps: 5,
      rpe: null,
      unit: 'kg',
      is_warmup: 0,
      set_type: 'working',
      logged_at: Date.now(),
      source: 'tap',
      client_set_id: newId(),
    });

    const call = db._rows[0];
    expect(call).toBeDefined();
    expect(call.sql).toMatch(/INSERT OR IGNORE/i);
    expect(call.sql).toMatch(/workout_sets/i);
  });

  it('includes client_set_id as the last bound parameter', async () => {
    const db = createMockDb();
    const clientSetId = newId();

    await insertSet(db as never, {
      id: newId(),
      session_id: newId(),
      exercise_id: newId(),
      position: 0,
      weight: 80,
      reps: 8,
      rpe: 7,
      unit: 'kg',
      is_warmup: 0,
      set_type: 'working',
      logged_at: Date.now(),
      source: 'tap',
      client_set_id: clientSetId,
    });

    const params = db._rows[0].params as string[];
    expect(params[params.length - 1]).toBe(clientSetId);
  });

  it('calling twice with the same client_set_id produces two DB calls but both use OR IGNORE', async () => {
    const db = createMockDb();
    const sharedClientSetId = newId();

    const input = {
      id: newId(),
      session_id: newId(),
      exercise_id: newId(),
      position: 0,
      weight: 100,
      reps: 5,
      rpe: null,
      unit: 'kg' as const,
      is_warmup: 0 as const,
      set_type: 'working' as const,
      logged_at: Date.now(),
      source: 'tap' as const,
      client_set_id: sharedClientSetId,
    };

    await insertSet(db as never, input);
    await insertSet(db as never, input);

    expect(db._rows).toHaveLength(2);
    db._rows.forEach((row) => {
      expect(row.sql).toMatch(/INSERT OR IGNORE/i);
    });
    // In a real SQLite DB, only the first insert would produce a row —
    // OR IGNORE silently discards the duplicate.
  });
});

// ─── Events repo ─────────────────────────────────────────────────────────────

describe('insertEvent — idempotency', () => {
  it('uses INSERT OR IGNORE (not plain INSERT)', async () => {
    const db = createMockDb();
    await insertEvent(db as never, {
      id: newId(),
      session_id: newId(),
      event_type: 'set_added',
      payload_json: '{}',
      client_event_id: newId(),
    });

    const call = db._rows[0];
    expect(call).toBeDefined();
    expect(call.sql).toMatch(/INSERT OR IGNORE/i);
    expect(call.sql).toMatch(/workout_events/i);
  });

  it('includes client_event_id in the bound parameters', async () => {
    const db = createMockDb();
    const clientEventId = newId();

    await insertEvent(db as never, {
      id: newId(),
      session_id: newId(),
      event_type: 'set_added',
      payload_json: '{}',
      client_event_id: clientEventId,
    });

    const params = db._rows[0].params as string[];
    expect(params).toContain(clientEventId);
  });
});

describe('real SQLite idempotency constraints', () => {
  let db: ExpoLikeDb;

  afterEach(async () => {
    await db?.closeAsync();
  });

  it('retries a set write with the same client_event_id and client_set_id without duplicates', async () => {
    db = await setupSqliteDb();
    const { sessionId, exerciseId } = await insertSessionAndExercise(db);
    const setId = newId();
    const clientSetId = 'retry-client-set';
    const clientEventId = 'retry-client-event';

    await appendSetWrite(db, { sessionId, exerciseId, setId, clientSetId, clientEventId });
    await appendSetWrite(db, { sessionId, exerciseId, setId, clientSetId, clientEventId });

    await expect(
      db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) AS count FROM workout_events WHERE client_event_id = ?',
        [clientEventId],
      ),
    ).resolves.toEqual({ count: 1 });
    await expect(
      db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) AS count FROM workout_sets WHERE client_set_id = ?',
        [clientSetId],
      ),
    ).resolves.toEqual({ count: 1 });
    await expect(
      db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM workout_sets WHERE id = ?', [
        setId,
      ]),
    ).resolves.toEqual({ count: 1 });
  });

  it('enforces one in-progress session for new writes', async () => {
    db = await setupSqliteDb();
    await insertSessionAndExercise(db);

    await expect(
      db.runAsync(
        `INSERT INTO workout_sessions
           (id, template_id, name, status, started_at, ended_at, total_volume_cached, created_at, updated_at)
         VALUES (?, NULL, 'Second active', 'in_progress', ?, NULL, NULL, ?, ?)`,
        [newId(), Date.now(), Date.now(), Date.now()],
      ),
    ).rejects.toThrow();
  });

  it('creates the partial unique index for one in-progress session', async () => {
    db = await setupSqliteDb();

    const indexes = await db.getAllAsync<{ name: string; unique: number }>(
      'PRAGMA index_list(workout_sessions)',
    );

    expect(indexes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'idx_one_in_progress_session', unique: 1 }),
      ]),
    );
  });
});
