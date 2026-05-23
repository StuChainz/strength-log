import { type SQLiteDatabase } from 'expo-sqlite';
import { newId } from '@/domain/ids';

export const SESSION_TAGS = [
  'sleep_short',
  'sleep_long',
  'stressed',
  'sore',
  'fasted',
  'caffeinated',
  'ill',
  'traveled',
  'alcohol_prev_night',
  'evening_session',
  'morning_session',
  'felt_strong',
  'felt_weak',
] as const;

export type SessionTag = (typeof SESSION_TAGS)[number];

export interface SessionSummaryMetrics {
  volume: number;
  durationMin: number;
  setCount: number;
  sampledAt: number;
}

export interface SavePostSessionInput {
  sessionId: string;
  tags: SessionTag[];
  energyRating: number | null;
  note: string | null;
  metrics: SessionSummaryMetrics;
}

export async function getSavedTags(db: SQLiteDatabase, sessionId: string): Promise<SessionTag[]> {
  const rows = await db.getAllAsync<{ tag: SessionTag }>(
    'SELECT tag FROM post_session_tags WHERE session_id = ? ORDER BY tag ASC',
    [sessionId],
  );
  return rows.map((row) => row.tag);
}

export async function hasPostSessionTags(
  db: SQLiteDatabase,
  sessionId: string,
): Promise<boolean> {
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count
       FROM post_session_tags
      WHERE session_id = ?`,
    [sessionId],
  );
  return (row?.count ?? 0) > 0;
}

export async function getUntaggedCompletedSession(
  db: SQLiteDatabase,
): Promise<{ id: string; ended_at: number | null } | null> {
  return db.getFirstAsync<{ id: string; ended_at: number | null }>(
    `SELECT sess.id, sess.ended_at
      FROM workout_sessions sess
      WHERE sess.status = 'completed'
        AND NOT EXISTS (
          SELECT 1 FROM session_notes notes WHERE notes.session_id = sess.id
        )
      ORDER BY sess.ended_at DESC
      LIMIT 1`,
  );
}

export async function savePostSessionDetails(
  db: SQLiteDatabase,
  input: SavePostSessionInput,
): Promise<void> {
  const now = Date.now();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM post_session_tags WHERE session_id = ?', [input.sessionId]);
    for (const tag of input.tags) {
      await db.runAsync(
        `INSERT OR IGNORE INTO post_session_tags (id, session_id, tag, created_at)
         VALUES (?, ?, ?, ?)`,
        [newId(), input.sessionId, tag, now],
      );
    }

    await db.runAsync(
      `INSERT OR REPLACE INTO session_notes
         (session_id, energy_rating, note, updated_at)
       VALUES (?, ?, ?, ?)`,
      [input.sessionId, input.energyRating, input.note, now],
    );

    await db.runAsync(
      `DELETE FROM metric_samples
        WHERE sampled_at = ?
          AND (
            metric_key IN ('session_volume', 'session_duration_min', 'session_set_count', 'energy_rating')
            OR metric_key LIKE 'tag.%'
          )`,
      [input.metrics.sampledAt],
    );

    const metricRows = [
      { key: 'session_volume', value: input.metrics.volume, source: 'workout' },
      { key: 'session_duration_min', value: input.metrics.durationMin, source: 'workout' },
      { key: 'session_set_count', value: input.metrics.setCount, source: 'workout' },
      ...(input.energyRating !== null
        ? [{ key: 'energy_rating', value: input.energyRating, source: 'user_tag' }]
        : []),
      ...input.tags.map((tag) => ({
        key: `tag.${tag}`,
        value: 1,
        source: 'user_tag',
      })),
    ];

    for (const metric of metricRows) {
      await db.runAsync(
        `INSERT INTO metric_samples
           (id, metric_key, value_num, value_text, sampled_at, source, created_at)
         VALUES (?, ?, ?, NULL, ?, ?, ?)`,
        [newId(), metric.key, metric.value, input.metrics.sampledAt, metric.source, now],
      );
    }
  });
}
