import { type SQLiteDatabase } from 'expo-sqlite';
import { newId } from '@/domain/ids';
import { detectFinalSessionPRs, type DetectedPR, type PreviousPRData } from '@/domain/prs';
import type { ExercisePR, WorkoutSet } from '@/domain/types';

export interface ExercisePRWithExercise extends ExercisePR {
  exercise_name: string;
}

interface RepMaxRow {
  exercise_id: string;
  reps: number;
  weight: number;
}

interface ValueRow {
  exercise_id: string;
  value: number;
}

function includedSetWhere(alias: string): string {
  return `
    ${alias}.deleted_at IS NULL
    AND ${alias}.weight IS NOT NULL
    AND ${alias}.reps IS NOT NULL
    AND ${alias}.reps > 0
    AND ${alias}.is_warmup = 0
    AND COALESCE(${alias}.set_type, 'working') != 'warmup'
  `;
}

export async function getPreviousPRDataForExercises(
  db: SQLiteDatabase,
  exerciseIds: string[],
  excludeSessionId: string | null,
): Promise<PreviousPRData> {
  const uniqueExerciseIds = Array.from(new Set(exerciseIds));
  if (uniqueExerciseIds.length === 0) {
    return { repMaxes: [], estimated1RMs: [], sessionVolumes: [] };
  }

  const placeholders = uniqueExerciseIds.map(() => '?').join(', ');
  const sessionFilter = excludeSessionId === null ? '' : 'AND sess.id != ?';
  const params =
    excludeSessionId === null ? uniqueExerciseIds : [...uniqueExerciseIds, excludeSessionId];

  const repMaxRows = await db.getAllAsync<RepMaxRow>(
    `SELECT ws.exercise_id, ws.reps, MAX(ws.weight) AS weight
       FROM workout_sets ws
       JOIN workout_sessions sess ON sess.id = ws.session_id
      WHERE ws.exercise_id IN (${placeholders})
        AND sess.status = 'completed'
        ${sessionFilter}
        AND ${includedSetWhere('ws')}
      GROUP BY ws.exercise_id, ws.reps`,
    params,
  );

  const estimatedRows = await db.getAllAsync<ValueRow>(
    `SELECT ws.exercise_id, MAX(ws.weight * (1 + (ws.reps / 30.0))) AS value
       FROM workout_sets ws
       JOIN workout_sessions sess ON sess.id = ws.session_id
      WHERE ws.exercise_id IN (${placeholders})
        AND sess.status = 'completed'
        ${sessionFilter}
        AND ws.reps <= 10
        AND ${includedSetWhere('ws')}
      GROUP BY ws.exercise_id`,
    params,
  );

  const volumeRows = await db.getAllAsync<ValueRow>(
    `SELECT exercise_id, MAX(session_volume) AS value
       FROM (
         SELECT ws.exercise_id, ws.session_id, SUM(ws.weight * ws.reps) AS session_volume
           FROM workout_sets ws
           JOIN workout_sessions sess ON sess.id = ws.session_id
          WHERE ws.exercise_id IN (${placeholders})
            AND sess.status = 'completed'
            ${sessionFilter}
            AND ${includedSetWhere('ws')}
          GROUP BY ws.exercise_id, ws.session_id
       ) grouped
      GROUP BY exercise_id`,
    params,
  );

  return {
    repMaxes: repMaxRows.map((row) => ({
      exerciseId: row.exercise_id,
      reps: row.reps,
      weight: row.weight,
    })),
    estimated1RMs: estimatedRows.map((row) => ({
      exerciseId: row.exercise_id,
      value: row.value,
    })),
    sessionVolumes: volumeRows.map((row) => ({
      exerciseId: row.exercise_id,
      value: row.value,
    })),
  };
}

export async function insertFinalPRRecords(
  db: SQLiteDatabase,
  records: DetectedPR[],
): Promise<void> {
  const now = Date.now();
  for (const record of records) {
    await db.runAsync(
      `INSERT OR IGNORE INTO exercise_prs
         (id, exercise_id, session_id, set_id, record_type, record_key, reps,
          weight, value, unit, achieved_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newId(),
        record.exercise_id,
        record.session_id,
        record.set_id,
        record.record_type,
        record.record_key,
        record.reps,
        record.weight,
        record.value,
        record.unit,
        record.achieved_at,
        now,
      ],
    );
  }
}

export async function detectAndInsertFinalPrsForSession(
  db: SQLiteDatabase,
  sessionId: string,
): Promise<DetectedPR[]> {
  const sets = await db.getAllAsync<WorkoutSet>(
    `SELECT * FROM workout_sets
      WHERE session_id = ?
      ORDER BY position ASC`,
    [sessionId],
  );
  const exerciseIds = sets.map((set) => set.exercise_id);
  const previousBestData = await getPreviousPRDataForExercises(db, exerciseIds, sessionId);
  const records = detectFinalSessionPRs(sets, previousBestData);

  if (records.length > 0) {
    await db.withTransactionAsync(async () => {
      await insertFinalPRRecords(db, records);
    });
  }

  return records;
}

export async function getFinalPRsBySession(
  db: SQLiteDatabase,
  sessionId: string,
): Promise<ExercisePRWithExercise[]> {
  return db.getAllAsync<ExercisePRWithExercise>(
    `SELECT prs.*, e.name AS exercise_name
       FROM exercise_prs prs
       JOIN exercises e ON e.id = prs.exercise_id
      WHERE prs.session_id = ?
      ORDER BY prs.achieved_at ASC, prs.record_type ASC`,
    [sessionId],
  );
}

export async function getFinalPRsByExercise(
  db: SQLiteDatabase,
  exerciseId: string,
): Promise<ExercisePR[]> {
  return db.getAllAsync<ExercisePR>(
    `SELECT *
       FROM exercise_prs
      WHERE exercise_id = ?
      ORDER BY achieved_at DESC`,
    [exerciseId],
  );
}
