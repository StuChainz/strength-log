import { getProgressionSuggestion } from '@/domain/progression';

const baseSet = {
  weight: 80,
  reps: 5,
  rpe: 8,
  unit: 'kg' as const,
};

describe('getProgressionSuggestion', () => {
  it('returns no suggestion without history', () => {
    expect(getProgressionSuggestion({
      category: 'barbell',
      targetReps: 5,
      lastSet: null,
    }).label).toBe('No suggestion yet.');
  });

  it('adds 2.5kg for barbell work when RPE is low and reps hit target', () => {
    const next = getProgressionSuggestion({
      category: 'barbell',
      targetReps: 5,
      lastSet: { ...baseSet, rpe: 7 },
    });

    expect(next.weight).toBe(82.5);
    expect(next.reps).toBe(5);
  });

  it('adds 1kg for dumbbell work when RPE is low and reps hit target', () => {
    const next = getProgressionSuggestion({
      category: 'dumbbell',
      targetReps: 5,
      lastSet: { ...baseSet, rpe: 6 },
    });

    expect(next.weight).toBe(81);
  });

  it('keeps weight and reps when RPE is moderate', () => {
    const next = getProgressionSuggestion({
      category: 'barbell',
      targetReps: 5,
      lastSet: { ...baseSet, rpe: 8.5 },
    });

    expect(next.weight).toBe(80);
    expect(next.reps).toBe(5);
  });

  it('keeps weight and drops one rep when RPE is high', () => {
    const next = getProgressionSuggestion({
      category: 'barbell',
      targetReps: 5,
      lastSet: { ...baseSet, rpe: 9 },
    });

    expect(next.weight).toBe(80);
    expect(next.reps).toBe(4);
  });

  it('keeps weight and drops one rep when target reps were missed once', () => {
    const next = getProgressionSuggestion({
      category: 'barbell',
      targetReps: 6,
      lastSet: { ...baseSet, reps: 5, rpe: 8 },
      previousSet: { ...baseSet, reps: 6, rpe: 8 },
    });

    expect(next.weight).toBe(80);
    expect(next.reps).toBe(4);
  });

  it('drops ten percent when target reps were missed twice in a row', () => {
    const next = getProgressionSuggestion({
      category: 'barbell',
      targetReps: 6,
      lastSet: { ...baseSet, reps: 5, rpe: 8 },
      previousSet: { ...baseSet, reps: 4, rpe: 8 },
    });

    expect(next.weight).toBe(72);
    expect(next.reps).toBe(5);
  });
});
