import { serializeExerciseMetadataInput } from '@/domain/exerciseMetadataInput';

describe('exercise metadata input serialization', () => {
  it('validates and serializes import-shaped metadata for SQLite storage', () => {
    const serialized = serializeExerciseMetadataInput({
      movement_pattern: 'horizontal_push',
      force_type: 'push',
      body_region: 'upper_body',
      primary_muscles: ['chest'],
      secondary_muscles: ['triceps', 'front_delts'],
      equipment: ['barbell', 'bench'],
      mechanics: 'compound',
      laterality: 'bilateral',
      difficulty: 3,
      substitution_group: 'horizontal_press',
      source_id: 'curated_seed:barbell_bench_press',
    });

    expect(serialized).toEqual({
      movement_pattern: 'horizontal_push',
      force_type: 'push',
      body_region: 'upper_body',
      primary_muscles_json: '["chest"]',
      secondary_muscles_json: '["triceps","front_delts"]',
      equipment_json: '["barbell","bench"]',
      mechanics: 'compound',
      laterality: 'bilateral',
      difficulty: 3,
      substitution_group: 'horizontal_press',
      source: 'curated_seed',
      source_id: 'curated_seed:barbell_bench_press',
    });
  });

  it('rejects invalid metadata before database writes', () => {
    expect(() =>
      serializeExerciseMetadataInput({
        movement_pattern: 'kettlebell_flow',
        force_type: 'push',
        body_region: 'upper_body',
        primary_muscles: ['chest'],
        secondary_muscles: [],
        equipment: ['barbell'],
        mechanics: 'compound',
        laterality: 'bilateral',
        difficulty: 3,
        substitution_group: 'invalid',
        source_id: 'invalid',
      }),
    ).toThrow();
  });
});
