import { getProgressionSuggestion, type ProgressionInput } from '@/domain/progression';

const baseTarget = {
  targetSets: 3,
  targetReps: 5,
  targetWeight: 80,
  unit: 'kg' as const,
};

const baseSet = {
  weight: 80,
  reps: 5,
  rpe: 8,
  unit: 'kg' as const,
  set_type: 'working' as const,
};

function suggestion(input: Partial<ProgressionInput>) {
  return getProgressionSuggestion({
    exercise: {
      category: 'barbell',
      movementPattern: 'horizontal_push',
      bodyRegion: 'upper_body',
      mechanics: 'compound',
      equipment: ['barbell'],
    },
    templateTarget: baseTarget,
    progressionRule: { rule: 'none' },
    recentSets: [],
    previousSessionSets: [],
    ...input,
  });
}

describe('getProgressionSuggestion', () => {
  it('linear rule adds 2.5kg for upper body compounds when target hit', () => {
    const next = suggestion({
      progressionRule: { rule: 'linear' },
      recentSets: [
        { ...baseSet, rpe: 8 },
        { ...baseSet, rpe: 8 },
        { ...baseSet, rpe: 8 },
      ],
    });

    expect(next).toEqual(
      expect.objectContaining({
        weight: 82.5,
        reps: 5,
        source: 'template_rule',
        rule: 'linear',
      }),
    );
  });

  it('linear rule adds 5kg for squat/deadlift/hinge lower compounds when target hit', () => {
    const next = suggestion({
      exercise: {
        category: 'barbell',
        movementPattern: 'hinge',
        bodyRegion: 'lower_body',
        mechanics: 'compound',
        equipment: ['barbell'],
      },
      progressionRule: { rule: 'linear' },
      recentSets: [baseSet, baseSet, baseSet],
    });

    expect(next.weight).toBe(85);
  });

  it('linear rule repeats target when target missed', () => {
    const next = suggestion({
      progressionRule: { rule: 'linear' },
      recentSets: [baseSet, { ...baseSet, reps: 4 }, baseSet],
    });

    expect(next).toEqual(expect.objectContaining({ weight: 80, reps: 5, reason: 'Repeat target' }));
  });

  it('linear rule repeats target when last set RPE is over 8.5', () => {
    const next = suggestion({
      progressionRule: { rule: 'linear' },
      recentSets: [baseSet, baseSet, { ...baseSet, rpe: 9 }],
    });

    expect(next).toEqual(
      expect.objectContaining({ weight: 80, reps: 5, reason: 'Linear: high effort' }),
    );
  });

  it('double progression builds reps within range', () => {
    const next = suggestion({
      templateTarget: { ...baseTarget, targetReps: null, targetWeight: 20 },
      progressionRule: { rule: 'double', repRangeMin: 8, repRangeMax: 12 },
      recentSets: [
        { ...baseSet, weight: 20, reps: 10 },
        { ...baseSet, weight: 20, reps: 9 },
        { ...baseSet, weight: 20, reps: 8 },
      ],
    });

    expect(next).toEqual(
      expect.objectContaining({ weight: 20, reps: 9, reason: 'Double: build reps' }),
    );
  });

  it('double progression adds weight and resets reps after all sets hit rep range max', () => {
    const next = suggestion({
      templateTarget: { ...baseTarget, targetReps: null, targetWeight: 20 },
      progressionRule: { rule: 'double', repRangeMin: 8, repRangeMax: 12 },
      recentSets: [
        { ...baseSet, weight: 20, reps: 12 },
        { ...baseSet, weight: 20, reps: 12 },
        { ...baseSet, weight: 20, reps: 12 },
      ],
    });

    expect(next).toEqual(
      expect.objectContaining({ weight: 22.5, reps: 8, reason: 'Double: top of range hit' }),
    );
  });

  it('double progression does not exceed rep range max', () => {
    const next = suggestion({
      templateTarget: { ...baseTarget, targetReps: null, targetWeight: 20 },
      progressionRule: { rule: 'double', repRangeMin: 8, repRangeMax: 12 },
      recentSets: [
        { ...baseSet, weight: 20, reps: 12 },
        { ...baseSet, weight: 20, reps: 11 },
        { ...baseSet, weight: 20, reps: 12 },
      ],
    });

    expect(next.reps).toBe(12);
  });

  it('double progression handles poor performance safely', () => {
    const next = suggestion({
      templateTarget: { ...baseTarget, targetReps: null, targetWeight: 20 },
      progressionRule: { rule: 'double', repRangeMin: 8, repRangeMax: 12 },
      recentSets: [
        { ...baseSet, weight: 20, reps: 7 },
        { ...baseSet, weight: 20, reps: 6 },
        { ...baseSet, weight: 20, reps: 5 },
      ],
    });

    expect(next).toEqual(
      expect.objectContaining({ weight: 20, reps: 5, reason: 'Double: build reps' }),
    );
  });

  it('RPE-gated progresses when easy', () => {
    const next = suggestion({
      progressionRule: { rule: 'rpe_gated' },
      recentSets: [
        { ...baseSet, rpe: 7 },
        { ...baseSet, rpe: 7 },
        { ...baseSet, rpe: 7 },
      ],
    });

    expect(next).toEqual(
      expect.objectContaining({ weight: 82.5, reps: 5, reason: 'RPE easy: add weight' }),
    );
  });

  it('RPE-gated repeats when moderate', () => {
    const next = suggestion({
      progressionRule: { rule: 'rpe_gated' },
      recentSets: [
        { ...baseSet, rpe: 8 },
        { ...baseSet, rpe: 8 },
        { ...baseSet, rpe: 8 },
      ],
    });

    expect(next).toEqual(
      expect.objectContaining({ weight: 80, reps: 5, reason: 'RPE moderate: repeat target' }),
    );
  });

  it('RPE-gated repeats when RPE is high', () => {
    const next = suggestion({
      progressionRule: { rule: 'rpe_gated', rpeCap: 8.5 },
      recentSets: [baseSet, baseSet, { ...baseSet, rpe: 9 }],
    });

    expect(next).toEqual(
      expect.objectContaining({ weight: 80, reps: 5, reason: 'RPE high: repeat target' }),
    );
  });

  it('RPE-gated reduces weight after two missed targets', () => {
    const next = suggestion({
      progressionRule: { rule: 'rpe_gated' },
      recentSets: [baseSet, { ...baseSet, reps: 4 }, baseSet],
      previousSessionSets: [baseSet, { ...baseSet, reps: 4 }, baseSet],
    });

    expect(next).toEqual(
      expect.objectContaining({ weight: 72, reps: 5, reason: 'RPE: missed twice' }),
    );
  });

  it('none rule falls back to the existing conservative suggestion', () => {
    const next = suggestion({
      progressionRule: { rule: 'none' },
      recentSets: [{ ...baseSet, reps: 5, rpe: 9 }],
    });

    expect(next).toEqual(
      expect.objectContaining({
        weight: 80,
        reps: 4,
        source: 'fallback',
        rule: 'none',
      }),
    );
  });

  it('suggestions never auto-apply in domain logic', () => {
    const set = { ...baseSet };
    const next = suggestion({
      progressionRule: { rule: 'linear' },
      recentSets: [set, set, set],
    });

    expect(set).toEqual(baseSet);
    expect(next).not.toHaveProperty('apply');
  });

  it('live suggestion can use previous completed session before current-session sets exist', () => {
    const next = suggestion({
      templateTarget: { targetSets: null, targetReps: null, targetWeight: null, unit: 'kg' },
      recentSets: [{ ...baseSet, weight: 100, reps: 5, rpe: 7 }],
      currentSessionSets: [],
    });

    expect(next).toEqual(
      expect.objectContaining({
        weight: 102.5,
        reps: 5,
        reason: 'Progress after easy set',
      }),
    );
  });

  it('live suggestion uses current-session sets over previous completed session', () => {
    const next = suggestion({
      templateTarget: { ...baseTarget, targetWeight: 100 },
      recentSets: [{ ...baseSet, weight: 100, reps: 3 }],
      currentSessionSets: [{ ...baseSet, weight: 100, reps: 5 }],
    });

    expect(next).toEqual(
      expect.objectContaining({
        weight: 100,
        reps: 5,
        reason: 'Continue plan',
        source: 'current_session',
      }),
    );
  });

  it('live suggestion clears stale previous missed-rep reasoning after current hit', () => {
    const next = suggestion({
      templateTarget: { ...baseTarget, targetWeight: 100 },
      recentSets: [{ ...baseSet, weight: 100, reps: 4 }],
      previousSessionSets: [{ ...baseSet, weight: 100, reps: 4 }],
      currentSessionSets: [{ ...baseSet, weight: 100, reps: 5 }],
    });

    expect(next.reason).toBe('Continue plan');
    expect(next.reason).not.toMatch(/Back off|missed/i);
  });

  it('live suggestion keeps target weight and explains exceeded reps', () => {
    const next = suggestion({
      templateTarget: { ...baseTarget, targetWeight: 100 },
      progressionRule: { rule: 'linear' },
      recentSets: [{ ...baseSet, weight: 100, reps: 4 }],
      currentSessionSets: [{ ...baseSet, weight: 100, reps: 15 }],
    });

    expect(next).toEqual(
      expect.objectContaining({
        weight: 100,
        reps: 5,
        reason: 'Target exceeded',
        source: 'current_session',
      }),
    );
  });

  it('live suggestion repeats target after one current-session miss', () => {
    const next = suggestion({
      templateTarget: { ...baseTarget, targetWeight: 100 },
      currentSessionSets: [{ ...baseSet, weight: 100, reps: 4 }],
    });

    expect(next).toEqual(
      expect.objectContaining({
        weight: 100,
        reps: 5,
        reason: 'Repeat target',
      }),
    );
  });

  it('live suggestion ignores deleted current-session sets', () => {
    const next = suggestion({
      templateTarget: { ...baseTarget, targetWeight: 100 },
      recentSets: [{ ...baseSet, weight: 100, reps: 4 }],
      currentSessionSets: [{ ...baseSet, weight: 100, reps: 15, deleted_at: 123 }],
    });

    expect(next).toEqual(
      expect.objectContaining({
        weight: 100,
        reps: 5,
        reason: 'Continue plan',
        source: 'template_rule',
      }),
    );
  });

  it('live suggestion ignores warm-up sets and includes drop sets', () => {
    const warmupOnly = suggestion({
      templateTarget: { ...baseTarget, targetWeight: 100 },
      currentSessionSets: [{ ...baseSet, weight: 100, reps: 15, set_type: 'warmup', is_warmup: 1 }],
    });
    const withDrop = suggestion({
      templateTarget: { ...baseTarget, targetWeight: 100 },
      currentSessionSets: [
        { ...baseSet, weight: 100, reps: 15, set_type: 'warmup', is_warmup: 1 },
        { ...baseSet, weight: 100, reps: 15, set_type: 'drop', is_warmup: 0 },
      ],
    });

    expect(warmupOnly).toEqual(
      expect.objectContaining({ reason: 'Continue plan', source: 'template_rule' }),
    );
    expect(withDrop).toEqual(
      expect.objectContaining({ reason: 'Target exceeded', source: 'current_session' }),
    );
  });
});
