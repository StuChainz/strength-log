import { MIGRATIONS } from '@/db/migrations';
import {
  getTrainingVolumeReport,
  TRAINING_VOLUME_WINDOWS,
} from '@/db/repositories/trainingVolume.repo';

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
const DAY_MS = 24 * 60 * 60 * 1000;

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

async function insertExercise(
  db: ExpoLikeDb,
  id: string,
  name: string,
  primaryMuscles: string[],
  secondaryMuscles: string[],
  tertiaryMuscles: string[] = [],
): Promise<void> {
  const now = 1;
  await db.runAsync(
    `INSERT INTO exercises
       (id, name, normalized_name, category, primary_muscle, default_unit,
        is_custom, archived_at, created_at, updated_at)
     VALUES (?, ?, ?, 'barbell', NULL, 'kg', 1, NULL, ?, ?)`,
    [id, name, name.toLowerCase(), now, now],
  );
  await db.runAsync(
    `INSERT INTO exercise_metadata
       (exercise_id, primary_muscles_json, secondary_muscles_json, tertiary_muscles_json,
        equipment_json, source, updated_at)
     VALUES (?, ?, ?, ?, '[]', 'test', ?)`,
    [
      id,
      JSON.stringify(primaryMuscles),
      JSON.stringify(secondaryMuscles),
      JSON.stringify(tertiaryMuscles),
      now,
    ],
  );
}

async function insertSession(
  db: ExpoLikeDb,
  id: string,
  status: 'completed' | 'discarded',
  startedAt: number,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO workout_sessions
       (id, template_id, name, status, started_at, ended_at, total_volume_cached, created_at, updated_at)
     VALUES (?, NULL, NULL, ?, ?, ?, NULL, ?, ?)`,
    [id, status, startedAt, startedAt + 60_000, startedAt, startedAt + 60_000],
  );
}

async function insertSet(
  db: ExpoLikeDb,
  id: string,
  sessionId: string,
  exerciseId: string,
  position: number,
  options: {
    setType?: 'warmup' | 'working' | 'drop';
    deletedAt?: number | null;
  } = {},
): Promise<void> {
  const setType = options.setType ?? 'working';
  await db.runAsync(
    `INSERT INTO workout_sets
       (id, session_id, exercise_id, position, weight, reps, rpe, unit,
        is_warmup, logged_at, source, client_set_id, deleted_at, set_type)
     VALUES (?, ?, ?, ?, 100, 5, NULL, 'kg', ?, 1, 'tap', ?, ?, ?)`,
    [
      id,
      sessionId,
      exerciseId,
      position,
      setType === 'warmup' ? 1 : 0,
      `${id}-client`,
      options.deletedAt ?? null,
      setType,
    ],
  );
}

describe('training volume repository', () => {
  it('aggregates completed sessions inside the rolling 7-day window only', async () => {
    const db = await setupDb();
    const now = Date.UTC(2026, 5, 2, 12);

    await insertExercise(db, 'bench', 'Bench Press', ['chest'], ['triceps']);
    await insertExercise(db, 'pushdown', 'Pushdown', ['triceps'], []);

    await insertSession(db, 'recent-1', 'completed', now - DAY_MS);
    await insertSet(db, 'bench-1', 'recent-1', 'bench', 1);
    await insertSet(db, 'bench-2', 'recent-1', 'bench', 2);

    await insertSession(db, 'recent-2', 'completed', now - 2 * DAY_MS);
    await insertSet(db, 'pushdown-1', 'recent-2', 'pushdown', 1);

    await insertSession(db, 'old', 'completed', now - 8 * DAY_MS);
    await insertSet(db, 'old-bench', 'old', 'bench', 1);

    await insertSession(db, 'discarded', 'discarded', now - DAY_MS);
    await insertSet(db, 'discarded-bench', 'discarded', 'bench', 1);

    await insertSession(db, 'recent-warmup', 'completed', now - DAY_MS);
    await insertSet(db, 'warmup-bench', 'recent-warmup', 'bench', 1, { setType: 'warmup' });
    await insertSet(db, 'deleted-bench', 'recent-warmup', 'bench', 2, { deletedAt: now });

    const report = await getTrainingVolumeReport(db as never, { now });

    expect(report.window.startAt).toBe(now - 7 * DAY_MS);
    expect(report.muscles.map((row) => [row.muscle, row.totalExposure])).toEqual([
      ['chest', 2],
      ['triceps', 2],
    ]);
    expect(report.muscles.find((row) => row.muscle === 'triceps')).toMatchObject({
      directContribution: 1,
      indirectContribution: 1,
      directSources: [{ exercise_id: 'pushdown', exercise_name: 'Pushdown', contribution: 1 }],
      indirectSources: [{ exercise_id: 'bench', exercise_name: 'Bench Press', contribution: 1 }],
    });

    await db.closeAsync();
  });

  it('uses the selected rolling window when aggregating', async () => {
    const db = await setupDb();
    const now = Date.UTC(2026, 5, 2, 12);

    await insertExercise(db, 'bench', 'Bench Press', ['chest'], ['triceps']);

    await insertSession(db, 'recent', 'completed', now - DAY_MS);
    await insertSet(db, 'recent-bench', 'recent', 'bench', 1);

    await insertSession(db, 'inside-30d', 'completed', now - 20 * DAY_MS);
    await insertSet(db, 'inside-30d-bench', 'inside-30d', 'bench', 1);

    await insertSession(db, 'outside-30d', 'completed', now - 45 * DAY_MS);
    await insertSet(db, 'outside-30d-bench', 'outside-30d', 'bench', 1);

    const sevenDayReport = await getTrainingVolumeReport(db as never, { now });
    const thirtyDayReport = await getTrainingVolumeReport(db as never, {
      now,
      window: TRAINING_VOLUME_WINDOWS.last30Days,
    });

    expect(sevenDayReport.window).toMatchObject({ id: '7d', label: '7D', days: 7 });
    expect(thirtyDayReport.window).toMatchObject({ id: '30d', label: '30D', days: 30 });
    expect(sevenDayReport.muscles.find((row) => row.muscle === 'chest')?.directContribution).toBe(
      1,
    );
    expect(thirtyDayReport.muscles.find((row) => row.muscle === 'chest')?.directContribution).toBe(
      2,
    );

    await db.closeAsync();
  });
});
