import type { WorkoutSet } from './types';

export function calculateSetVolume(set: Pick<WorkoutSet, 'weight' | 'reps'>): number {
  if (set.weight === null || set.reps === null) return 0;
  return set.weight * set.reps;
}

export function calculateSessionVolume(sets: Pick<WorkoutSet, 'weight' | 'reps'>[]): number {
  return sets.reduce((total, set) => total + calculateSetVolume(set), 0);
}

export function estimateOneRepMax(weight: number | null, reps: number | null): number | null {
  if (weight === null || reps === null || reps <= 0 || reps > 10) return null;
  return weight * (1 + reps / 30);
}
