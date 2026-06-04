import { type SQLiteDatabase } from 'expo-sqlite';
import type { TrainingDashboardSession } from '@/domain/trainingDashboard';

export interface TrainingDashboardData {
  sessions: TrainingDashboardSession[];
}

interface TrainingDashboardSessionRow {
  id: string;
  session_name: string | null;
  template_name: string | null;
  started_at: number;
  completed_at: number;
  duration_min: number | null;
  set_count: number;
  total_volume: number | null;
  cached_volume: number | null;
  pr_count: number;
  energy_rating: number | null;
}

export async function getTrainingDashboardData(db: SQLiteDatabase): Promise<TrainingDashboardData> {
  const rows = await db.getAllAsync<TrainingDashboardSessionRow>(
    `WITH set_totals AS (
        SELECT session_id,
               COUNT(id) AS set_count,
               COALESCE(SUM(COALESCE(weight, 0) * COALESCE(reps, 0)), 0) AS total_volume
          FROM workout_sets
         WHERE deleted_at IS NULL
           AND is_warmup = 0
           AND COALESCE(set_type, 'working') != 'warmup'
         GROUP BY session_id
       ),
       pr_totals AS (
        SELECT session_id, COUNT(id) AS pr_count
          FROM exercise_prs
         GROUP BY session_id
       )
     SELECT sess.id,
            sess.name AS session_name,
            tpl.name AS template_name,
            sess.started_at,
            COALESCE(sess.ended_at, sess.started_at) AS completed_at,
            CASE
              WHEN sess.ended_at IS NULL THEN NULL
              ELSE ROUND((sess.ended_at - sess.started_at) / 60000.0)
            END AS duration_min,
            COALESCE(set_totals.set_count, 0) AS set_count,
            COALESCE(set_totals.total_volume, 0) AS total_volume,
            sess.total_volume_cached AS cached_volume,
            COALESCE(pr_totals.pr_count, 0) AS pr_count,
            notes.energy_rating
       FROM workout_sessions sess
       LEFT JOIN templates tpl ON tpl.id = sess.template_id
       LEFT JOIN set_totals ON set_totals.session_id = sess.id
       LEFT JOIN pr_totals ON pr_totals.session_id = sess.id
       LEFT JOIN session_notes notes ON notes.session_id = sess.id
      WHERE sess.status = 'completed'
      ORDER BY completed_at DESC`,
  );

  return {
    sessions: rows.map((row) => ({
      id: row.id,
      name: row.session_name,
      templateName: row.template_name,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      durationMin: row.duration_min,
      setCount: row.set_count,
      totalVolume: row.total_volume ?? row.cached_volume ?? 0,
      prCount: row.pr_count,
      energyRating: row.energy_rating,
    })),
  };
}
