import { type SQLiteDatabase } from 'expo-sqlite';
import { type EventType, type WorkoutEvent } from '@/domain/types';

export interface InsertEventInput {
  id: string;
  session_id: string;
  event_type: EventType;
  payload_json: string;
  /** Idempotency key — allocate client-side before the DB call. */
  client_event_id: string;
}

/**
 * Append an event to the log. Idempotent via `client_event_id`.
 *
 * Uses INSERT OR IGNORE so that retries after a crash produce exactly one row.
 * NEVER update or delete rows from workout_events.
 */
export async function insertEvent(
  db: SQLiteDatabase,
  input: InsertEventInput,
): Promise<void> {
  await db.runAsync(
    `INSERT OR IGNORE INTO workout_events
       (id, session_id, event_type, payload_json, client_event_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [input.id, input.session_id, input.event_type, input.payload_json, input.client_event_id, Date.now()],
  );
}

export async function getEventsBySession(
  db: SQLiteDatabase,
  sessionId: string,
): Promise<WorkoutEvent[]> {
  return db.getAllAsync<WorkoutEvent>(
    'SELECT * FROM workout_events WHERE session_id = ? ORDER BY created_at ASC',
    [sessionId],
  );
}
