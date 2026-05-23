import { formatExerciseMetadataSummary, formatMetadataValue } from '@/domain/exerciseMetadata';
import type { ExerciseWithMetadata } from '@/domain/types';

const baseExercise: ExerciseWithMetadata = {
  id: 'ex-1',
  name: 'Bench Press',
  normalized_name: 'bench press',
  category: 'barbell',
  primary_muscle: 'chest',
  default_unit: 'kg',
  is_custom: 0,
  archived_at: null,
  created_at: 1,
  updated_at: 1,
  aliases: [],
  metadata: null,
};

describe('exercise metadata formatting', () => {
  it('formats metadata-backed summaries', () => {
    expect(
      formatExerciseMetadataSummary({
        ...baseExercise,
        metadata: {
          exercise_id: 'ex-1',
          movement_pattern: 'horizontal_push',
          force_type: 'push',
          body_region: 'upper_body',
          primary_muscles: ['chest'],
          secondary_muscles: ['triceps'],
          equipment: ['dumbbell', 'bench'],
          mechanics: 'compound',
          laterality: 'bilateral',
          difficulty: 2,
          substitution_group: 'horizontal_press',
          source: 'curated_seed',
          source_id: 'curated_seed:dumbbell_bench_press',
          updated_at: 1,
        },
      }),
    ).toBe('Dumbbell · Chest · Push');
  });

  it('falls back to exercise category and custom state when metadata is missing', () => {
    expect(
      formatExerciseMetadataSummary({
        ...baseExercise,
        name: 'Custom Move',
        category: 'other',
        primary_muscle: null,
        is_custom: 1,
      }),
    ).toBe('Other · Custom');
  });

  it('formats underscore metadata values for display', () => {
    expect(formatMetadataValue('pull_up_bar')).toBe('Pull Up Bar');
  });
});
