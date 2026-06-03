import {
  calculateSessionMuscleSummary,
  calculateTrainingVolumeMuscleExposure,
  type SessionMuscleSummary,
  type TrainingVolumeExposureSet,
} from '@/domain/sessionMuscles';
import type { ExerciseMetadataView, MuscleGroup, SessionStatus } from '@/domain/types';

function session(status: SessionStatus = 'completed'): { status: SessionStatus } {
  return { status };
}

function set(
  exerciseId: string,
  overrides: Partial<{
    set_type: 'warmup' | 'working' | 'drop';
    is_warmup: 0 | 1;
    deleted_at: number | null;
  }> = {},
): {
  exercise_id: string;
  set_type: 'warmup' | 'working' | 'drop';
  is_warmup: 0 | 1;
  deleted_at: number | null;
} {
  const setType = overrides.set_type ?? 'working';

  return {
    exercise_id: exerciseId,
    set_type: setType,
    is_warmup: overrides.is_warmup ?? (setType === 'warmup' ? 1 : 0),
    deleted_at: overrides.deleted_at ?? null,
  };
}

function metadata(
  exerciseId: string,
  primaryMuscles: MuscleGroup[],
  secondaryMuscles: MuscleGroup[] = [],
  tertiaryMuscles: MuscleGroup[] = [],
): Pick<
  ExerciseMetadataView,
  'exercise_id' | 'primary_muscles' | 'secondary_muscles' | 'tertiary_muscles'
> {
  return {
    exercise_id: exerciseId,
    primary_muscles: primaryMuscles,
    secondary_muscles: secondaryMuscles,
    tertiary_muscles: tertiaryMuscles,
  };
}

describe('session muscle calculations', () => {
  it('calculates a single exercise session correctly', () => {
    const summary = calculateSessionMuscleSummary(
      session(),
      [set('bench'), set('bench'), set('bench')],
      [metadata('bench', ['chest'], ['front_delts', 'triceps'])],
    );

    expect(summary).toEqual<SessionMuscleSummary>({
      chest: 3,
      front_delts: 1.5,
      triceps: 1.5,
    });
  });

  it('aggregates a multi-exercise session correctly', () => {
    const summary = calculateSessionMuscleSummary(
      session(),
      [set('bench'), set('bench'), set('row'), set('row'), set('row')],
      [
        metadata('bench', ['chest'], ['front_delts', 'triceps']),
        metadata('row', ['upper_back'], ['biceps']),
      ],
    );

    expect(summary).toEqual<SessionMuscleSummary>({
      chest: 2,
      upper_back: 3,
      front_delts: 1,
      biceps: 1.5,
      triceps: 1,
    });
  });

  it('applies secondary muscle weighting', () => {
    const summary = calculateSessionMuscleSummary(
      session(),
      [set('press'), set('press')],
      [metadata('press', ['front_delts'], ['triceps'])],
    );

    expect(summary).toEqual<SessionMuscleSummary>({
      front_delts: 2,
      triceps: 1,
    });
  });

  it('applies tertiary muscle weighting', () => {
    const summary = calculateSessionMuscleSummary(
      session(),
      [set('squat'), set('squat'), set('squat'), set('squat')],
      [metadata('squat', ['quads'], ['glutes'], ['hamstrings'])],
    );

    expect(summary).toEqual<SessionMuscleSummary>({
      quads: 4,
      glutes: 2,
      hamstrings: 1,
    });
  });

  it('excludes warmup sets', () => {
    const summary = calculateSessionMuscleSummary(
      session(),
      [set('squat', { set_type: 'warmup' }), set('squat')],
      [metadata('squat', ['quads'], ['glutes'])],
    );

    expect(summary).toEqual<SessionMuscleSummary>({
      glutes: 0.5,
      quads: 1,
    });
  });

  it('excludes deleted sets', () => {
    const summary = calculateSessionMuscleSummary(
      session(),
      [set('curl'), set('curl', { deleted_at: 123 })],
      [metadata('curl', ['biceps'], ['forearms'])],
    );

    expect(summary).toEqual<SessionMuscleSummary>({
      biceps: 1,
      forearms: 0.5,
    });
  });

  it('returns an empty summary for empty sessions', () => {
    expect(calculateSessionMuscleSummary(session(), [], [])).toEqual({});
  });

  it('returns an empty summary for discarded sessions', () => {
    const summary = calculateSessionMuscleSummary(
      session('discarded'),
      [set('bench')],
      [metadata('bench', ['chest'], ['triceps'])],
    );

    expect(summary).toEqual({});
  });
});

