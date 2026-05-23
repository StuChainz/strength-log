import type { ExerciseCategory, ForceType } from '@/domain/types';

export type ExerciseForceFilterOption = Extract<
  ForceType,
  'push' | 'pull' | 'legs' | 'hinge' | 'core'
>;
export type ExerciseFilterOption = ExerciseCategory | ExerciseForceFilterOption | 'all' | 'custom';

export interface ExerciseFilterChip {
  label: string;
  value: ExerciseFilterOption;
}

export interface ExerciseListFilters {
  query?: string;
  category?: ExerciseCategory;
  custom?: boolean;
  force_type?: ForceType;
}

export const BASE_EXERCISE_FILTER_CHIPS: ExerciseFilterChip[] = [
  { label: 'All', value: 'all' },
  { label: 'Push', value: 'push' },
  { label: 'Pull', value: 'pull' },
  { label: 'Legs', value: 'legs' },
  { label: 'Hinge', value: 'hinge' },
  { label: 'Core', value: 'core' },
  { label: 'Barbell', value: 'barbell' },
  { label: 'Dumbbell', value: 'dumbbell' },
  { label: 'Bodyweight', value: 'bodyweight' },
  { label: 'Machine', value: 'machine' },
  { label: 'Cable', value: 'cable' },
];

export const LIBRARY_EXERCISE_FILTER_CHIPS: ExerciseFilterChip[] = [
  ...BASE_EXERCISE_FILTER_CHIPS,
  { label: 'Custom', value: 'custom' },
];

const FORCE_FILTERS = new Set<ExerciseForceFilterOption>([
  'push',
  'pull',
  'legs',
  'hinge',
  'core',
]);

export function buildExerciseListFilters(
  activeFilter: ExerciseFilterOption,
  searchQuery: string,
): ExerciseListFilters {
  const filters: ExerciseListFilters = {};
  const query = searchQuery.trim();

  if (query) {
    filters.query = query;
  }

  if (activeFilter === 'custom') {
    filters.custom = true;
  } else if (isForceFilter(activeFilter)) {
    filters.force_type = activeFilter;
  } else if (activeFilter !== 'all') {
    filters.category = activeFilter;
  }

  return filters;
}

function isForceFilter(value: ExerciseFilterOption): value is ExerciseForceFilterOption {
  return FORCE_FILTERS.has(value as ExerciseForceFilterOption);
}
