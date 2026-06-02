import type { SetType, WorkoutSet } from './types';

export interface WorkoutSummaryExerciseInput {
  id: string;
  name: string;
}

export interface WorkoutSummaryExercise {
  exerciseId: string;
  name: string;
  loggedSets: number;
}

export interface WorkoutSummarySoFar {
  totalSets: number;
  totalVolume: number;
  exercises: WorkoutSummaryExercise[];
}

type WorkingVolumeSet = Pick<WorkoutSet, 'weight' | 'reps'> & {
  set_type?: SetType;
  deleted_at?: number | null;
};

export function calculateSetVolume(set: Pick<WorkoutSet, 'weight' | 'reps'>): number {
  if (set.weight === null || set.reps === null) return 0;
  return set.weight * set.reps;
}

export function calculateSessionVolume(sets: Pick<WorkoutSet, 'weight' | 'reps'>[]): number {
  return sets.reduce((total, set) => total + calculateSetVolume(set), 0);
}

export function isWorkingSet(set: { set_type?: SetType }): boolean {
  return (set.set_type ?? 'working') !== 'warmup';
}

export function calculateWorkingSessionVolume(sets: WorkingVolumeSet[]): number {
  return calculateSessionVolume(
    sets.filter((set) => (set.deleted_at ?? null) === null && isWorkingSet(set)),
  );
}

const wholeKgFormatter = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

export function formatWorkoutVolumeKg(volume: number): string {
  if (volume >= 10_000) {
    const tonnes = Math.round((volume / 1000) * 10) / 10;
    const formattedTonnes = tonnes % 1 === 0 ? wholeKgFormatter.format(tonnes) : tonnes.toFixed(1);
    return `${formattedTonnes} tonnes`;
  }

  return `${wholeKgFormatter.format(Math.round(volume))} kg`;
}

export function calculateWorkoutSummarySoFar(
  sets: (Pick<WorkoutSet, 'exercise_id' | 'weight' | 'reps' | 'deleted_at'> & {
    set_type?: SetType;
  })[],
  exercises: WorkoutSummaryExerciseInput[],
): WorkoutSummarySoFar {
  const workingSets = sets.filter((set) => set.deleted_at === null && isWorkingSet(set));
  const counts = new Map<string, number>();

  for (const set of workingSets) {
    counts.set(set.exercise_id, (counts.get(set.exercise_id) ?? 0) + 1);
  }

  return {
    totalSets: workingSets.length,
    totalVolume: calculateSessionVolume(workingSets),
    exercises: exercises
      .map((exercise) => ({
        exerciseId: exercise.id,
        name: exercise.name,
        loggedSets: counts.get(exercise.id) ?? 0,
      }))
      .filter((exercise) => exercise.loggedSets > 0),
  };
}

export function estimateOneRepMax(weight: number | null, reps: number | null): number | null {
  if (weight === null || reps === null || reps <= 0 || reps > 10) return null;
  return weight * (1 + reps / 30);
}
