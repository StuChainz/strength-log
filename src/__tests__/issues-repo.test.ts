import { MIGRATIONS } from '@/db/migrations';
import {
  archiveIssue,
  createIssue,
  getExerciseIssueSummary,
  getIssueById,
  getIssues,
  recordExerciseIssueEvent,
  updateIssue,
} from '@/db/repositories/issues.repo';
import { newId } from '@/domain/ids';
import type { Exercise } from '@/domain/types';

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
  await db.execAsync('PRAGMA foreign_keys = ON;');
  for (const migration of MIGRATIONS) {
    await db.execAsync(migration.sql);
  }
  return db;
}

async function createExercise(db: ExpoLikeDb, name = 'Bench Press'): Promise<Exercise> {
  const now = Date.now();
  const exercise: Exercise = {
    id: newId(),
    name,
    normalized_name: name.toLowerCase(),
    category: 'barbell',
    primary_muscle: null,
    default_unit: 'kg',
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

describe('issues repository', () => {
  let db: ExpoLikeDb | null;

  beforeEach(() => {
    db = null;
    jest.spyOn(Date, 'now').mockReturnValue(1_900_000_000_000);
  });

  afterEach(async () => {
    await db?.closeAsync();
    jest.restoreAllMocks();
  });

  it('creates an Issue', async () => {
    db = await setupDb();

    const issue = await createIssue(db as never, {
      name: '  Shoulder Pain  ',
      note: '  Left side  ',
    });

    expect(await getIssueById(db as never, issue.id)).toEqual(
      expect.objectContaining({
        id: issue.id,
        name: 'Shoulder Pain',
        note: 'Left side',
        active: 1,
      }),
    );
  });

  it('edits an Issue', async () => {
    db = await setupDb();
    const issue = await createIssue(db as never, { name: 'Shoulder Pain', note: null });

    await updateIssue(db as never, issue.id, {
      name: 'Left shoulder impingement',
      note: 'Keep an eye on pressing.',
    });

    expect(await getIssueById(db as never, issue.id)).toEqual(
      expect.objectContaining({
        name: 'Left shoulder impingement',
        note: 'Keep an eye on pressing.',
        active: 1,
      }),
    );
  });

  it('archives an Issue without deleting historical exercise reactions', async () => {
    db = await setupDb();
    const issue = await createIssue(db as never, { name: 'Shoulder Pain' });
    const exercise = await createExercise(db);
    await recordExerciseIssueEvent(db as never, {
      issueId: issue.id,
      exerciseId: exercise.id,
      reactionType: 'aggravated',
      severity: 3,
    });

    await archiveIssue(db as never, issue.id);

    expect(await getIssueById(db as never, issue.id)).toEqual(
      expect.objectContaining({ active: 0 }),
    );
    expect(await getExerciseIssueSummary(db as never, exercise.id)).toEqual([
      expect.objectContaining({
        issueId: issue.id,
        issueName: 'Shoulder Pain',
        aggravatedCount: 1,
      }),
    ]);
    expect(await getIssues(db as never, false)).toEqual([]);
  });

  it('records aggravated and helped reactions with optional notes', async () => {
    db = await setupDb();
    const issue = await createIssue(db as never, { name: 'Knee pain' });
    const exercise = await createExercise(db, 'Squat');

    await recordExerciseIssueEvent(db as never, {
      issueId: issue.id,
      exerciseId: exercise.id,
      reactionType: 'aggravated',
      severity: 4,
      note: '  Pinch at depth  ',
    });
    await recordExerciseIssueEvent(db as never, {
      issueId: issue.id,
      exerciseId: exercise.id,
      reactionType: 'helped',
      severity: 2,
      note: '',
    });

    const events = await db.getAllAsync(
      'SELECT reaction_type, severity, note FROM exercise_issue_events ORDER BY rowid ASC',
    );
    expect(events).toEqual([
      { reaction_type: 'aggravated', severity: 4, note: 'Pinch at depth' },
      { reaction_type: 'helped', severity: 2, note: null },
    ]);
  });

  it('validates severity from 1 to 5', async () => {
    db = await setupDb();
    const issue = await createIssue(db as never, { name: 'Elbow discomfort' });
    const exercise = await createExercise(db);

    await expect(
      recordExerciseIssueEvent(db as never, {
        issueId: issue.id,
        exerciseId: exercise.id,
        reactionType: 'aggravated',
        severity: 6,
      }),
    ).rejects.toThrow('Issue severity must be an integer from 1 to 5');
  });

  it('summarizes exercise Issue history counts and latest note', async () => {
    db = await setupDb();
    const issue = await createIssue(db as never, { name: 'Lower back pain' });
    const exercise = await createExercise(db, 'Deadlift');

    await recordExerciseIssueEvent(db as never, {
      issueId: issue.id,
      exerciseId: exercise.id,
      reactionType: 'aggravated',
      severity: 3,
      note: 'Tight after set 1',
    });
    jest.spyOn(Date, 'now').mockReturnValue(1_900_000_000_001);
    await recordExerciseIssueEvent(db as never, {
      issueId: issue.id,
      exerciseId: exercise.id,
      reactionType: 'aggravated',
      severity: 2,
      note: 'Tingling after set 2',
    });
    jest.spyOn(Date, 'now').mockReturnValue(1_900_000_000_002);
    await recordExerciseIssueEvent(db as never, {
      issueId: issue.id,
      exerciseId: exercise.id,
      reactionType: 'helped',
      severity: 1,
    });

    expect(await getExerciseIssueSummary(db as never, exercise.id)).toEqual([
      {
        issueId: issue.id,
        issueName: 'Lower back pain',
        aggravatedCount: 2,
        helpedCount: 1,
        lastNote: 'Tingling after set 2',
        lastCreatedAt: 1_900_000_000_002,
      },
    ]);
  });
});
