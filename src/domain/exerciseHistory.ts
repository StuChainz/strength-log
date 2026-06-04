import { calculateSessionVolume, estimateOneRepMax } from './volume';
import type { SetType } from './types';

export interface ExerciseHistorySetInput {
  weight: number | null;
  reps: number | null;
  set_type?: SetType;
}

export interface ExerciseHistorySessionInput {
  sessionId: string;
  startedAt: number;
  sets: readonly ExerciseHistorySetInput[];
}

export interface ExerciseHistoryPoint {
  sessionId: string;
  startedAt: number;
  value: number;
}

export interface ExerciseCalendarDay {
  dateKey: string;
  day: number;
  marked: boolean;
}

export function calculateExerciseEstimated1RM(
  weight: number | null,
  reps: number | null,
): number | null {
  return estimateOneRepMax(weight, reps);
}

export function getBestEstimated1RMForSession(
  sets: readonly ExerciseHistorySetInput[],
): number | null {
  return sets.reduce<number | null>((best, set) => {
    const estimate = calculateExerciseEstimated1RM(set.weight, set.reps);
    if (estimate === null) return best;
    return best === null || estimate > best ? estimate : best;
  }, null);
}

export function calculateExerciseSessionVolume(
  sets: readonly ExerciseHistorySetInput[],
): number {
  return calculateSessionVolume([...sets]);
}

export function getRecentExerciseSessions<T>(
  sessions: readonly T[],
  limit = 5,
): T[] {
  return sessions.slice(0, limit);
}

export function buildEstimated1RMGraphPoints(
  sessions: readonly ExerciseHistorySessionInput[],
): ExerciseHistoryPoint[] {
  const points = sessions
    .map((session) => {
      const value = getBestEstimated1RMForSession(session.sets);
      return value === null
        ? null
        : { sessionId: session.sessionId, startedAt: session.startedAt, value };
    })
    .filter((point): point is ExerciseHistoryPoint => point !== null)
    .sort((a, b) => a.startedAt - b.startedAt);

  return points.length >= 2 ? points : [];
}

export function buildVolumeGraphPoints(
  sessions: readonly ExerciseHistorySessionInput[],
): ExerciseHistoryPoint[] {
  const points = sessions
    .map((session) => ({
      sessionId: session.sessionId,
      startedAt: session.startedAt,
      value: calculateExerciseSessionVolume(session.sets),
    }))
    .filter((point) => point.value > 0)
    .sort((a, b) => a.startedAt - b.startedAt);

  return points.length >= 2 ? points : [];
}

export function toLocalDateKey(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfLocalDay(timestamp: number): number {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function buildExerciseCalendarDays(
  sessions: readonly ExerciseHistorySessionInput[],
  now = Date.now(),
  weeks = 10,
): ExerciseCalendarDay[] {
  const totalDays = weeks * 7;
  const todayStart = startOfLocalDay(now);
  const firstDayStart = todayStart - (totalDays - 1) * 24 * 60 * 60 * 1000;
  const sessionDateKeys = new Set(
    sessions
      .filter((session) => session.startedAt >= firstDayStart && session.startedAt <= now)
      .map((session) => toLocalDateKey(session.startedAt)),
  );

  return Array.from({ length: totalDays }, (_, index) => {
    const timestamp = firstDayStart + index * 24 * 60 * 60 * 1000;
    const date = new Date(timestamp);
    const dateKey = toLocalDateKey(timestamp);
    return {
      dateKey,
      day: date.getDate(),
      marked: sessionDateKeys.has(dateKey),
    };
  });
}
