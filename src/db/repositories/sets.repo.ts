import { type SQLiteDatabase } from 'expo-sqlite';
import { type Unit, type WorkoutSet } from '@/domain/types';
import type { SetAddedPayload, SetEditedPayload, SetDeletedPayload } from '@/domain/events';

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

export async function softDeleteSet(
  db: SQLiteDatabase,
  id: string,
  deletedAt = Date.now(),
): Promise<void> {
  await db.runAsync('UPDATE workout_sets SET deleted_at = ? WHERE id = ?', [deletedAt, id]);
}

export async function rebuildSets(db: SQLiteDatabase, sessionId: string): Promise<void> {
  const events = await db.getAllAsync<{
    event_type: string;
    payload_json: string;
    created_at: number;
  }>(
    'SELECT event_type, payload_json, created_at FROM workout_events WHERE session_id = ? ORDER BY created_at ASC',
    [sessionId],
  );

  await db.withTransactionAsync(async () => {
    for (const event of events) {
      if (event.event_type === 'set_added') {
        const p = JSON.parse(event.payload_json) as SetAddedPayload;
        await db.runAsync(
          `INSERT OR IGNORE INTO workout_sets
             (id, session_id, exercise_id, position, weight, reps, rpe,
              unit, is_warmup, logged_at, source, client_set_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            p.set_id, sessionId, p.exercise_id, p.position,
            p.weight, p.reps, p.rpe, p.unit, p.is_warmup,
            p.logged_at, p.source, p.client_set_id,
          ],
        );
      } else if (event.event_type === 'set_deleted') {
        const p = JSON.parse(event.payload_json) as SetDeletedPayload;
        await db.runAsync(
          `UPDATE workout_sets SET deleted_at = ? WHERE id = ? AND deleted_at IS NULL`,
          [event.created_at, p.set_id],
        );
      } else if (event.event_type === 'set_edited') {
        const p = JSON.parse(event.payload_json) as SetEditedPayload;
        const setClauses: string[] = [];
        const values: (number | string | null)[] = [];
        if (p.weight !== undefined) { setClauses.push('weight = ?'); values.push(p.weight); }
        if (p.reps !== undefined) { setClauses.push('reps = ?'); values.push(p.reps); }
        if (p.rpe !== undefined) { setClauses.push('rpe = ?'); values.push(p.rpe); }
        if (p.unit !== undefined) { setClauses.push('unit = ?'); values.push(p.unit); }
        if (setClauses.length > 0) {
          values.push(p.set_id);
          await db.runAsync(
            `UPDATE workout_sets SET ${setClauses.join(', ')} WHERE id = ?`,
            values,
          );
        }
      }
    }
  });
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
