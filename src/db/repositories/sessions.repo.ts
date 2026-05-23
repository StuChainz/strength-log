import { type SQLiteDatabase } from 'expo-sqlite';
import { type WorkoutSession } from '@/domain/types';
import { newId } from '@/domain/ids';
import type {
  SessionStartedPayload,
  SessionEndedPayload,
  SessionDiscardedPayload,
} from '@/domain/events';

export async function getInProgressSession(
  db: SQLiteDatabase,
): Promise<WorkoutSession | null> {
  const sessions = await db.getAllAsync<WorkoutSession>(
    "SELECT * FROM workout_sessions WHERE status = 'in_progress' ORDER BY started_at DESC",
  );
  const [newest, ...older] = sessions;

  for (const session of older) {
    await discardSession(db, session.id);
  }

  return newest ?? null;
}

export async function getSessionById(
  db: SQLiteDatabase,
  id: string,
): Promise<WorkoutSession | null> {
  return db.getFirstAsync<WorkoutSession>('SELECT * FROM workout_sessions WHERE id = ?', [id]);
}

export async function createSession(
  db: SQLiteDatabase,
  data: { templateId: string | null; name: string | null },
): Promise<WorkoutSession> {
  const id = newId();
  const now = Date.now();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO workout_sessions
         (id, template_id, name, status, started_at, ended_at, total_volume_cached, created_at, updated_at)
       VALUES (?, ?, ?, 'in_progress', ?, NULL, NULL, ?, ?)`,
      [id, data.templateId, data.name, now, now, now],
    );
    const payload: SessionStartedPayload = { template_id: data.templateId, name: data.name };
    await db.runAsync(
      `INSERT OR IGNORE INTO workout_events
         (id, session_id, event_type, payload_json, client_event_id, created_at)
       VALUES (?, ?, 'session_started', ?, ?, ?)`,
      [newId(), id, JSON.stringify(payload), newId(), now],
    );
  });

  return {
    id,
    template_id: data.templateId,
    name: data.name,
    status: 'in_progress',
    started_at: now,
    ended_at: null,
    total_volume_cached: null,
    created_at: now,
    updated_at: now,
  };
}

export async function endSession(
  db: SQLiteDatabase,
  sessionId: string,
  totalVolume: number | null = null,
): Promise<void> {
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE workout_sessions
          SET status = 'completed', ended_at = ?, total_volume_cached = ?, updated_at = ?
        WHERE id = ?`,
      [now, totalVolume, now, sessionId],
    );
    const payload: SessionEndedPayload = { ended_at: now, total_volume: totalVolume };
    await db.runAsync(
      `INSERT OR IGNORE INTO workout_events
         (id, session_id, event_type, payload_json, client_event_id, created_at)
       VALUES (?, ?, 'session_ended', ?, ?, ?)`,
      [newId(), sessionId, JSON.stringify(payload), newId(), now],
    );
  });
}

export async function discardSession(db: SQLiteDatabase, sessionId: string): Promise<void> {
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE workout_sessions SET status = 'discarded', ended_at = ?, updated_at = ? WHERE id = ?`,
      [now, now, sessionId],
    );
    const payload: SessionDiscardedPayload = { discarded_at: now };
    await db.runAsync(
      `INSERT OR IGNORE INTO workout_events
         (id, session_id, event_type, payload_json, client_event_id, created_at)
       VALUES (?, ?, 'session_discarded', ?, ?, ?)`,
      [newId(), sessionId, JSON.stringify(payload), newId(), now],
    );
  });
}
