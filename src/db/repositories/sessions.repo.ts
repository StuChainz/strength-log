// Phase 5 — Live workout runner
// Stub: types and signatures only. Implementation added in Phase 5.
import { type SQLiteDatabase } from 'expo-sqlite';
import { type WorkoutSession } from '@/domain/types';

export async function getInProgressSession(
  db: SQLiteDatabase,
): Promise<WorkoutSession | null> {
  return db.getFirstAsync<WorkoutSession>(
    "SELECT * FROM workout_sessions WHERE status = 'in_progress' LIMIT 1",
  );
}

export async function getSessionById(
  db: SQLiteDatabase,
  id: string,
): Promise<WorkoutSession | null> {
  return db.getFirstAsync<WorkoutSession>('SELECT * FROM workout_sessions WHERE id = ?', [id]);
}
