import { type SQLiteDatabase } from 'expo-sqlite';
import { calculateSessionVolume } from '@/domain/volume';
import type { WorkoutSession, WorkoutSet } from '@/domain/types';

export interface WorkoutSummary {
  session: WorkoutSession;
  setCount: number;
  volume: number;
  durationMin: number;
  prCount: number;
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

  const endedAt = session.ended_at ?? Date.now();
  return {
    session,
    setCount: sets.length,
    volume: calculateSessionVolume(sets),
    durationMin: Math.max(0, Math.round((endedAt - session.started_at) / 60000)),
    prCount: 0,
  };
}
