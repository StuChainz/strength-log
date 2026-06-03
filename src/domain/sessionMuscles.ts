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
  contribution: number;
}

export interface TrainingVolumeMuscleExposure {
  muscle: MuscleGroup;
  totalExposure: number;
  directContribution: number;
  indirectContribution: number;
  directSources: ExerciseMuscleContribution[];
  indirectSources: ExerciseMuscleContribution[];
}

export interface TrainingVolumeExposureSet extends SessionMuscleSet {
  exercise_name: string;
  primary_muscles: MuscleGroup[];
  secondary_muscles: MuscleGroup[];
  tertiary_muscles?: MuscleGroup[];
}

export type SessionMuscleSet = Pick<WorkoutSet, 'exercise_id'> &
  Partial<Pick<WorkoutSet, 'set_type' | 'is_warmup' | 'deleted_at'>>;

export type ExerciseMuscleMetadata = Pick<
  ExerciseMetadataView,
  'exercise_id' | 'primary_muscles' | 'secondary_muscles' | 'tertiary_muscles'
>;

const PRIMARY_MUSCLE_CREDIT = 1;
const SECONDARY_MUSCLE_CREDIT = 0.5;
const TERTIARY_MUSCLE_CREDIT = 0.25;

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
    const secondaryMuscles = uniqueMuscles(metadata.secondary_muscles).filter(
      (muscle) => !primaryMuscleSet.has(muscle),
    );
    const secondaryMuscleSet = new Set(secondaryMuscles);

    for (const muscle of primaryMuscles) {
      addMuscleCredit(totals, muscle, PRIMARY_MUSCLE_CREDIT);
    }

    for (const muscle of secondaryMuscles) {
      addMuscleCredit(totals, muscle, SECONDARY_MUSCLE_CREDIT);
    }

    for (const muscle of uniqueMuscles(metadata.tertiary_muscles ?? [])) {
      if (primaryMuscleSet.has(muscle) || secondaryMuscleSet.has(muscle)) continue;
      addMuscleCredit(totals, muscle, TERTIARY_MUSCLE_CREDIT);
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
      directContribution: number;
      indirectContribution: number;
      directSources: Map<string, ExerciseMuscleContribution>;
      indirectSources: Map<string, ExerciseMuscleContribution>;
    }
  >();

  for (const set of sets) {
    if (!isCountedWorkingSet(set)) continue;

    const primaryMuscles = uniqueMuscles(set.primary_muscles);
    const primaryMuscleSet = new Set(primaryMuscles);
    const secondaryMuscles = uniqueMuscles(set.secondary_muscles).filter(
      (muscle) => !primaryMuscleSet.has(muscle),
    );
    const secondaryMuscleSet = new Set(secondaryMuscles);

    for (const muscle of primaryMuscles) {
      const entry = getExposureEntry(totals, muscle);
      entry.directContribution += PRIMARY_MUSCLE_CREDIT;
      addExerciseContribution(entry.directSources, set, PRIMARY_MUSCLE_CREDIT);
    }

    for (const muscle of secondaryMuscles) {
      const entry = getExposureEntry(totals, muscle);
      entry.indirectContribution += SECONDARY_MUSCLE_CREDIT;
      addExerciseContribution(entry.indirectSources, set, SECONDARY_MUSCLE_CREDIT);
    }

    for (const muscle of uniqueMuscles(set.tertiary_muscles ?? [])) {
      if (primaryMuscleSet.has(muscle) || secondaryMuscleSet.has(muscle)) continue;

      const entry = getExposureEntry(totals, muscle);
      entry.indirectContribution += TERTIARY_MUSCLE_CREDIT;
      addExerciseContribution(entry.indirectSources, set, TERTIARY_MUSCLE_CREDIT);
    }
  }

  return MUSCLE_GROUPS.map((muscle) => {
    const entry = totals.get(muscle);
    if (!entry) return null;

    const directSources = sortExerciseContributions(entry.directSources);
    const indirectSources = sortExerciseContributions(entry.indirectSources);

    return {
      muscle,
      totalExposure: entry.directContribution + entry.indirectContribution,
      directContribution: entry.directContribution,
      indirectContribution: entry.indirectContribution,
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
      directContribution: number;
      indirectContribution: number;
      directSources: Map<string, ExerciseMuscleContribution>;
      indirectSources: Map<string, ExerciseMuscleContribution>;
    }
  >,
  muscle: MuscleGroup,
) {
  let entry = totals.get(muscle);
  if (!entry) {
    entry = {
      directContribution: 0,
      indirectContribution: 0,
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
  contribution: number,
): void {
  const current = sources.get(set.exercise_id);
  if (current) {
    current.contribution += contribution;
    return;
  }

  sources.set(set.exercise_id, {
    exercise_id: set.exercise_id,
    exercise_name: set.exercise_name,
    contribution,
  });
}

function sortExerciseContributions(
  sources: Map<string, ExerciseMuscleContribution>,
): ExerciseMuscleContribution[] {
  return [...sources.values()].sort(
    (a, b) => b.contribution - a.contribution || a.exercise_name.localeCompare(b.exercise_name),
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
