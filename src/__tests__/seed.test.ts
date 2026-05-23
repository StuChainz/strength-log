import { SEED_EXERCISES } from '@/db/seed/exercises';
import { normalizeName } from '@/domain/ids';

describe('SEED_EXERCISES', () => {
  it('contains at least 35 exercises', () => {
    expect(SEED_EXERCISES.length).toBeGreaterThanOrEqual(35);
  });

  it('every exercise has a non-empty name', () => {
    SEED_EXERCISES.forEach((e) => {
      expect(e.name.trim().length).toBeGreaterThan(0);
    });
  });

  it('every exercise has a valid category', () => {
    const valid = new Set(['barbell', 'dumbbell', 'machine', 'bodyweight', 'cable', 'other']);
    SEED_EXERCISES.forEach((e) => {
      expect(valid.has(e.category)).toBe(true);
    });
  });

  it('every exercise has at least one alias', () => {
    SEED_EXERCISES.forEach((e) => {
      expect(e.aliases.length).toBeGreaterThanOrEqual(1);
    });
  });

  it('all aliases are globally unique after normalisation', () => {
    const seen = new Set<string>();
    const duplicates: string[] = [];

    SEED_EXERCISES.forEach((exercise) => {
      exercise.aliases.forEach((alias) => {
        const normalised = normalizeName(alias);
        if (seen.has(normalised)) {
          duplicates.push(`${normalised} (in "${exercise.name}")`);
        }
        seen.add(normalised);
      });
    });

    expect(duplicates).toEqual([]);
  });

  it('covers barbell, dumbbell, bodyweight, machine, and cable categories', () => {
    const categories = new Set(SEED_EXERCISES.map((e) => e.category));
    expect(categories.has('barbell')).toBe(true);
    expect(categories.has('dumbbell')).toBe(true);
    expect(categories.has('bodyweight')).toBe(true);
    expect(categories.has('machine')).toBe(true);
    expect(categories.has('cable')).toBe(true);
  });
});
