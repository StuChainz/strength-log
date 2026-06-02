import {
  CreateExerciseSchema,
  ExerciseMetadataInputSchema,
  UpdateExerciseSchema,
  SessionNoteSchema,
  POST_SESSION_TAGS,
} from '@/domain/validation';
import { MUSCLE_GROUPS } from '@/domain/types';

describe('CreateExerciseSchema', () => {
  it('accepts a valid exercise', () => {
    const result = CreateExerciseSchema.safeParse({
      name: 'Back Squat',
      category: 'barbell',
    });
    expect(result.success).toBe(true);
  });

  it('accepts optional nullable fields', () => {
    const result = CreateExerciseSchema.safeParse({
      name: 'Curl',
      category: 'dumbbell',
      primary_muscle: null,
      default_unit: 'kg',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty name', () => {
    const result = CreateExerciseSchema.safeParse({ name: '', category: 'barbell' });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid category', () => {
    const result = CreateExerciseSchema.safeParse({ name: 'X', category: 'kettlebell' });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid unit', () => {
    const result = CreateExerciseSchema.safeParse({
      name: 'X',
      category: 'barbell',
      default_unit: 'stone',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a name exceeding 100 chars', () => {
    const result = CreateExerciseSchema.safeParse({
      name: 'A'.repeat(101),
      category: 'barbell',
    });
    expect(result.success).toBe(false);
  });
});

describe('UpdateExerciseSchema', () => {
  it('accepts a partial update (name only)', () => {
    const result = UpdateExerciseSchema.safeParse({ name: 'New Name' });
    expect(result.success).toBe(true);
  });

  it('accepts an empty object (no-op update)', () => {
    const result = UpdateExerciseSchema.safeParse({});
    expect(result.success).toBe(true);
  });
});

describe('ExerciseMetadataInputSchema', () => {
  it('uses the fixed muscle metadata vocabulary', () => {
    expect(MUSCLE_GROUPS).toEqual([
      'chest',
      'upper_back',
      'lats',
      'traps',
      'front_delts',
      'side_delts',
      'rear_delts',
      'biceps',
      'triceps',
      'forearms',
      'abs',
      'obliques',
      'spinal_erectors',
      'glutes',
      'quads',
      'hamstrings',
      'calves',
      'adductors',
    ]);
  });

  it('accepts primary and secondary muscle metadata', () => {
    const result = ExerciseMetadataInputSchema.safeParse({
      movement_pattern: 'horizontal_push',
      force_type: 'push',
      body_region: 'upper_body',
      primary_muscles: ['chest'],
      secondary_muscles: ['front_delts', 'triceps'],
      equipment: ['barbell', 'bench'],
      mechanics: 'compound',
      laterality: 'bilateral',
      difficulty: 3,
      substitution_group: 'horizontal_press',
      source_id: 'curated_seed:bench_press',
    });

    expect(result.success).toBe(true);
  });

  it('rejects muscles outside the fixed vocabulary', () => {
    const result = ExerciseMetadataInputSchema.safeParse({
      movement_pattern: 'vertical_pull',
      force_type: 'pull',
      body_region: 'upper_body',
      primary_muscles: ['back'],
      secondary_muscles: ['biceps'],
      equipment: ['bodyweight'],
      mechanics: 'compound',
      laterality: 'bilateral',
      difficulty: 3,
      substitution_group: 'vertical_pull',
      source_id: 'curated_seed:pull_up',
    });

    expect(result.success).toBe(false);
  });
});

describe('SessionNoteSchema', () => {
  it('accepts valid energy + note', () => {
    const result = SessionNoteSchema.safeParse({ energy_rating: 8, note: 'Felt great' });
    expect(result.success).toBe(true);
  });

  it('rejects energy_rating below 1', () => {
    const result = SessionNoteSchema.safeParse({ energy_rating: 0 });
    expect(result.success).toBe(false);
  });

  it('rejects energy_rating above 10', () => {
    const result = SessionNoteSchema.safeParse({ energy_rating: 11 });
    expect(result.success).toBe(false);
  });

  it('rejects a note longer than 280 chars', () => {
    const result = SessionNoteSchema.safeParse({ note: 'x'.repeat(281) });
    expect(result.success).toBe(false);
  });
});

describe('POST_SESSION_TAGS', () => {
  it('includes the required fixed vocabulary', () => {
    expect(POST_SESSION_TAGS).toContain('sleep_short');
    expect(POST_SESSION_TAGS).toContain('evening_session');
    expect(POST_SESSION_TAGS).toContain('morning_session');
    expect(POST_SESSION_TAGS).toContain('felt_strong');
    expect(POST_SESSION_TAGS).toContain('felt_weak');
  });

  it('has exactly 13 tags', () => {
    expect(POST_SESSION_TAGS).toHaveLength(13);
  });
});
