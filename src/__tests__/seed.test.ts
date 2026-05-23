import { SEED_EXERCISES, SEED_EXERCISE_METADATA } from '@/db/seed/exercises';
import {
  auditExerciseMetadataFixture,
  summarizeExerciseMetadataCoverage,
  summarizeExerciseMetadataSubstitutionGroups,
} from '@/domain/exerciseMetadataFixtureAudit';
import { normalizeName } from '@/domain/ids';
import { ExerciseMetadataInputSchema } from '@/domain/validation';
import type { BodyRegion, ForceType, MovementPattern } from '@/domain/types';

const REQUIRED_METADATA_MOVEMENT_PATTERNS: MovementPattern[] = [
  'horizontal_push',
  'vertical_push',
  'horizontal_pull',
  'vertical_pull',
  'squat',
  'hinge',
  'lunge',
  'hip_extension',
  'elbow_flexion',
  'elbow_extension',
  'shoulder_abduction',
  'core',
];

const REQUIRED_METADATA_FORCE_TYPES: ForceType[] = ['push', 'pull', 'legs', 'hinge', 'core'];

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

describe('SEED_EXERCISE_METADATA', () => {
  it('contains a small curated fixture of around 20 exercises', () => {
    expect(SEED_EXERCISE_METADATA.length).toBeGreaterThanOrEqual(18);
    expect(SEED_EXERCISE_METADATA.length).toBeLessThanOrEqual(24);
  });

  it('only references existing seed exercises by name', () => {
    const exerciseNames = new Set(SEED_EXERCISES.map((e) => e.name));

    SEED_EXERCISE_METADATA.forEach((metadata) => {
      expect(exerciseNames.has(metadata.exerciseName)).toBe(true);
    });
  });

  it('covers the required movement patterns', () => {
    const patterns = new Set(SEED_EXERCISE_METADATA.map((m) => m.movement_pattern));

    REQUIRED_METADATA_MOVEMENT_PATTERNS.forEach((pattern) => {
      expect(patterns.has(pattern)).toBe(true);
    });
  });

  it('covers Push, Pull, Legs, Hinge, and Core filters', () => {
    const forceTypes = new Set(SEED_EXERCISE_METADATA.map((m) => m.force_type));

    REQUIRED_METADATA_FORCE_TYPES.forEach((forceType) => {
      expect(forceTypes.has(forceType)).toBe(true);
    });
  });

  it('covers practical body regions for library filtering', () => {
    const regions = new Set(SEED_EXERCISE_METADATA.map((m) => m.body_region));

    const requiredRegions: BodyRegion[] = ['upper_body', 'lower_body', 'full_body', 'core'];

    requiredRegions.forEach((region) => {
      expect(regions.has(region)).toBe(true);
    });
  });

  it('matches the exercise metadata validation schema', () => {
    SEED_EXERCISE_METADATA.forEach(({ exerciseName, ...metadata }) => {
      expect(() => ExerciseMetadataInputSchema.parse(metadata)).not.toThrow();
      expect(exerciseName.trim().length).toBeGreaterThan(0);
    });
  });

  it('passes the offline fixture audit for future import readiness', () => {
    const audit = auditExerciseMetadataFixture(SEED_EXERCISES, SEED_EXERCISE_METADATA, {
      requiredMovementPatterns: REQUIRED_METADATA_MOVEMENT_PATTERNS,
      requiredForceTypes: REQUIRED_METADATA_FORCE_TYPES,
    });

    expect(audit.issues).toEqual([]);
    expect(audit.ok).toBe(true);
    expect(audit.counts.metadata).toBe(SEED_EXERCISE_METADATA.length);
  });

  it('summarizes current metadata coverage without expanding the seed phase', () => {
    const coverage = summarizeExerciseMetadataCoverage(SEED_EXERCISES, SEED_EXERCISE_METADATA);

    expect(coverage.totalExercises).toBe(SEED_EXERCISES.length);
    expect(coverage.annotatedExercises).toBe(SEED_EXERCISE_METADATA.length);
    expect(coverage.unannotatedExercises).toBeGreaterThan(0);
    expect(coverage.unannotated.map((exercise) => exercise.name)).toContain('Good Morning');
  });

  it('summarizes substitution groups for later substitution curation', () => {
    const summary = summarizeExerciseMetadataSubstitutionGroups(SEED_EXERCISE_METADATA);
    const multiExerciseGroupNames = summary.multiExerciseGroups.map((group) => group.group);
    const singletonGroupNames = summary.singletonGroups.map((group) => group.group);

    expect(multiExerciseGroupNames).toEqual(
      expect.arrayContaining(['horizontal_press', 'horizontal_row', 'vertical_pull']),
    );
    expect(singletonGroupNames).toContain('core_anti_extension');
    expect(summary.groups.length).toBeGreaterThan(summary.multiExerciseGroups.length);
  });
});
