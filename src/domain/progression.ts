import type { ExerciseCategory, Unit } from './types';

export interface ProgressionSet {
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  unit: Unit;
}

export interface ProgressionInput {
  category: ExerciseCategory;
  targetReps: number | null;
  lastSet: ProgressionSet | null;
  previousSet?: ProgressionSet | null;
}

export interface ProgressionSuggestion {
  label: string;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  unit: Unit;
}

function incrementForCategory(category: ExerciseCategory): number {
  return category === 'dumbbell' ? 1 : 2.5;
}

function roundWeight(weight: number): number {
  return Math.max(0, parseFloat(weight.toFixed(2)));
}

function missedTarget(set: ProgressionSet | null | undefined, targetReps: number | null): boolean {
  return targetReps !== null && set?.reps !== null && set?.reps !== undefined && set.reps < targetReps;
}

function hitTarget(set: ProgressionSet, targetReps: number | null): boolean {
  return targetReps === null || (set.reps !== null && set.reps >= targetReps);
}

export function getProgressionSuggestion(input: ProgressionInput): ProgressionSuggestion {
  const { category, targetReps, lastSet, previousSet } = input;

  if (!lastSet) {
    return {
      label: 'No suggestion yet.',
      weight: null,
      reps: null,
      rpe: null,
      unit: 'kg',
    };
  }

  const missedLast = missedTarget(lastSet, targetReps);
  const missedPrevious = missedTarget(previousSet, targetReps);
  const reps = lastSet.reps ?? targetReps;
  const weight = lastSet.weight;
  const rpe = lastSet.rpe;

  if (missedLast && missedPrevious && weight !== null) {
    return {
      label: '-10% weight next time.',
      weight: roundWeight(weight * 0.9),
      reps,
      rpe: null,
      unit: lastSet.unit,
    };
  }

  if ((rpe !== null && rpe > 8.5) || missedLast) {
    return {
      label: 'Same weight, one fewer rep.',
      weight,
      reps: reps !== null ? Math.max(1, reps - 1) : null,
      rpe: null,
      unit: lastSet.unit,
    };
  }

  if (rpe !== null && rpe <= 7 && hitTarget(lastSet, targetReps) && weight !== null) {
    const nextWeight = roundWeight(weight + incrementForCategory(category));
    return {
      label: `Add ${incrementForCategory(category)} ${lastSet.unit}.`,
      weight: nextWeight,
      reps,
      rpe: null,
      unit: lastSet.unit,
    };
  }

  return {
    label: 'Same weight, same reps.',
    weight,
    reps,
    rpe: null,
    unit: lastSet.unit,
  };
}
