import { type SQLiteDatabase } from 'expo-sqlite';
import { calculateSessionVolume, estimateOneRepMax } from '@/domain/volume';
import type { Unit, WorkoutSet } from '@/domain/types';

export interface HistorySet {
  id: string;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  unit: Unit;
  logged_at: number;
  position: number;
}

export interface ExerciseHistorySession {
  sessionId: string;
  startedAt: number;
  endedAt: number | null;
  sets: HistorySet[];
  volume: number;
  topSetWeight: number | null;
  topSetReps: number | null;
  est1rm: number | null;
}

interface HistoryRow {
  session_id: string;
  started_at: number;
  ended_at: number | null;
  set_id: string;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  unit: Unit;
  logged_at: number;
  position: number;
}

function topSet(sets: HistorySet[]): HistorySet | null {
  const scored = sets
    .filter((set) => set.weight !== null && set.reps !== null)
    .sort((a, b) => {
      const aScore = estimateOneRepMax(a.weight, a.reps) ?? a.weight ?? 0;
      const bScore = estimateOneRepMax(b.weight, b.reps) ?? b.weight ?? 0;
      return bScore - aScore;
    });
  return scored[0] ?? null;
}

function toHistorySessions(rows: HistoryRow[]): ExerciseHistorySession[] {
  const bySession = new Map<string, ExerciseHistorySession>();

  for (const row of rows) {
    let session = bySession.get(row.session_id);
    if (!session) {
      session = {
        sessionId: row.session_id,
        startedAt: row.started_at,
        endedAt: row.ended_at,
        sets: [],
        volume: 0,
        topSetWeight: null,
        topSetReps: null,
        est1rm: null,
      };
      bySession.set(row.session_id, session);
    }

    session.sets.push({
      id: row.set_id,
      weight: row.weight,
      reps: row.reps,
      rpe: row.rpe,
      unit: row.unit,
      logged_at: row.logged_at,
      position: row.position,
    });
  }

  return Array.from(bySession.values()).map((session) => {
    const sets = [...session.sets].sort((a, b) => a.position - b.position);
    const top = topSet(sets);
    return {
      ...session,
      sets,
      volume: calculateSessionVolume(sets),
      topSetWeight: top?.weight ?? null,
      topSetReps: top?.reps ?? null,
      est1rm: top ? estimateOneRepMax(top.weight, top.reps) : null,
    };
  });
}

export async function getExerciseHistory(
  db: SQLiteDatabase,
  exerciseId: string,
  limit = 5,
): Promise<ExerciseHistorySession[]> {
  const rows = await db.getAllAsync<HistoryRow>(
    `SELECT sess.id AS session_id, sess.started_at, sess.ended_at,
            ws.id AS set_id, ws.weight, ws.reps, ws.rpe, ws.unit,
            ws.logged_at, ws.position
       FROM workout_sets ws
       JOIN workout_sessions sess ON sess.id = ws.session_id
      WHERE ws.exercise_id = ?
        AND ws.deleted_at IS NULL
        AND sess.status = 'completed'
        AND sess.id IN (
          SELECT DISTINCT ws2.session_id
            FROM workout_sets ws2
            JOIN workout_sessions sess2 ON sess2.id = ws2.session_id
           WHERE ws2.exercise_id = ?
             AND ws2.deleted_at IS NULL
             AND sess2.status = 'completed'
           ORDER BY sess2.started_at DESC
           LIMIT ?
        )
      ORDER BY sess.started_at DESC, ws.position ASC`,
    [exerciseId, exerciseId, limit],
  );

  return toHistorySessions(rows);
}

export async function updateExerciseHistoryCache(
  db: SQLiteDatabase,
  exerciseId: string,
): Promise<void> {
  const history = await getExerciseHistory(db, exerciseId, 5);
  const latest = history[0] ?? null;
  await db.runAsync(
    `INSERT OR REPLACE INTO exercise_history_cache
       (exercise_id, last_session_id, last_session_at, last_top_set_weight,
        last_top_set_reps, last_session_volume, est_1rm, recent_sessions_json, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      exerciseId,
      latest?.sessionId ?? null,
      latest?.startedAt ?? null,
      latest?.topSetWeight ?? null,
      latest?.topSetReps ?? null,
      latest?.volume ?? null,
      latest?.est1rm ?? null,
      JSON.stringify(history),
      Date.now(),
    ],
  );
}

export async function updateSessionExerciseHistoryCache(
  db: SQLiteDatabase,
  sessionId: string,
): Promise<void> {
  const rows = await db.getAllAsync<Pick<WorkoutSet, 'exercise_id'>>(
    `SELECT DISTINCT exercise_id
       FROM workout_sets
      WHERE session_id = ?
        AND deleted_at IS NULL`,
    [sessionId],
  );

  for (const row of rows) {
    await updateExerciseHistoryCache(db, row.exercise_id);
  }
}
