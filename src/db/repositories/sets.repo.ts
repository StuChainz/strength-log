import { type SQLiteDatabase } from 'expo-sqlite';
import { type Unit, type WorkoutSet } from '@/domain/types';

export interface InsertSetInput {
  id: string;
  session_id: string;
  exercise_id: string;
  position: number;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  unit: Unit;
  is_warmup: 0 | 1;
  logged_at: number;
  source: 'tap' | 'voice';
  /** Idempotency key — allocate client-side before the DB call. */
  client_set_id: string;
}

/**
 * Insert a set. Idempotent via `client_set_id`.
 *
 * Uses INSERT OR IGNORE so that retries after a crash produce exactly one row.
 * To edit a set, write a `set_edited` event then call `updateSet`.
 */
export async function insertSet(db: SQLiteDatabase, input: InsertSetInput): Promise<void> {
  await db.runAsync(
    `INSERT OR IGNORE INTO workout_sets
       (id, session_id, exercise_id, position, weight, reps, rpe,
        unit, is_warmup, logged_at, source, client_set_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.id,
      input.session_id,
      input.exercise_id,
      input.position,
      input.weight,
      input.reps,
      input.rpe,
      input.unit,
      input.is_warmup,
      input.logged_at,
      input.source,
      input.client_set_id,
    ],
  );
}

export async function updateSet(
  db: SQLiteDatabase,
  id: string,
  fields: Partial<Pick<WorkoutSet, 'weight' | 'reps' | 'rpe' | 'unit'>>,
): Promise<void> {
  const sets: string[] = [];
  const values: (number | string | null)[] = [];

  if (fields.weight !== undefined) { sets.push('weight = ?'); values.push(fields.weight); }
  if (fields.reps !== undefined) { sets.push('reps = ?'); values.push(fields.reps); }
  if (fields.rpe !== undefined) { sets.push('rpe = ?'); values.push(fields.rpe); }
  if (fields.unit !== undefined) { sets.push('unit = ?'); values.push(fields.unit); }
  if (sets.length === 0) return;

  values.push(id);
  await db.runAsync(`UPDATE workout_sets SET ${sets.join(', ')} WHERE id = ?`, values);
}

export async function softDeleteSet(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('UPDATE workout_sets SET deleted_at = ? WHERE id = ?', [Date.now(), id]);
}

export async function getSetsBySession(
  db: SQLiteDatabase,
  sessionId: string,
): Promise<WorkoutSet[]> {
  return db.getAllAsync<WorkoutSet>(
    `SELECT * FROM workout_sets
     WHERE session_id = ? AND deleted_at IS NULL
     ORDER BY position ASC`,
    [sessionId],
  );
}
