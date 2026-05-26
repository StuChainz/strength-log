import {
  addRestTimerSeconds,
  getRestTimerRemainingSeconds,
  isRestTimerDone,
} from '@/domain/restTimer';

describe('rest timer domain helpers', () => {
  it('calculates remaining countdown time from start time and duration', () => {
    expect(
      getRestTimerRemainingSeconds({ durationSeconds: 90, startedAt: 1_000 }, 31_000),
    ).toBe(60);
  });

  it('never returns negative remaining time', () => {
    expect(
      getRestTimerRemainingSeconds({ durationSeconds: 60, startedAt: 1_000 }, 90_000),
    ).toBe(0);
    expect(isRestTimerDone({ durationSeconds: 60, startedAt: 1_000 }, 90_000)).toBe(true);
  });

  it('adds rest time without changing the original start time', () => {
    const timer = { durationSeconds: 60, startedAt: 1_000 };

    expect(addRestTimerSeconds(timer, 30)).toEqual({
      durationSeconds: 90,
      startedAt: 1_000,
    });
  });
});
