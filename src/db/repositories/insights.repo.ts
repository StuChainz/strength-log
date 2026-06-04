import { type SQLiteDatabase } from 'expo-sqlite';
import { newId } from '@/domain/ids';
import {
  canRunWeeklyInsight,
  generateWeeklyInsight,
  weekStartMonday,
  type InsightSession,
} from '@/insights/generator';
import { TRAILING_WINDOW_WEEKS } from '@/insights/thresholds';
import type { WeeklyInsightCard } from '@/domain/types';

interface InsightRow {
  id: string;
  started_at: number;
  total_volume_cached: number | null;
  energy_rating: number | null;
  tags: string | null;
}

export async function getLatestInsightCard(db: SQLiteDatabase): Promise<WeeklyInsightCard | null> {
  return db.getFirstAsync<WeeklyInsightCard>(
    `SELECT * FROM weekly_insight_cards
      WHERE dismissed_at IS NULL
      ORDER BY generated_for_week_start DESC
      LIMIT 1`,
  );
}

export async function getAllInsightCards(db: SQLiteDatabase): Promise<WeeklyInsightCard[]> {
  return db.getAllAsync<WeeklyInsightCard>(
    `SELECT * FROM weekly_insight_cards
      ORDER BY generated_for_week_start DESC`,
  );
}

export async function dismissInsightCard(
  db: SQLiteDatabase,
  cardId: string,
  dismissedAt = Date.now(),
): Promise<void> {
  await db.runAsync('UPDATE weekly_insight_cards SET dismissed_at = ? WHERE id = ?', [
    dismissedAt,
    cardId,
  ]);
}

async function loadInsightSessions(db: SQLiteDatabase, since: number): Promise<InsightSession[]> {
  const rows = await db.getAllAsync<InsightRow>(
    `SELECT sess.id, sess.started_at, sess.total_volume_cached, notes.energy_rating,
            GROUP_CONCAT(tags.tag) AS tags
       FROM workout_sessions sess
       LEFT JOIN session_notes notes ON notes.session_id = sess.id
       LEFT JOIN post_session_tags tags ON tags.session_id = sess.id
      WHERE sess.status = 'completed'
        AND sess.started_at >= ?
      GROUP BY sess.id
      ORDER BY sess.started_at ASC`,
    [since],
  );

  return rows.map((row) => ({
    id: row.id,
    startedAt: row.started_at,
    tags: row.tags ? row.tags.split(',') : [],
    metrics: {
      session_volume: row.total_volume_cached,
      energy_rating: row.energy_rating,
    },
  }));
}

export async function maybeGenerateWeeklyInsight(
  db: SQLiteDatabase,
  now = Date.now(),
): Promise<WeeklyInsightCard | null> {
  if (!canRunWeeklyInsight(now)) return getLatestInsightCard(db);

  const weekStart = weekStartMonday(now);
  const existing = await db.getFirstAsync<WeeklyInsightCard>(
    'SELECT * FROM weekly_insight_cards WHERE generated_for_week_start = ?',
    [weekStart],
  );
  if (existing) return existing.dismissed_at ? null : existing;

  const since = weekStart - TRAILING_WINDOW_WEEKS * 7 * 24 * 60 * 60 * 1000;
  const sessions = await loadInsightSessions(db, since);
  const generated = generateWeeklyInsight(sessions, weekStart);
  if (!generated) return null;

  const id = newId();
  const createdAt = Date.now();
  await db.runAsync(
    `INSERT INTO weekly_insight_cards
       (id, generated_for_week_start, title, body, sample_size,
        confidence_label, payload_json, dismissed_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
    [
      id,
      generated.generatedForWeekStart,
      generated.title,
      generated.body,
      generated.sampleSize,
      generated.confidenceLabel,
      JSON.stringify(generated.payload),
      createdAt,
    ],
  );

  return getLatestInsightCard(db);
}
