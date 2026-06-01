import { type SQLiteDatabase } from 'expo-sqlite';
import { type SetType, type Unit, type WorkoutSet } from '@/domain/types';
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
  set_type: SetType;
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
export async function insertSet(db: SQLiteDatabase, input: InsertSetInput): Promise<boolean> {
  const result = await db.runAsync(
    `INSERT OR IGNORE INTO workout_sets
       (id, session_id, exercise_id, position, weight, reps, rpe,
        unit, is_warmup, set_type, logged_at, source, client_set_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      input.set_type,
      input.logged_at,
      input.source,
      input.client_set_id,
    ],
  );
  return result.changes > 0;
}

export async function updateSet(
  db: SQLiteDatabase,
  id: string,
  fields: Partial<Pick<WorkoutSet, 'weight' | 'reps' | 'rpe' | 'unit' | 'set_type'>>,
): Promise<void> {
  const sets: string[] = [];
  const values: (number | string | null)[] = [];

  if (fields.weight !== undefined) {
    sets.push('weight = ?');
    values.push(fields.weight);
  }
  if (fields.reps !== undefined) {
    sets.push('reps = ?');
    values.push(fields.reps);
  }
  if (fields.rpe !== undefined) {
    sets.push('rpe = ?');
    values.push(fields.rpe);
  }
  if (fields.unit !== undefined) {
    sets.push('unit = ?');
    values.push(fields.unit);
  }
  if (fields.set_type !== undefined) {
    sets.push('set_type = ?', 'is_warmup = ?');
    values.push(fields.set_type, fields.set_type === 'warmup' ? 1 : 0);
  }
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
    'SELECT event_type, payload_json, created_at FROM workout_events WHERE session_id = ? ORDER BY created_at ASC, rowid ASC',
    [sessionId],
  );
  const eventSetIds = Array.from(
    new Set(
      events
        .filter((event) => event.event_type === 'set_added')
        .map((event) => (JSON.parse(event.payload_json) as SetAddedPayload).set_id),
    ),
  );

  await db.withTransactionAsync(async () => {
    if (eventSetIds.length === 0) {
      await db.runAsync('DELETE FROM workout_sets WHERE session_id = ?', [sessionId]);
    } else {
      await db.runAsync(
        `DELETE FROM workout_sets
          WHERE session_id = ?
            AND id NOT IN (${eventSetIds.map(() => '?').join(', ')})`,
        [sessionId, ...eventSetIds],
      );
    }

    for (const event of events) {
      if (event.event_type === 'set_added') {
        const p = JSON.parse(event.payload_json) as SetAddedPayload;
        const setType = p.set_type ?? (p.is_warmup === 1 ? 'warmup' : 'working');
        await db.runAsync(
          `INSERT INTO workout_sets
             (id, session_id, exercise_id, position, weight, reps, rpe,
              unit, is_warmup, set_type, logged_at, source, client_set_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             session_id = excluded.session_id,
             exercise_id = excluded.exercise_id,
             position = excluded.position,
             weight = excluded.weight,
             reps = excluded.reps,
             rpe = excluded.rpe,
             unit = excluded.unit,
             is_warmup = excluded.is_warmup,
             set_type = excluded.set_type,
             logged_at = excluded.logged_at,
             source = excluded.source,
             client_set_id = excluded.client_set_id,
             deleted_at = NULL`,
          [
            p.set_id,
            sessionId,
            p.exercise_id,
            p.position,
            p.weight,
            p.reps,
            p.rpe,
            p.unit,
            setType === 'warmup' ? 1 : 0,
            setType,
            p.logged_at,
            p.source,
            p.client_set_id,
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
        if (p.weight !== undefined) {
          setClauses.push('weight = ?');
          values.push(p.weight);
        }
        if (p.reps !== undefined) {
          setClauses.push('reps = ?');
          values.push(p.reps);
        }
        if (p.rpe !== undefined) {
          setClauses.push('rpe = ?');
          values.push(p.rpe);
        }
        if (p.unit !== undefined) {
          setClauses.push('unit = ?');
          values.push(p.unit);
        }
        if (p.set_type !== undefined) {
          setClauses.push('set_type = ?', 'is_warmup = ?');
          values.push(p.set_type, p.set_type === 'warmup' ? 1 : 0);
        }
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
