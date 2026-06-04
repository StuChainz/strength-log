import {
  aggregateCalendarDays,
  buildHeatmapWeeks,
  buildRecentWorkoutDisplayModels,
  calculateConsistencySummary,
  calculateWeeklySnapshot,
  getLocalDateKey,
  getSessionsForDate,
  type TrainingDashboardSession,
} from '@/domain/trainingDashboard';

function at(year: number, monthIndex: number, day: number, hour = 12): number {
  return new Date(year, monthIndex, day, hour).getTime();
}

function session(
  id: string,
  completedAt: number,
  overrides: Partial<TrainingDashboardSession> = {},
): TrainingDashboardSession {
  return {
    id,
    name: `Workout ${id}`,
    templateName: null,
    startedAt: completedAt - 45 * 60_000,
    completedAt,
    durationMin: 45,
    setCount: 4,
    totalVolume: 1000,
    prCount: 0,
    energyRating: null,
    ...overrides,
  };
}

describe('training dashboard domain helpers', () => {
  it('marks days with completed workouts and groups multiple workouts on one day', () => {
    const june2 = at(2026, 5, 2);
    const sessions = [
      session('a', june2, { totalVolume: 1000 }),
      session('b', at(2026, 5, 2, 18), { totalVolume: 1500 }),
      session('c', at(2026, 5, 3), { totalVolume: 500 }),
    ];

    const aggregates = aggregateCalendarDays(sessions);

    expect(aggregates).toHaveLength(2);
    expect(aggregates[0]).toMatchObject({
      dateKey: getLocalDateKey(june2),
      sessionCount: 2,
      totalVolume: 2500,
    });
    expect(aggregates[0]?.sessions.map((row) => row.id)).toEqual(['b', 'a']);
  });

  it('returns workouts for a selected calendar date', () => {
    const dateKey = getLocalDateKey(at(2026, 5, 2));
    const sessions = [
      session('a', at(2026, 5, 2, 10)),
      session('b', at(2026, 5, 2, 19)),
      session('c', at(2026, 5, 4)),
    ];

    expect(getSessionsForDate(sessions, dateKey).map((row) => row.id)).toEqual(['b', 'a']);
  });

  it('builds heatmap days with higher intensity for busier training days', () => {
    const sessions = [
      session('low', at(2026, 5, 1), { totalVolume: 500 }),
      session('high-1', at(2026, 5, 2), { totalVolume: 1000 }),
      session('high-2', at(2026, 5, 2, 18), { totalVolume: 2000 }),
    ];

    const days = buildHeatmapWeeks(sessions, { now: at(2026, 5, 7), weekCount: 1 }).flat();
    const low = days.find((day) => day.dateKey === getLocalDateKey(at(2026, 5, 1)));
    const high = days.find((day) => day.dateKey === getLocalDateKey(at(2026, 5, 2)));

    expect(low?.sessionCount).toBe(1);
    expect(high?.sessionCount).toBe(2);
    expect(high?.intensity).toBeGreaterThan(low?.intensity ?? 0);
  });

  it('calculates current week sessions, sets, volume, PRs, and energy safely', () => {
    const now = at(2026, 5, 4);
    const snapshot = calculateWeeklySnapshot(
      [
        session('current-1', at(2026, 5, 2), {
          setCount: 5,
          totalVolume: 2000,
          prCount: 1,
          energyRating: 7,
        }),
        session('current-2', at(2026, 5, 3), {
          setCount: 4,
          totalVolume: 1200,
          prCount: 2,
          energyRating: 9,
        }),
        session('previous', at(2026, 4, 28), {
          setCount: 3,
          totalVolume: 900,
          prCount: 0,
          energyRating: null,
        }),
      ],
      now,
    );

    expect(snapshot).toMatchObject({
      sessionsCompleted: 2,
      totalSets: 9,
      totalVolume: 3200,
      prCount: 3,
      averageEnergy: 8,
      previousWeek: {
        sessionsCompleted: 1,
        totalSets: 3,
        totalVolume: 900,
      },
    });
  });

  it('handles no previous week safely', () => {
    const snapshot = calculateWeeklySnapshot([session('current', at(2026, 5, 2))], at(2026, 5, 4));

    expect(snapshot.previousWeek).toBeNull();
  });

  it('shows recent completed session display models newest first with optional fields', () => {
    const recent = buildRecentWorkoutDisplayModels(
      [
        session('old', at(2026, 5, 1), {
          durationMin: 50,
          setCount: 5,
          totalVolume: 1500,
          prCount: 1,
          energyRating: 6,
        }),
        session('new', at(2026, 5, 3), {
          durationMin: 40,
          setCount: 6,
          totalVolume: 2200,
          prCount: 2,
          energyRating: 8,
        }),
      ],
      1,
    );

    expect(recent).toEqual([
      expect.objectContaining({
        id: 'new',
        durationMin: 40,
        setCount: 6,
        totalVolume: 2200,
        prCount: 2,
        energyRating: 8,
      }),
    ]);
  });

  it('calculates streaks, gaps, repeated workouts, and recent workout counts', () => {
    const now = at(2026, 5, 10);
    const summary = calculateConsistencySummary(
      [
        session('today-a', at(2026, 5, 10, 10)),
        session('today-b', at(2026, 5, 10, 18)),
        session('yesterday', at(2026, 5, 9)),
        session('gap-before-current', at(2026, 5, 7)),
        session('old-1', at(2026, 4, 1)),
        session('old-2', at(2026, 4, 2)),
        session('old-3', at(2026, 4, 3)),
      ],
      now,
    );

    expect(summary).toEqual({
      currentStreak: 2,
      longestStreak: 3,
      workoutsLast7Days: 4,
      workoutsLast30Days: 4,
    });
  });

  it('returns zero streaks when there are no completed workouts', () => {
    expect(calculateConsistencySummary([], at(2026, 5, 10))).toEqual({
      currentStreak: 0,
      longestStreak: 0,
      workoutsLast7Days: 0,
      workoutsLast30Days: 0,
    });
  });
});
