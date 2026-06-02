import { type SQLiteDatabase } from 'expo-sqlite';
import { getFinalPRsBySession, type ExercisePRWithExercise } from './prs.repo';
import {
  calculateSessionMuscleSummary,
  type ExerciseMuscleMetadata,
  type SessionMuscleSummary,
} from '@/domain/sessionMuscles';
import { calculateSessionVolume } from '@/domain/volume';
import type { MuscleGroup, WorkoutSession, WorkoutSet } from '@/domain/types';

export interface WorkoutSummary {
  session: WorkoutSession;
  setCount: number;
  volume: number;
  durationMin: number;
  prCount: number;
  prs: ExercisePRWithExercise[];
  muscleSummary: SessionMuscleSummary;
}

export async function getWorkoutSummary(
  db: SQLiteDatabase,
  sessionId: string,
): Promise<WorkoutSummary | null> {
  const session = await db.getFirstAsync<WorkoutSession>(
    'SELECT * FROM workout_sessions WHERE id = ?',
    [sessionId],
  );
  if (!session) return null;

  const sets = await db.getAllAsync<WorkoutSet>(
    `SELECT * FROM workout_sets
      WHERE session_id = ?
        AND deleted_at IS NULL`,
    [sessionId],
  );
  const prs = await getFinalPRsBySession(db, sessionId);
  const exerciseMetadata = await getSessionExerciseMuscleMetadata(db, sets);

  const endedAt = session.ended_at ?? Date.now();
  return {
    session,
    setCount: sets.length,
    volume: calculateSessionVolume(sets),
    durationMin: Math.max(0, Math.round((endedAt - session.started_at) / 60000)),
    prCount: prs.length,
    prs,
    muscleSummary: calculateSessionMuscleSummary(session, sets, exerciseMetadata),
  };
}

async function getSessionExerciseMuscleMetadata(
  db: SQLiteDatabase,
  sets: WorkoutSet[],
): Promise<ExerciseMuscleMetadata[]> {
  const exerciseIds = [...new Set(sets.map((set) => set.exercise_id))];
  if (exerciseIds.length === 0) return [];

  try {
    const rows = await db.getAllAsync<{
      exercise_id: string;
      primary_muscles_json: string | null;
      secondary_muscles_json: string | null;
    }>(
      `SELECT exercise_id, primary_muscles_json, secondary_muscles_json
       FROM exercise_metadata
       WHERE exercise_id IN (${exerciseIds.map(() => '?').join(',')})`,
      exerciseIds,
    );

    return rows.map((row) => ({
      exercise_id: row.exercise_id,
      primary_muscles: parseMuscleArray(row.primary_muscles_json),
      secondary_muscles: parseMuscleArray(row.secondary_muscles_json),
    }));
  } catch (error) {
    if (!isMissingMetadataTableError(error)) throw error;
    return [];
  }
}

function parseMuscleArray(json: string | null): MuscleGroup[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is MuscleGroup => typeof value === 'string')
      : [];
  } catch {
    return [];
  }
}

function isMissingMetadataTableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /no such table: .*exercise_metadata/i.test(message);
}
