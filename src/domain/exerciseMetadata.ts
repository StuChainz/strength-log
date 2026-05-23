import type { ExerciseCategory, ExerciseWithMetadata, ForceType } from '@/domain/types';

export const EXERCISE_CATEGORY_LABEL: Record<ExerciseCategory, string> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbell',
  machine: 'Machine',
  bodyweight: 'Bodyweight',
  cable: 'Cable',
  other: 'Other',
};

export const FORCE_TYPE_LABEL: Record<ForceType, string> = {
  push: 'Push',
  pull: 'Pull',
  legs: 'Legs',
  hinge: 'Hinge',
  core: 'Core',
  carry: 'Carry',
  mixed: 'Mixed',
  other: 'Other',
};

export function formatExerciseMetadataSummary(exercise: ExerciseWithMetadata): string {
  const metadata = exercise.metadata;
  const primaryMuscle = metadata?.primary_muscles[0] ?? exercise.primary_muscle;
  const equipment = metadata?.equipment[0]
    ? formatMetadataValue(metadata.equipment[0])
    : EXERCISE_CATEGORY_LABEL[exercise.category];
  const forceType = metadata?.force_type ? FORCE_TYPE_LABEL[metadata.force_type] : null;

  return [
    equipment,
    primaryMuscle ? formatMetadataValue(primaryMuscle) : null,
    forceType,
    exercise.is_custom ? 'Custom' : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

export function formatMetadataValue(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
