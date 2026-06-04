export interface TrainingDashboardSession {
  id: string;
  name: string | null;
  templateName?: string | null;
  startedAt: number;
  completedAt: number;
  durationMin: number | null;
  setCount: number;
  totalVolume: number;
  prCount: number;
  energyRating: number | null;
}

export interface CalendarDayAggregate {
  dateKey: string;
  timestamp: number;
  sessionCount: number;
  totalVolume: number;
  sessions: TrainingDashboardSession[];
}

export interface HeatmapDay extends CalendarDayAggregate {
  inRange: boolean;
  intensity: number;
}

export interface WeeklySnapshot {
  weekStartKey: string;
  sessionsCompleted: number;
  totalSets: number;
  totalVolume: number;
  prCount: number;
  averageEnergy: number | null;
  previousWeek: {
    sessionsCompleted: number;
    totalSets: number;
    totalVolume: number;
    prCount: number;
    averageEnergy: number | null;
  } | null;
}

export interface ConsistencySummary {
  currentStreak: number;
  longestStreak: number;
  workoutsLast7Days: number;
  workoutsLast30Days: number;
}

export function getLocalDateKey(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseLocalDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
}

function startOfLocalDay(timestamp: number): number {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function addDays(timestamp: number, days: number): number {
  const date = new Date(timestamp);
  date.setDate(date.getDate() + days);
  return date.getTime();
}

function startOfWeek(timestamp: number): number {
  const start = new Date(startOfLocalDay(timestamp));
  const day = start.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + mondayOffset);
  return start.getTime();
}

export function aggregateCalendarDays(
  sessions: TrainingDashboardSession[],
): CalendarDayAggregate[] {
  const byDate = new Map<string, CalendarDayAggregate>();

  for (const session of sessions) {
    const dateKey = getLocalDateKey(session.completedAt);
    const existing = byDate.get(dateKey);
    if (existing) {
      existing.sessionCount += 1;
      existing.totalVolume += session.totalVolume;
      existing.sessions.push(session);
      continue;
    }

    byDate.set(dateKey, {
      dateKey,
      timestamp: startOfLocalDay(session.completedAt),
      sessionCount: 1,
      totalVolume: session.totalVolume,
      sessions: [session],
    });
  }

  return [...byDate.values()]
    .map((day) => ({
      ...day,
      sessions: [...day.sessions].sort((a, b) => b.completedAt - a.completedAt),
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

export function buildHeatmapWeeks(
  sessions: TrainingDashboardSession[],
  options: { now?: number; weekCount?: number } = {},
): HeatmapDay[][] {
  const now = options.now ?? Date.now();
  const weekCount = options.weekCount ?? 12;
  const aggregates = new Map(aggregateCalendarDays(sessions).map((day) => [day.dateKey, day]));
  const start = addDays(startOfWeek(now), -(weekCount - 1) * 7);
  const maxVolume = Math.max(...[...aggregates.values()].map((day) => day.totalVolume), 0);
  const maxSessions = Math.max(...[...aggregates.values()].map((day) => day.sessionCount), 0);

  return Array.from({ length: weekCount }, (_, weekIndex) =>
    Array.from({ length: 7 }, (_, dayIndex) => {
      const timestamp = addDays(start, weekIndex * 7 + dayIndex);
      const dateKey = getLocalDateKey(timestamp);
      const aggregate = aggregates.get(dateKey);
      const sessionIntensity =
        aggregate && maxSessions > 0 ? aggregate.sessionCount / maxSessions : 0;
      const volumeIntensity = aggregate && maxVolume > 0 ? aggregate.totalVolume / maxVolume : 0;
      const intensity =
        aggregate === undefined ? 0 : Math.max(0.25, Math.max(sessionIntensity, volumeIntensity));

      return {
        dateKey,
        timestamp,
        sessionCount: aggregate?.sessionCount ?? 0,
        totalVolume: aggregate?.totalVolume ?? 0,
        sessions: aggregate?.sessions ?? [],
        inRange: timestamp <= startOfLocalDay(now),
        intensity,
      };
    }),
  );
}

export function getSessionsForDate(
  sessions: TrainingDashboardSession[],
  dateKey: string,
): TrainingDashboardSession[] {
  return sessions
    .filter((session) => getLocalDateKey(session.completedAt) === dateKey)
    .sort((a, b) => b.completedAt - a.completedAt);
}

export function calculateWeeklySnapshot(
  sessions: TrainingDashboardSession[],
  now = Date.now(),
): WeeklySnapshot {
  const currentStart = startOfWeek(now);
  const nextStart = addDays(currentStart, 7);
  const previousStart = addDays(currentStart, -7);

  const current = summarizeWeek(
    sessions.filter(
      (session) => session.completedAt >= currentStart && session.completedAt < nextStart,
    ),
  );
  const previousSessions = sessions.filter(
    (session) => session.completedAt >= previousStart && session.completedAt < currentStart,
  );

  return {
    weekStartKey: getLocalDateKey(currentStart),
    ...current,
    previousWeek: previousSessions.length > 0 ? summarizeWeek(previousSessions) : null,
  };
}

function summarizeWeek(sessions: TrainingDashboardSession[]) {
  const energyRatings = sessions
    .map((session) => session.energyRating)
    .filter((value): value is number => value !== null);

  return {
    sessionsCompleted: sessions.length,
    totalSets: sessions.reduce((total, session) => total + session.setCount, 0),
    totalVolume: sessions.reduce((total, session) => total + session.totalVolume, 0),
    prCount: sessions.reduce((total, session) => total + session.prCount, 0),
    averageEnergy:
      energyRatings.length > 0
        ? energyRatings.reduce((total, value) => total + value, 0) / energyRatings.length
        : null,
  };
}

export function calculateConsistencySummary(
  sessions: TrainingDashboardSession[],
  now = Date.now(),
): ConsistencySummary {
  const trainedDays = new Set(sessions.map((session) => getLocalDateKey(session.completedAt)));
  const sortedDays = [...trainedDays].sort();
  const todayStart = startOfLocalDay(now);
  const last7Start = addDays(todayStart, -6);
  const last30Start = addDays(todayStart, -29);

  let currentStreak = 0;
  for (let day = todayStart; trainedDays.has(getLocalDateKey(day)); day = addDays(day, -1)) {
    currentStreak += 1;
  }

  let longestStreak = 0;
  let run = 0;
  let previousDateKey: string | null = null;
  for (const dateKey of sortedDays) {
    run =
      previousDateKey !== null &&
      getLocalDateKey(addDays(parseLocalDateKey(previousDateKey).getTime(), 1)) === dateKey
        ? run + 1
        : 1;
    longestStreak = Math.max(longestStreak, run);
    previousDateKey = dateKey;
  }

  return {
    currentStreak,
    longestStreak,
    workoutsLast7Days: sessions.filter((session) => session.completedAt >= last7Start).length,
    workoutsLast30Days: sessions.filter((session) => session.completedAt >= last30Start).length,
  };
}

export function buildRecentWorkoutDisplayModels(
  sessions: TrainingDashboardSession[],
  limit = 8,
): TrainingDashboardSession[] {
  return [...sessions].sort((a, b) => b.completedAt - a.completedAt).slice(0, limit);
}
