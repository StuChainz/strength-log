import { MIGRATIONS } from '@/db/migrations';
import { getTrainingDashboardData } from '@/db/repositories/trainingDashboard.repo';

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
  };
}

async function setupDb(): Promise<ExpoLikeDb> {
  const db = createSqliteDb();
  await db.execAsync('PRAGMA foreign_keys = ON;');
  for (const migration of MIGRATIONS) {
    await db.execAsync(migration.sql);
  }
  return db;
}

async function insertExercise(db: ExpoLikeDb, id: string): Promise<void> {
  await db.runAsync(
    `INSERT INTO exercises
       (id, name, normalized_name, category, primary_muscle, default_unit,
        is_custom, archived_at, created_at, updated_at)
     VALUES (?, ?, ?, 'barbell', NULL, 'kg', 1, NULL, 1, 1)`,
    [id, id, id],
  );
}

async function insertSession(
  db: ExpoLikeDb,
  id: string,
  status: 'completed' | 'discarded' | 'in_progress',
  startedAt: number,
  options: { name?: string | null; templateId?: string | null } = {},
): Promise<void> {
  const endedAt = status === 'in_progress' ? null : startedAt + 60 * 60_000;
  await db.runAsync(
    `INSERT INTO workout_sessions
       (id, template_id, name, status, started_at, ended_at, total_volume_cached, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)`,
    [
      id,
      options.templateId ?? null,
      options.name ?? null,
      status,
      startedAt,
      endedAt,
      startedAt,
      startedAt,
    ],
  );
}

async function insertSet(
  db: ExpoLikeDb,
  id: string,
  sessionId: string,
  options: {
    weight?: number;
    reps?: number;
    isWarmup?: 0 | 1;
    setType?: 'warmup' | 'working' | 'drop';
    deletedAt?: number | null;
  } = {},
): Promise<void> {
  await db.runAsync(
    `INSERT INTO workout_sets
       (id, session_id, exercise_id, position, weight, reps, rpe, unit,
        is_warmup, logged_at, source, client_set_id, deleted_at, set_type)
     VALUES (?, ?, 'bench', 1, ?, ?, NULL, 'kg', ?, 1, 'tap', ?, ?, ?)`,
    [
      id,
      sessionId,
      options.weight ?? 100,
      options.reps ?? 5,
      options.isWarmup ?? 0,
      `${id}-client`,
      options.deletedAt ?? null,
      options.setType ?? 'working',
    ],
  );
}

describe('training dashboard repository', () => {
  it('reads completed sessions only with duration, sets, volume, PRs, energy, and template name', async () => {
    const db = await setupDb();
    const startedAt = new Date(2026, 5, 2, 10).getTime();

    await insertExercise(db, 'bench');
    await db.runAsync(
      `INSERT INTO templates (id, name, notes, archived_at, created_at, updated_at)
       VALUES ('tpl', 'Push A', NULL, NULL, 1, 1)`,
    );
    await insertSession(db, 'completed', 'completed', startedAt, {
      name: 'Morning Push',
      templateId: 'tpl',
    });
    await insertSet(db, 'set-1', 'completed', { weight: 100, reps: 5 });
    await insertSet(db, 'set-2', 'completed', { weight: 80, reps: 8 });
    await insertSet(db, 'warmup', 'completed', { isWarmup: 1, setType: 'warmup' });
    await insertSet(db, 'deleted', 'completed', { deletedAt: startedAt });
    await db.runAsync(
      `INSERT INTO exercise_prs
         (id, exercise_id, session_id, set_id, record_type, record_key, reps,
          weight, value, unit, achieved_at, created_at)
       VALUES ('pr-1', 'bench', 'completed', 'set-1', 'rep_max', 'rep_max:5', 5, 100, 100, 'kg', ?, 1)`,
      [startedAt],
    );
    await db.runAsync(
      `INSERT INTO session_notes (session_id, energy_rating, note, updated_at)
       VALUES ('completed', 8, NULL, 1)`,
    );

    await insertSession(db, 'discarded', 'discarded', startedAt + 1);
    await insertSet(db, 'discarded-set', 'discarded');
    await insertSession(db, 'active', 'in_progress', startedAt + 2);
    await insertSet(db, 'active-set', 'active');

    const data = await getTrainingDashboardData(db as never);

    expect(data.sessions).toEqual([
      expect.objectContaining({
        id: 'completed',
        name: 'Morning Push',
        templateName: 'Push A',
        durationMin: 60,
        setCount: 2,
        totalVolume: 1140,
        prCount: 1,
        energyRating: 8,
      }),
    ]);

    await db.closeAsync();
  });
});
