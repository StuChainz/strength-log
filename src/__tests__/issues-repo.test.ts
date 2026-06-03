import { MIGRATIONS } from '@/db/migrations';
import {
  archiveIssue,
  createIssue,
  createIssueExerciseLink,
  createIssueRoutine,
  deleteExerciseIssueEvent,
  deleteIssueExerciseLink,
  getActiveIssueExerciseLinksForExercise,
  getExerciseIssueSummary,
  getIssueById,
  getIssueExerciseLinks,
  getIssueRoutine,
  getIssueRoutineItems,
  getIssues,
  getIssueRecentEvents,
  recordExerciseIssueEvent,
  updateIssueExerciseLink,
  updateExerciseIssueEvent,
  updateIssue,
  updateIssueRoutine,
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

  it('creates a helpful exercise link', async () => {
    db = await setupDb();
    const issue = await createIssue(db as never, { name: 'Shoulder Pain' });
    const exercise = await createExercise(db, 'Face Pull');

    const link = await createIssueExerciseLink(db as never, {
      issueId: issue.id,
      exerciseId: exercise.id,
      linkType: 'helpful',
      note: '  Feels controlled  ',
    });

    expect(await getIssueExerciseLinks(db as never, issue.id)).toEqual([
      expect.objectContaining({
        id: link.id,
        issue_id: issue.id,
        exercise_id: exercise.id,
        exercise_name: 'Face Pull',
        link_type: 'helpful',
        note: 'Feels controlled',
      }),
    ]);
  });

  it('creates an Issue Routine backed by a normal template', async () => {
    db = await setupDb();
    const issue = await createIssue(db as never, { name: 'Shoulder Pain' });
    const facePull = await createExercise(db, 'Face Pull');
    const pullApart = await createExercise(db, 'Band Pull Apart');

    const routine = await createIssueRoutine(db as never, {
      issueId: issue.id,
      name: 'Shoulder Pain Routine',
      items: [
        { exerciseId: facePull.id, targetSets: 2, targetReps: 15, note: 'Light and smooth' },
        { exerciseId: pullApart.id, targetSets: 2, targetReps: 20 },
      ],
    });

    expect(await getIssueRoutine(db as never, issue.id)).toEqual(
      expect.objectContaining({
        id: routine.id,
        issue_id: issue.id,
        template_id: routine.template_id,
        routine_name: 'Shoulder Pain Routine',
        exercise_count: 2,
        last_completed_at: null,
      }),
    );
    expect(await getIssueRoutineItems(db as never, issue.id)).toEqual([
      expect.objectContaining({
        exercise_id: facePull.id,
        exercise_name: 'Face Pull',
        target_sets: 2,
        target_reps: 15,
        target_weight: null,
        progression_rule: 'none',
        note: 'Light and smooth',
      }),
      expect.objectContaining({
        exercise_id: pullApart.id,
        exercise_name: 'Band Pull Apart',
        target_sets: 2,
        target_reps: 20,
        note: null,
      }),
    ]);
  });

  it('edits an Issue Routine and removes routine exercises through template items', async () => {
    db = await setupDb();
    const issue = await createIssue(db as never, { name: 'Shoulder Pain' });
    const facePull = await createExercise(db, 'Face Pull');
    const pullApart = await createExercise(db, 'Band Pull Apart');
    const ytw = await createExercise(db, 'YTW');

    const routine = await createIssueRoutine(db as never, {
      issueId: issue.id,
      name: 'Shoulder Pain Routine',
      items: [
        { exerciseId: facePull.id, targetSets: 2, targetReps: 15 },
        { exerciseId: pullApart.id, targetSets: 2, targetReps: 20 },
      ],
    });

    await updateIssueRoutine(db as never, issue.id, {
      name: 'Shoulder Warm-up Routine',
      items: [{ exerciseId: ytw.id, targetSets: 2, targetReps: 10, note: 'Slow reps' }],
    });

    expect(await getIssueRoutine(db as never, issue.id)).toEqual(
      expect.objectContaining({
        id: routine.id,
        template_id: routine.template_id,
        routine_name: 'Shoulder Warm-up Routine',
        exercise_count: 1,
      }),
    );
    expect(await getIssueRoutineItems(db as never, issue.id)).toEqual([
      expect.objectContaining({
        exercise_id: ytw.id,
        exercise_name: 'YTW',
        target_sets: 2,
        target_reps: 10,
        note: 'Slow reps',
      }),
    ]);
    expect(
      await db.getFirstAsync<{ count: number }>(
        'SELECT COUNT(*) AS count FROM template_items WHERE template_id = ?',
        [routine.template_id],
      ),
    ).toEqual({ count: 1 });
  });

  it('archives an Issue without deleting linked routine data', async () => {
    db = await setupDb();
    const issue = await createIssue(db as never, { name: 'Shoulder Pain' });
    const facePull = await createExercise(db, 'Face Pull');
    const routine = await createIssueRoutine(db as never, {
      issueId: issue.id,
      name: 'Shoulder Pain Routine',
      items: [{ exerciseId: facePull.id, targetSets: 2, targetReps: 15 }],
    });

    await archiveIssue(db as never, issue.id);

    expect(await getIssueById(db as never, issue.id)).toEqual(
      expect.objectContaining({ active: 0 }),
    );
    expect(await getIssueRoutine(db as never, issue.id)).toEqual(
      expect.objectContaining({ id: routine.id, template_id: routine.template_id }),
    );
    expect(await getIssueRoutineItems(db as never, issue.id)).toEqual([
      expect.objectContaining({ exercise_id: facePull.id }),
    ]);
  });

  it('creates an aggravating exercise link', async () => {
    db = await setupDb();
    const issue = await createIssue(db as never, { name: 'Shoulder Pain' });
    const exercise = await createExercise(db, 'Overhead Press');

    await createIssueExerciseLink(db as never, {
      issueId: issue.id,
      exerciseId: exercise.id,
      linkType: 'aggravating',
    });

    expect(await getActiveIssueExerciseLinksForExercise(db as never, exercise.id)).toEqual([
      expect.objectContaining({
        issue_id: issue.id,
        issue_name: 'Shoulder Pain',
        exercise_id: exercise.id,
        link_type: 'aggravating',
      }),
    ]);
  });

  it('prevents duplicate issue/exercise/link_type rows', async () => {
    db = await setupDb();
    const issue = await createIssue(db as never, { name: 'Shoulder Pain' });
    const exercise = await createExercise(db, 'Face Pull');

    await createIssueExerciseLink(db as never, {
      issueId: issue.id,
      exerciseId: exercise.id,
      linkType: 'helpful',
    });
    await createIssueExerciseLink(db as never, {
      issueId: issue.id,
      exerciseId: exercise.id,
      linkType: 'helpful',
    });
    await createIssueExerciseLink(db as never, {
      issueId: issue.id,
      exerciseId: exercise.id,
      linkType: 'aggravating',
    });

    const rows = await db.getAllAsync(
      `SELECT issue_id, exercise_id, link_type
         FROM issue_exercise_links
        ORDER BY link_type ASC`,
    );
    expect(rows).toEqual([
      { issue_id: issue.id, exercise_id: exercise.id, link_type: 'aggravating' },
      { issue_id: issue.id, exercise_id: exercise.id, link_type: 'helpful' },
    ]);
  });

  it('removes an exercise link without deleting the Issue or Exercise', async () => {
    db = await setupDb();
    const issue = await createIssue(db as never, { name: 'Shoulder Pain' });
    const exercise = await createExercise(db, 'Face Pull');
    const link = await createIssueExerciseLink(db as never, {
      issueId: issue.id,
      exerciseId: exercise.id,
      linkType: 'helpful',
    });

    await deleteIssueExerciseLink(db as never, link.id);

    expect(await getIssueExerciseLinks(db as never, issue.id)).toEqual([]);
    expect(await getIssueById(db as never, issue.id)).toEqual(
      expect.objectContaining({ id: issue.id }),
    );
    expect(await db.getFirstAsync('SELECT id FROM exercises WHERE id = ?', [exercise.id])).toEqual({
      id: exercise.id,
    });
  });

  it('updates an exercise link note', async () => {
    db = await setupDb();
    const issue = await createIssue(db as never, { name: 'Shoulder Pain' });
    const exercise = await createExercise(db, 'Band Pull Apart');
    const link = await createIssueExerciseLink(db as never, {
      issueId: issue.id,
      exerciseId: exercise.id,
      linkType: 'helpful',
    });

    await updateIssueExerciseLink(db as never, link.id, { note: '  Good warmup  ' });

    expect(await getIssueExerciseLinks(db as never, issue.id)).toEqual([
      expect.objectContaining({ id: link.id, note: 'Good warmup' }),
    ]);
  });

  it('does not return archived Issue links for active exercise context', async () => {
    db = await setupDb();
    const issue = await createIssue(db as never, { name: 'Shoulder Pain' });
    const exercise = await createExercise(db, 'Overhead Press');
    await createIssueExerciseLink(db as never, {
      issueId: issue.id,
      exerciseId: exercise.id,
      linkType: 'aggravating',
    });

    await archiveIssue(db as never, issue.id);

    expect(await getActiveIssueExerciseLinksForExercise(db as never, exercise.id)).toEqual([]);
    expect(await getIssueExerciseLinks(db as never, issue.id)).toEqual([
      expect.objectContaining({ issue_id: issue.id, exercise_id: exercise.id }),
    ]);
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

  it('edits reaction type on an Issue reaction', async () => {
    db = await setupDb();
    const issue = await createIssue(db as never, { name: 'Shoulder Pain' });
    const exercise = await createExercise(db);
    const event = await recordExerciseIssueEvent(db as never, {
      issueId: issue.id,
      exerciseId: exercise.id,
      reactionType: 'aggravated',
      severity: 3,
    });

    await updateExerciseIssueEvent(db as never, event.id, { reactionType: 'helped' });

    expect(
      await db.getFirstAsync('SELECT reaction_type FROM exercise_issue_events WHERE id = ?', [
        event.id,
      ]),
    ).toEqual({ reaction_type: 'helped' });
  });

  it('edits severity on an Issue reaction', async () => {
    db = await setupDb();
    const issue = await createIssue(db as never, { name: 'Knee pain' });
    const exercise = await createExercise(db);
    const event = await recordExerciseIssueEvent(db as never, {
      issueId: issue.id,
      exerciseId: exercise.id,
      reactionType: 'aggravated',
      severity: 2,
    });

    await updateExerciseIssueEvent(db as never, event.id, { severity: 5 });

    expect(
      await db.getFirstAsync('SELECT severity FROM exercise_issue_events WHERE id = ?', [event.id]),
    ).toEqual({ severity: 5 });
  });

  it('edits note on an Issue reaction', async () => {
    db = await setupDb();
    const issue = await createIssue(db as never, { name: 'Elbow discomfort' });
    const exercise = await createExercise(db);
    const event = await recordExerciseIssueEvent(db as never, {
      issueId: issue.id,
      exerciseId: exercise.id,
      reactionType: 'helped',
      severity: 1,
      note: 'Original note',
    });

    await updateExerciseIssueEvent(db as never, event.id, { note: '  Better after warmup  ' });

    expect(
      await db.getFirstAsync('SELECT note FROM exercise_issue_events WHERE id = ?', [event.id]),
    ).toEqual({ note: 'Better after warmup' });
  });

  it('deletes an Issue reaction without deleting the Issue', async () => {
    db = await setupDb();
    const issue = await createIssue(db as never, { name: 'Lower back pain' });
    const exercise = await createExercise(db);
    const event = await recordExerciseIssueEvent(db as never, {
      issueId: issue.id,
      exerciseId: exercise.id,
      reactionType: 'aggravated',
      severity: 4,
      note: 'Accidental record',
    });

    await deleteExerciseIssueEvent(db as never, event.id);

    expect(
      await db.getFirstAsync('SELECT * FROM exercise_issue_events WHERE id = ?', [event.id]),
    ).toBeNull();
    expect(await getIssueById(db as never, issue.id)).toEqual(
      expect.objectContaining({ id: issue.id, name: 'Lower back pain' }),
    );
  });

  it('removes deleted reactions from Exercise History summaries and Issue detail rows', async () => {
    db = await setupDb();
    const issue = await createIssue(db as never, { name: 'Shoulder Pain' });
    const exercise = await createExercise(db, 'Bench Press');
    const deleted = await recordExerciseIssueEvent(db as never, {
      issueId: issue.id,
      exerciseId: exercise.id,
      reactionType: 'aggravated',
      severity: 3,
      note: 'Delete me',
    });

    await deleteExerciseIssueEvent(db as never, deleted.id);

    expect(await getExerciseIssueSummary(db as never, exercise.id)).toEqual([]);
    expect(await getIssueRecentEvents(db as never, issue.id)).toEqual([]);
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
      expect.objectContaining({
        issueId: issue.id,
        issueName: 'Lower back pain',
        aggravatedCount: 2,
        helpedCount: 1,
        lastNote: 'Tingling after set 2',
        lastCreatedAt: 1_900_000_000_002,
        latestEvent: expect.objectContaining({
          issue_id: issue.id,
          reaction_type: 'helped',
          severity: 1,
        }),
      }),
    ]);
  });
});
