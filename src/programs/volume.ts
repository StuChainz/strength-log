import type { ProgramPreset } from './types';

export function formatSetCount(count: number): string {
  return `${count} set${count === 1 ? '' : 's'}`;
}

export function getProgramPresetWeeklySetCount(preset: ProgramPreset): number {
  return preset.workouts.reduce(
    (presetTotal, workout) =>
      presetTotal +
      workout.exercises.reduce((workoutTotal, exercise) => workoutTotal + exercise.targetSets, 0),
    0,
  );
}
