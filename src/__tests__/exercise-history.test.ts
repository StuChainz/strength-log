import {
  buildEstimated1RMGraphPoints,
  buildExerciseCalendarDays,
  buildVolumeGraphPoints,
  calculateExerciseEstimated1RM,
  calculateExerciseSessionVolume,
  getBestEstimated1RMForSession,
  getRecentExerciseSessions,
  toLocalDateKey,
} from '@/domain/exerciseHistory';

const dayMs = 24 * 60 * 60 * 1000;

function session(
  id: string,
  startedAt: number,
  sets: { weight: number | null; reps: number | null }[],
) {
  return { sessionId: id, startedAt, sets };
}

describe('Exercise History v2 domain helpers', () => {
  it('uses Epley for estimated 1RM', () => {
    expect(calculateExerciseEstimated1RM(100, 5)).toBeCloseTo(116.67, 2);
    expect(calculateExerciseEstimated1RM(90, 10)).toBe(120);
  });

  it('ignores sets over 10 reps for estimated 1RM', () => {
    expect(calculateExerciseEstimated1RM(100, 11)).toBeNull();
    expect(getBestEstimated1RMForSession([{ weight: 100, reps: 12 }])).toBeNull();
  });

  it('selects the best estimated 1RM per session', () => {
    expect(
      getBestEstimated1RMForSession([
        { weight: 100, reps: 3 },
        { weight: 90, reps: 10 },
        { weight: 200, reps: 12 },
      ]),
    ).toBe(120);
  });

  it('calculates volume per session', () => {
    expect(
      calculateExerciseSessionVolume([
        { weight: 100, reps: 5 },
        { weight: 80, reps: 8 },
        { weight: null, reps: 10 },
      ]),
    ).toBe(1140);
  });

  it('hides graph sections with insufficient data', () => {
    const oneSession = [session('s1', 1, [{ weight: 100, reps: 5 }])];

    expect(buildEstimated1RMGraphPoints(oneSession)).toEqual([]);
    expect(buildVolumeGraphPoints(oneSession)).toEqual([]);
  });

  it('marks only days where this exercise was performed', () => {
    const now = new Date(2026, 5, 4, 12).getTime();
    const trainedToday = now;
    const trainedLastWeek = now - 7 * dayMs;
    const outsideRange = now - 80 * dayMs;
    const days = buildExerciseCalendarDays(
      [
        session('today', trainedToday, [{ weight: 100, reps: 5 }]),
        session('last-week', trainedLastWeek, [{ weight: 100, reps: 5 }]),
        session('old', outsideRange, [{ weight: 100, reps: 5 }]),
      ],
      now,
      10,
    );
    const marked = days.filter((day) => day.marked).map((day) => day.dateKey);

    expect(marked).toEqual([toLocalDateKey(trainedLastWeek), toLocalDateKey(trainedToday)]);
  });

  it('keeps recent sessions capped at the last five without mutating input', () => {
    const sessions = Object.freeze(['s1', 's2', 's3', 's4', 's5', 's6']);

    expect(getRecentExerciseSessions(sessions)).toEqual(['s1', 's2', 's3', 's4', 's5']);
    expect(sessions).toEqual(['s1', 's2', 's3', 's4', 's5', 's6']);
  });

  it('does not mutate session data while building graph points', () => {
    const sessions = [
      session('new', 2, [{ weight: 100, reps: 5 }]),
      session('old', 1, [{ weight: 90, reps: 5 }]),
    ];
    const before = JSON.stringify(sessions);

    buildEstimated1RMGraphPoints(sessions);
    buildVolumeGraphPoints(sessions);

    expect(JSON.stringify(sessions)).toBe(before);
  });
});