function exposureSet(
  exerciseId: string,
  exerciseName: string,
  primaryMuscles: MuscleGroup[],
  secondaryMuscles: MuscleGroup[] = [],
  overrides: Partial<{
    set_type: 'warmup' | 'working' | 'drop';
    is_warmup: 0 | 1;
    deleted_at: number | null;
  }> = {},
  tertiaryMuscles: MuscleGroup[] = [],
): TrainingVolumeExposureSet {
  const setType = overrides.set_type ?? 'working';

  return {
    exercise_id: exerciseId,
    exercise_name: exerciseName,
    primary_muscles: primaryMuscles,
    secondary_muscles: secondaryMuscles,
    tertiary_muscles: tertiaryMuscles,
    set_type: setType,
    is_warmup: overrides.is_warmup ?? (setType === 'warmup' ? 1 : 0),
    deleted_at: overrides.deleted_at ?? null,
  };
}

describe('training volume exposure calculations', () => {
  it('counts primary muscles as 1.0 effective set per counted set', () => {
    const exposure = calculateTrainingVolumeMuscleExposure([
      exposureSet('curl', 'Curl', ['biceps']),
      exposureSet('curl', 'Curl', ['biceps']),
      exposureSet('curl', 'Curl', ['biceps']),
    ]);

    expect(exposure).toEqual([
      {
        muscle: 'biceps',
        totalExposure: 3,
        directContribution: 3,
        indirectContribution: 0,
        directSources: [{ exercise_id: 'curl', exercise_name: 'Curl', contribution: 3 }],
        indirectSources: [],
      },
    ]);
  });

  it('counts secondary muscles as 0.5 effective set per counted set', () => {
    const exposure = calculateTrainingVolumeMuscleExposure([
      exposureSet('bench', 'Bench Press', ['chest'], ['triceps', 'front_delts']),
      exposureSet('bench', 'Bench Press', ['chest'], ['triceps', 'front_delts']),
      exposureSet('bench', 'Bench Press', ['chest'], ['triceps', 'front_delts']),
    ]);

    expect(exposure).toEqual([
      {
        muscle: 'chest',
        totalExposure: 3,
        directContribution: 3,
        indirectContribution: 0,
        directSources: [{ exercise_id: 'bench', exercise_name: 'Bench Press', contribution: 3 }],
        indirectSources: [],
      },
      {
        muscle: 'front_delts',
        totalExposure: 1.5,
        directContribution: 0,
        indirectContribution: 1.5,
        directSources: [],
        indirectSources: [
          { exercise_id: 'bench', exercise_name: 'Bench Press', contribution: 1.5 },
        ],
      },
      {
        muscle: 'triceps',
        totalExposure: 1.5,
        directContribution: 0,
        indirectContribution: 1.5,
        directSources: [],
        indirectSources: [
          { exercise_id: 'bench', exercise_name: 'Bench Press', contribution: 1.5 },
        ],
      },
    ]);
  });

  it('counts tertiary muscles as 0.25 effective set per counted set', () => {
    const exposure = calculateTrainingVolumeMuscleExposure([
      exposureSet('squat', 'Back Squat', ['quads'], ['glutes'], {}, ['hamstrings']),
      exposureSet('squat', 'Back Squat', ['quads'], ['glutes'], {}, ['hamstrings']),
      exposureSet('squat', 'Back Squat', ['quads'], ['glutes'], {}, ['hamstrings']),
      exposureSet('squat', 'Back Squat', ['quads'], ['glutes'], {}, ['hamstrings']),
    ]);

    expect(exposure.find((row) => row.muscle === 'hamstrings')).toMatchObject({
      totalExposure: 1,
      directContribution: 0,
      indirectContribution: 1,
      directSources: [],
      indirectSources: [{ exercise_id: 'squat', exercise_name: 'Back Squat', contribution: 1 }],
    });
  });

  it('aggregates multiple workouts and ranks by total exposure', () => {
    const exposure = calculateTrainingVolumeMuscleExposure([
      exposureSet('bench', 'Bench Press', ['chest'], ['triceps']),
      exposureSet('bench', 'Bench Press', ['chest'], ['triceps']),
      exposureSet('pushdown', 'Pushdown', ['triceps']),
      exposureSet('pushdown', 'Pushdown', ['triceps']),
      exposureSet('pushdown', 'Pushdown', ['triceps']),
    ]);

    expect(exposure.map((row) => [row.muscle, row.totalExposure])).toEqual([
      ['triceps', 4],
      ['chest', 2],
    ]);
    expect(exposure.find((row) => row.muscle === 'triceps')).toMatchObject({
      directContribution: 3,
      indirectContribution: 1,
      directSources: [{ exercise_id: 'pushdown', exercise_name: 'Pushdown', contribution: 3 }],
      indirectSources: [{ exercise_id: 'bench', exercise_name: 'Bench Press', contribution: 1 }],
    });
  });

  it('separates direct and indirect contributions and sources', () => {
    const exposure = calculateTrainingVolumeMuscleExposure([
      exposureSet('leg-curl', 'Lying Leg Curl', ['hamstrings']),
      exposureSet('leg-curl', 'Lying Leg Curl', ['hamstrings']),
      exposureSet('leg-curl', 'Lying Leg Curl', ['hamstrings']),
      exposureSet('leg-curl', 'Lying Leg Curl', ['hamstrings']),
      exposureSet('leg-curl', 'Lying Leg Curl', ['hamstrings']),
      exposureSet('deadlift', 'Barbell Deadlift', ['hamstrings', 'glutes']),
      exposureSet('squat', 'Barbell Back Squat', ['quads'], ['glutes'], {}, ['hamstrings']),
      exposureSet('squat', 'Barbell Back Squat', ['quads'], ['glutes'], {}, ['hamstrings']),
      exposureSet('squat', 'Barbell Back Squat', ['quads'], ['glutes'], {}, ['hamstrings']),
      exposureSet('squat', 'Barbell Back Squat', ['quads'], ['glutes'], {}, ['hamstrings']),
      exposureSet('leg-press', 'Leg Press', ['quads'], [], {}, ['hamstrings']),
      exposureSet('leg-press', 'Leg Press', ['quads'], [], {}, ['hamstrings']),
      exposureSet('leg-press', 'Leg Press', ['quads'], [], {}, ['hamstrings']),
      exposureSet('leg-press', 'Leg Press', ['quads'], [], {}, ['hamstrings']),
    ]);

    expect(exposure.find((row) => row.muscle === 'hamstrings')).toMatchObject({
      totalExposure: 8,
      directContribution: 6,
      indirectContribution: 2,
      directSources: [
        { exercise_id: 'leg-curl', exercise_name: 'Lying Leg Curl', contribution: 5 },
        { exercise_id: 'deadlift', exercise_name: 'Barbell Deadlift', contribution: 1 },
      ],
      indirectSources: [
        { exercise_id: 'squat', exercise_name: 'Barbell Back Squat', contribution: 1 },
        { exercise_id: 'leg-press', exercise_name: 'Leg Press', contribution: 1 },
      ],
    });
  });

  it('ignores warmup and deleted sets for exposure', () => {
    const exposure = calculateTrainingVolumeMuscleExposure([
      exposureSet('curl', 'Curl', ['biceps'], ['forearms'], { set_type: 'warmup' }),
      exposureSet('curl', 'Curl', ['biceps'], ['forearms'], { deleted_at: 123 }),
      exposureSet('curl', 'Curl', ['biceps'], ['forearms']),
    ]);

    expect(exposure.map((row) => [row.muscle, row.totalExposure])).toEqual([
      ['biceps', 1],
      ['forearms', 0.5],
    ]);
  });

  it('handles empty history safely', () => {
    expect(calculateTrainingVolumeMuscleExposure([])).toEqual([]);
  });
});
