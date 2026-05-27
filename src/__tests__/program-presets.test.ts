import { ALL_PRESETS } from '@/programs/presets';
import type { ProgramExercise, ProgramPreset } from '@/programs/types';
import { SEED_EXERCISES } from '@/db/seed/exercises';
import { normalizeName } from '@/domain/ids';
import { PROGRESSION_RULES } from '@/domain/types';

const SEEDED_NORMALIZED_NAMES = new Set(
  SEED_EXERCISES.map((exercise) => normalizeName(exercise.name)),
);

describe('program presets', () => {
  it('exposes the five expected presets', () => {
    const ids = ALL_PRESETS.map((p) => p.id).sort();
    expect(ids).toEqual(['gzclp', 'linear-5x5', 'phat', 'phul', 'reddit-ppl-6day']);
  });

  it('has unique preset ids', () => {
    const ids = ALL_PRESETS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  describe.each(ALL_PRESETS)('$id', (preset: ProgramPreset) => {
    it('has required metadata', () => {
      expect(preset.name.length).toBeGreaterThan(0);
      expect(preset.shortDescription.length).toBeGreaterThan(0);
      expect(preset.description.length).toBeGreaterThan(0);
      expect(preset.daysPerWeek).toBeGreaterThan(0);
      expect(['beginner', 'intermediate', 'advanced']).toContain(preset.experienceLevel);
      expect(['kg', 'lb']).toContain(preset.defaultUnit);
    });

    it('has at least one workout', () => {
      expect(preset.workouts.length).toBeGreaterThan(0);
    });

    it('uses unique workout keys', () => {
      const keys = preset.workouts.map((w) => w.key);
      expect(new Set(keys).size).toBe(keys.length);
    });

    it('uses unique workout names', () => {
      const names = preset.workouts.map((w) => w.name.trim().toLowerCase());
      expect(new Set(names).size).toBe(names.length);
    });

    it.each(preset.workouts.map((w) => [w.key, w]))(
      'workout %s has at least one exercise',
      (_key, workout) => {
        expect(workout.exercises.length).toBeGreaterThan(0);
      },
    );

    it.each(preset.workouts.map((w) => [w.key, w]))(
      'workout %s does not contain duplicate exercises',
      (_key, workout) => {
        const names = workout.exercises.map((exercise) => exercise.match.normalizedName);
        expect(new Set(names).size).toBe(names.length);
      },
    );

    it.each(
      preset.workouts.flatMap((w) =>
        w.exercises.map((e, i) => [`${w.key}#${i} (${e.match.normalizedName})`, e] as const),
      ),
    )('exercise %s passes structural validation', (_label, exercise: ProgramExercise) => {
      expect(exercise.match.normalizedName.length).toBeGreaterThan(0);
      expect(exercise.match.normalizedName).toBe(normalizeName(exercise.match.normalizedName));

      expect(Number.isInteger(exercise.targetSets)).toBe(true);
      expect(exercise.targetSets).toBeGreaterThan(0);

      if (exercise.targetReps !== null) {
        expect(Number.isInteger(exercise.targetReps)).toBe(true);
        expect(exercise.targetReps).toBeGreaterThan(0);
      }

      if (exercise.restSeconds != null) {
        expect(Number.isInteger(exercise.restSeconds)).toBe(true);
        expect(exercise.restSeconds).toBeGreaterThan(0);
      }

      if (exercise.targetRPE != null) {
        expect(exercise.targetRPE).toBeGreaterThanOrEqual(1);
        expect(exercise.targetRPE).toBeLessThanOrEqual(10);
      }

      const cfg = exercise.progression;
      expect(PROGRESSION_RULES).toContain(cfg.rule);

      if (cfg.incrementKg != null) {
        expect(cfg.incrementKg).toBeGreaterThan(0);
      }
      if (cfg.incrementLb != null) {
        expect(cfg.incrementLb).toBeGreaterThan(0);
      }

      switch (cfg.rule) {
        case 'none':
          // Per templates.repo normalizeDraftItem(): increments are dropped for 'none'.
          // We allow them in preset data but they will be ignored on import.
          break;
        case 'linear':
          // Linear needs at least one increment to actually progress.
          expect(cfg.incrementKg != null || cfg.incrementLb != null).toBe(true);
          break;
        case 'double':
          expect(cfg.repRangeMin).not.toBeNull();
          expect(cfg.repRangeMax).not.toBeNull();
          expect(Number.isInteger(cfg.repRangeMin!)).toBe(true);
          expect(Number.isInteger(cfg.repRangeMax!)).toBe(true);
          expect(cfg.repRangeMin!).toBeGreaterThan(0);
          expect(cfg.repRangeMax!).toBeGreaterThanOrEqual(cfg.repRangeMin!);
          break;
        case 'rpe_gated':
          expect(cfg.rpeCap).not.toBeNull();
          expect(cfg.rpeCap!).toBeGreaterThanOrEqual(1);
          expect(cfg.rpeCap!).toBeLessThanOrEqual(10);
          break;
      }
    });

    it.each(
      preset.workouts.flatMap((w) =>
        w.exercises.map((e, i) => [`${w.key}#${i} (${e.match.normalizedName})`, e] as const),
      ),
    )('exercise %s resolves to a seeded exercise', (_label, exercise: ProgramExercise) => {
      expect(SEEDED_NORMALIZED_NAMES.has(exercise.match.normalizedName)).toBe(true);
    });
  });
});
