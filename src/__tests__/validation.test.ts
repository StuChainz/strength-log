import {
  CreateExerciseSchema,
  UpdateExerciseSchema,
  SessionNoteSchema,
  POST_SESSION_TAGS,
} from '@/domain/validation';

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
