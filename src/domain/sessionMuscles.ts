import {
  MUSCLE_GROUPS,
  type ExerciseMetadataView,
  type MuscleGroup,
  type WorkoutSet,
  type WorkoutSession,
} from './types';

export type SessionMuscleSummary = Partial<Record<MuscleGroup, number>>;

export interface ExerciseMuscleContribution {
  exercise_id: string;
  exercise_name: string;
  sets: number;
}

export interface TrainingVolumeMuscleExposure {
  muscle: MuscleGroup;
  totalExposure: number;
  directSets: number;
  indirectSets: number;
  directSources: ExerciseMuscleContribution[];
  indirectSources: ExerciseMuscleContribution[];
}

export interface TrainingVolumeExposureSet extends SessionMuscleSet {
  exercise_name: string;
  primary_muscles: MuscleGroup[];
  secondary_muscles: MuscleGroup[];
}

export type SessionMuscleSet = Pick<WorkoutSet, 'exercise_id'> &
  Partial<Pick<WorkoutSet, 'set_type' | 'is_warmup' | 'deleted_at'>>;

export type ExerciseMuscleMetadata = Pick<
  ExerciseMetadataView,
  'exercise_id' | 'primary_muscles' | 'secondary_muscles'
>;

const PRIMARY_MUSCLE_CREDIT = 1;
const SECONDARY_MUSCLE_CREDIT = 0.5;

export function calculateSessionMuscleSummary(
  session: Pick<WorkoutSession, 'status'>,
  sets: SessionMuscleSet[],
  exerciseMetadata: ExerciseMuscleMetadata[],
): SessionMuscleSummary {
  if (session.status !== 'completed') return {};

  const metadataByExerciseId = new Map(
    exerciseMetadata.map((metadata) => [metadata.exercise_id, metadata]),
  );
  const totals = new Map<MuscleGroup, number>();

  for (const set of sets) {
    if (!isCountedWorkingSet(set)) continue;

    const metadata = metadataByExerciseId.get(set.exercise_id);
    if (!metadata) continue;

    const primaryMuscles = uniqueMuscles(metadata.primary_muscles);
    const primaryMuscleSet = new Set(primaryMuscles);

    for (const muscle of primaryMuscles) {
      addMuscleCredit(totals, muscle, PRIMARY_MUSCLE_CREDIT);
    }

    for (const muscle of uniqueMuscles(metadata.secondary_muscles)) {
      if (primaryMuscleSet.has(muscle)) continue;
      addMuscleCredit(totals, muscle, SECONDARY_MUSCLE_CREDIT);
    }
  }

  return toOrderedSummary(totals);
}

export function calculateTrainingVolumeMuscleExposure(
  sets: TrainingVolumeExposureSet[],
): TrainingVolumeMuscleExposure[] {
  const totals = new Map<
    MuscleGroup,
    {
      directSets: number;
      indirectSets: number;
      directSources: Map<string, ExerciseMuscleContribution>;
      indirectSources: Map<string, ExerciseMuscleContribution>;
    }
  >();

  for (const set of sets) {
    if (!isCountedWorkingSet(set)) continue;

    const primaryMuscles = uniqueMuscles(set.primary_muscles);
    const primaryMuscleSet = new Set(primaryMuscles);

    for (const muscle of primaryMuscles) {
      const entry = getExposureEntry(totals, muscle);
      entry.directSets += 1;
      addExerciseContribution(entry.directSources, set);
    }

    for (const muscle of uniqueMuscles(set.secondary_muscles)) {
      if (primaryMuscleSet.has(muscle)) continue;

      const entry = getExposureEntry(totals, muscle);
      entry.indirectSets += 1;
      addExerciseContribution(entry.indirectSources, set);
    }
  }

  return MUSCLE_GROUPS.map((muscle) => {
    const entry = totals.get(muscle);
    if (!entry) return null;

    const directSources = sortExerciseContributions(entry.directSources);
    const indirectSources = sortExerciseContributions(entry.indirectSources);

    return {
      muscle,
      totalExposure: entry.directSets + entry.indirectSets,
      directSets: entry.directSets,
      indirectSets: entry.indirectSets,
      directSources,
      indirectSources,
    };
  })
    .filter((entry): entry is TrainingVolumeMuscleExposure => entry !== null)
    .filter((entry) => entry.totalExposure > 0)
    .sort(
      (a, b) =>
        b.totalExposure - a.totalExposure ||
        MUSCLE_GROUPS.indexOf(a.muscle) - MUSCLE_GROUPS.indexOf(b.muscle),
    );
}

function isCountedWorkingSet(set: SessionMuscleSet): boolean {
  return (
    (set.deleted_at ?? null) === null &&
    (set.set_type ?? 'working') !== 'warmup' &&
    (set.is_warmup ?? 0) === 0
  );
}

function getExposureEntry(
  totals: Map<
    MuscleGroup,
    {
      directSets: number;
      indirectSets: number;
      directSources: Map<string, ExerciseMuscleContribution>;
      indirectSources: Map<string, ExerciseMuscleContribution>;
    }
  >,
  muscle: MuscleGroup,
) {
  let entry = totals.get(muscle);
  if (!entry) {
    entry = {
      directSets: 0,
      indirectSets: 0,
      directSources: new Map(),
      indirectSources: new Map(),
    };
    totals.set(muscle, entry);
  }
  return entry;
}

function addExerciseContribution(
  sources: Map<string, ExerciseMuscleContribution>,
  set: TrainingVolumeExposureSet,
): void {
  const current = sources.get(set.exercise_id);
  if (current) {
    current.sets += 1;
    return;
  }

  sources.set(set.exercise_id, {
    exercise_id: set.exercise_id,
    exercise_name: set.exercise_name,
    sets: 1,
  });
}

function sortExerciseContributions(
  sources: Map<string, ExerciseMuscleContribution>,
): ExerciseMuscleContribution[] {
  return [...sources.values()].sort(
    (a, b) => b.sets - a.sets || a.exercise_name.localeCompare(b.exercise_name),
  );
}

function uniqueMuscles(muscles: MuscleGroup[]): MuscleGroup[] {
  return [...new Set(muscles)];
}

function addMuscleCredit(
  totals: Map<MuscleGroup, number>,
  muscle: MuscleGroup,
  credit: number,
): void {
  totals.set(muscle, (totals.get(muscle) ?? 0) + credit);
}

function toOrderedSummary(totals: Map<MuscleGroup, number>): SessionMuscleSummary {
  const summary: SessionMuscleSummary = {};

  for (const muscle of MUSCLE_GROUPS) {
    const total = totals.get(muscle);
    if (total !== undefined && total > 0) {
      summary[muscle] = total;
    }
  }

  return summary;
}
