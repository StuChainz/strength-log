import { buildNextTimePreview, type NextTimePreviewInput } from '@/domain/nextTimePreview';
import { getProgressionSuggestion } from '@/domain/progression';

const baseExercise = {
  category: 'barbell' as const,
  movementPattern: 'horizontal_push' as const,
  bodyRegion: 'upper_body' as const,
  mechanics: 'compound' as const,
  equipment: ['barbell'],
};

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
  is_warmup: 0 as const,
};

function preview(overrides: Partial<NextTimePreviewInput>) {
  const input: NextTimePreviewInput = {
    exerciseId: 'bench',
    exerciseName: 'Bench Press',
    exercise: baseExercise,
    templateTarget: baseTarget,
    progressionRule: { rule: 'none' },
    recentSets: [],
    previousSessionSets: [],
    ...overrides,
  };

  return {
    input,
    result: buildNextTimePreview(input),
    expectedSuggestion: getProgressionSuggestion({
      exercise: input.exercise,
      templateTarget: input.templateTarget,
      progressionRule: input.progressionRule,
      recentSets: input.recentSets,
      previousSessionSets: input.previousSessionSets,
    }),
  };
}

describe('buildNextTimePreview', () => {
  it('previews double progression by building reps before adding load', () => {
    const { result, expectedSuggestion } = preview({
      exerciseId: 'arnold-press',
      exerciseName: 'Arnold Press',
      exercise: {
        category: 'dumbbell',
        movementPattern: 'vertical_push',
        bodyRegion: 'upper_body',
        mechanics: 'compound',
        equipment: ['dumbbell'],
      },
      templateTarget: { targetSets: 3, targetReps: null, targetWeight: 40, unit: 'kg' },
      progressionRule: { rule: 'double', repRangeMin: 8, repRangeMax: 12 },
      recentSets: [
        { ...baseSet, weight: 40, reps: 10, rpe: null, logged_at: 1, position: 0 },
        { ...baseSet, weight: 40, reps: 10, rpe: null, logged_at: 2, position: 1 },
        { ...baseSet, weight: 40, reps: 10, rpe: null, logged_at: 3, position: 2 },
      ],
    });

    expect(result?.suggestion).toEqual(expectedSuggestion);
    expect(result).toEqual(
      expect.objectContaining({
        exerciseName: 'Arnold Press',
        bestSetLabel: '40 kg × 10',
        status: 'Double: build reps',
        nextTargetLabel: '40 kg × 11',
        reason: 'Double: build reps',
      }),
    );
  });

  it('previews RPE-gated recommendations from the engine', () => {
    const { result, expectedSuggestion } = preview({
      exerciseId: 'pause-squat',
      exerciseName: 'Pause Squat',
      exercise: {
        category: 'barbell',
        movementPattern: 'squat',
        bodyRegion: 'lower_body',
        mechanics: 'compound',
        equipment: ['barbell'],
      },
      templateTarget: { targetSets: 3, targetReps: 5, targetWeight: 100, unit: 'kg' },
      progressionRule: { rule: 'rpe_gated', rpeCap: 8.5 },
      recentSets: [
        { ...baseSet, weight: 100, reps: 5, rpe: 8, logged_at: 1, position: 0 },
        { ...baseSet, weight: 100, reps: 5, rpe: 8.5, logged_at: 2, position: 1 },
        { ...baseSet, weight: 100, reps: 5, rpe: 9, logged_at: 3, position: 2 },
      ],
    });

    expect(result?.suggestion).toEqual(expectedSuggestion);
    expect(result).toEqual(
      expect.objectContaining({
        bestSetLabel: '100 kg × 5 @ RPE 9',
        status: 'RPE high: repeat target',
        nextTargetLabel: '100 kg × 5',
        reason: 'RPE high: repeat target',
      }),
    );
  });

  it('previews deload recommendations from the engine', () => {
    const missedSet = { ...baseSet, reps: 4 };
    const { result, expectedSuggestion } = preview({
      progressionRule: { rule: 'linear', failureThreshold: 2 },
      recentSets: [
        { ...missedSet, logged_at: 1, position: 0 },
        { ...missedSet, logged_at: 2, position: 1 },
        { ...missedSet, logged_at: 3, position: 2 },
      ],
      previousSessionSets: [missedSet, missedSet, missedSet],
    });

    expect(result?.suggestion).toEqual(expectedSuggestion);
    expect(result).toEqual(
      expect.objectContaining({
        status: 'Linear: deload',
        nextTargetLabel: '72 kg × 5',
        reason: 'Linear: deload after 2 missed sessions',
      }),
    );
  });

  it('handles exercises without progression rules through the existing fallback', () => {
    const { result, expectedSuggestion } = preview({
      progressionRule: { rule: 'none' },
      recentSets: [{ ...baseSet, rpe: 8, logged_at: 1, position: 0 }],
    });

    expect(result?.suggestion).toEqual(expectedSuggestion);
    expect(result).toEqual(
      expect.objectContaining({
        status: 'No progression rule',
        source: 'fallback',
        nextTargetLabel: '80 kg × 5',
        reason: 'Repeat target',
      }),
    );
  });

  it('does not mutate input data while building the read-only preview', () => {
    const { input } = preview({
      progressionRule: { rule: 'linear', failureThreshold: 2 },
      recentSets: [baseSet, baseSet, baseSet],
      previousSessionSets: [baseSet, baseSet, baseSet],
    });
    const snapshot = JSON.parse(JSON.stringify(input));

    buildNextTimePreview(input);

    expect(input).toEqual(snapshot);
  });
});
