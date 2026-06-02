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
): Pick<ExerciseMetadataView, 'exercise_id' | 'primary_muscles' | 'secondary_muscles'> {
  return {
    exercise_id: exerciseId,
    primary_muscles: primaryMuscles,
    secondary_muscles: secondaryMuscles,
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
): TrainingVolumeExposureSet {
  const setType = overrides.set_type ?? 'working';

  return {
    exercise_id: exerciseId,
    exercise_name: exerciseName,
    primary_muscles: primaryMuscles,
    secondary_muscles: secondaryMuscles,
    set_type: setType,
    is_warmup: overrides.is_warmup ?? (setType === 'warmup' ? 1 : 0),
    deleted_at: overrides.deleted_at ?? null,
  };
}

describe('training volume exposure calculations', () => {
  it('calculates direct and indirect set counts without secondary weighting', () => {
    const exposure = calculateTrainingVolumeMuscleExposure([
      exposureSet('bench', 'Bench Press', ['chest'], ['triceps', 'front_delts']),
      exposureSet('bench', 'Bench Press', ['chest'], ['triceps', 'front_delts']),
      exposureSet('bench', 'Bench Press', ['chest'], ['triceps', 'front_delts']),
    ]);

    expect(exposure).toEqual([
      {
        muscle: 'chest',
        totalExposure: 3,
        directSets: 3,
        indirectSets: 0,
        directSources: [{ exercise_id: 'bench', exercise_name: 'Bench Press', sets: 3 }],
        indirectSources: [],
      },
      {
        muscle: 'front_delts',
        totalExposure: 3,
        directSets: 0,
        indirectSets: 3,
        directSources: [],
        indirectSources: [{ exercise_id: 'bench', exercise_name: 'Bench Press', sets: 3 }],
      },
      {
        muscle: 'triceps',
        totalExposure: 3,
        directSets: 0,
        indirectSets: 3,
        directSources: [],
        indirectSources: [{ exercise_id: 'bench', exercise_name: 'Bench Press', sets: 3 }],
      },
    ]);
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
      ['triceps', 5],
      ['chest', 2],
    ]);
    expect(exposure.find((row) => row.muscle === 'triceps')).toMatchObject({
      directSets: 3,
      indirectSets: 2,
      directSources: [{ exercise_id: 'pushdown', exercise_name: 'Pushdown', sets: 3 }],
      indirectSources: [{ exercise_id: 'bench', exercise_name: 'Bench Press', sets: 2 }],
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
      ['forearms', 1],
    ]);
  });

  it('handles empty history safely', () => {
    expect(calculateTrainingVolumeMuscleExposure([])).toEqual([]);
  });
});
