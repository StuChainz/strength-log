import { type SQLiteDatabase } from 'expo-sqlite';
import {
  calculateTrainingVolumeMuscleExposure,
  type TrainingVolumeExposureSet,
  type TrainingVolumeMuscleExposure,
} from '@/domain/sessionMuscles';
import type { MuscleGroup, SetType } from '@/domain/types';

const DAY_MS = 24 * 60 * 60 * 1000;

export const TRAINING_VOLUME_WINDOWS = {
  last7Days: {
    id: '7d',
    title: 'Training Volume (Last 7 Days)',
    label: '7D',
    days: 7,
  },
  last14Days: {
    id: '14d',
    title: 'Training Volume (Last 14 Days)',
    label: '14D',
    days: 14,
  },
  last30Days: {
    id: '30d',
    title: 'Training Volume (Last 30 Days)',
    label: '30D',
    days: 30,
  },
  last90Days: {
    id: '90d',
    title: 'Training Volume (Last 90 Days)',
    label: '90D',
    days: 90,
  },
} as const;

export type TrainingVolumeWindow =
  (typeof TRAINING_VOLUME_WINDOWS)[keyof typeof TRAINING_VOLUME_WINDOWS];

export const TRAINING_VOLUME_WINDOW_OPTIONS: TrainingVolumeWindow[] = [
  TRAINING_VOLUME_WINDOWS.last7Days,
  TRAINING_VOLUME_WINDOWS.last14Days,
  TRAINING_VOLUME_WINDOWS.last30Days,
  TRAINING_VOLUME_WINDOWS.last90Days,
];

export interface RollingTrainingVolumeWindow {
  id: TrainingVolumeWindow['id'];
  title: TrainingVolumeWindow['title'];
  label: TrainingVolumeWindow['label'];
  days: number;
  startAt: number;
  endAt: number;
}

export interface TrainingVolumeReport {
  window: RollingTrainingVolumeWindow;
  muscles: TrainingVolumeMuscleExposure[];
}

interface TrainingVolumeSetRow {
  exercise_id: string;
  exercise_name: string;
  set_type: SetType;
  is_warmup: 0 | 1;
  deleted_at: number | null;
  primary_muscles_json: string | null;
  secondary_muscles_json: string | null;
}

export function getRollingTrainingVolumeWindow(
  now = Date.now(),
  window: TrainingVolumeWindow = TRAINING_VOLUME_WINDOWS.last7Days,
): RollingTrainingVolumeWindow {
  return {
    id: window.id,
    title: window.title,
    label: window.label,
    days: window.days,
    startAt: now - window.days * DAY_MS,
    endAt: now,
  };
}

export async function getTrainingVolumeReport(
  db: SQLiteDatabase,
  options: {
    now?: number;
    window?: TrainingVolumeWindow;
  } = {},
): Promise<TrainingVolumeReport> {
  const window = getRollingTrainingVolumeWindow(options.now, options.window);
  const rows = await db.getAllAsync<TrainingVolumeSetRow>(
    `SELECT ws.exercise_id,
            e.name AS exercise_name,
            ws.set_type,
            ws.is_warmup,
            ws.deleted_at,
            em.primary_muscles_json,
            em.secondary_muscles_json
       FROM workout_sets ws
       JOIN workout_sessions sess ON sess.id = ws.session_id
       JOIN exercises e ON e.id = ws.exercise_id
       LEFT JOIN exercise_metadata em ON em.exercise_id = ws.exercise_id
      WHERE sess.status = 'completed'
        AND sess.started_at >= ?
        AND sess.started_at <= ?
        AND ws.deleted_at IS NULL
        AND ws.set_type != 'warmup'
        AND ws.is_warmup = 0
      ORDER BY sess.started_at DESC, ws.position ASC`,
    [window.startAt, window.endAt],
  );

  return {
    window,
    muscles: calculateTrainingVolumeMuscleExposure(rows.map(toExposureSet)),
  };
}

function toExposureSet(row: TrainingVolumeSetRow): TrainingVolumeExposureSet {
  return {
    exercise_id: row.exercise_id,
    exercise_name: row.exercise_name,
    set_type: row.set_type,
    is_warmup: row.is_warmup,
    deleted_at: row.deleted_at,
    primary_muscles: parseMuscleArray(row.primary_muscles_json),
    secondary_muscles: parseMuscleArray(row.secondary_muscles_json),
  };
}

function parseMuscleArray(json: string | null): MuscleGroup[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is MuscleGroup => typeof value === 'string')
      : [];
  } catch {
    return [];
  }
}
