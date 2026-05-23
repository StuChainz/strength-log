import {
  auditExerciseMetadataFixture,
  summarizeExerciseMetadataCoverage,
  summarizeExerciseMetadataSubstitutionGroups,
} from '@/domain/exerciseMetadataFixtureAudit';
import type { MovementPattern } from '@/domain/types';

const VALID_METADATA = {
  exerciseName: 'Bench Press',
  movement_pattern: 'horizontal_push',
  force_type: 'push',
  body_region: 'upper_body',
  primary_muscles: ['chest'],
  secondary_muscles: ['triceps'],
  equipment: ['barbell', 'bench'],
  mechanics: 'compound',
  laterality: 'bilateral',
  difficulty: 3,
  substitution_group: 'horizontal_press',
  source_id: 'curated_seed:bench_press',
};

describe('exercise metadata fixture audit', () => {
  it('passes a valid offline metadata fixture', () => {
    const audit = auditExerciseMetadataFixture([{ name: 'Bench Press' }], [VALID_METADATA], {
      requiredMovementPatterns: ['horizontal_push'],
      requiredForceTypes: ['push'],
    });

    expect(audit.ok).toBe(true);
    expect(audit.issues).toEqual([]);
    expect(audit.counts).toEqual({
      exercises: 1,
      metadata: 1,
      movementPatterns: 1,
      forceTypes: 1,
      sources: 1,
    });
  });

  it('reports join, duplicate, source, and coverage problems', () => {
    const audit = auditExerciseMetadataFixture(
      [{ name: 'Bench Press' }, { name: 'bench press' }],
      [
        VALID_METADATA,
        {
          ...VALID_METADATA,
          exerciseName: 'Bench Press',
          source_id: 'curated_seed:bench_press',
        },
        {
          ...VALID_METADATA,
          exerciseName: 'Missing Exercise',
          primary_muscles: [],
          equipment: [],
          source_id: null,
        },
      ],
      {
        requiredMovementPatterns: ['horizontal_push', 'vertical_pull'] as MovementPattern[],
        requiredForceTypes: ['push', 'pull'],
      },
    );

    expect(audit.ok).toBe(false);
    expect(audit.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'duplicate_exercise_name',
        'duplicate_metadata_exercise',
        'duplicate_source_id',
        'metadata_without_exercise',
        'missing_equipment',
        'missing_primary_muscle',
        'missing_source_id',
        'missing_required_force_type',
        'missing_required_movement_pattern',
      ]),
    );
  });

  it('reports invalid vocabulary before import', () => {
    const audit = auditExerciseMetadataFixture(
      [{ name: 'Bench Press' }],
      [
        {
          ...VALID_METADATA,
          movement_pattern: 'kettlebell_flow',
        },
      ],
    );

    expect(audit.ok).toBe(false);
    expect(audit.issues).toEqual([
      expect.objectContaining({
        code: 'invalid_metadata',
        exerciseName: 'Bench Press',
      }),
    ]);
  });

  it('summarizes which seed exercises still need metadata', () => {
    const coverage = summarizeExerciseMetadataCoverage(
      [
        { name: 'Bench Press', category: 'barbell', primary_muscle: 'chest' },
        { name: 'Pull Up', category: 'bodyweight', primary_muscle: 'back' },
      ],
      [VALID_METADATA],
    );

    expect(coverage).toEqual({
      totalExercises: 2,
      annotatedExercises: 1,
      unannotatedExercises: 1,
      coverageRatio: 0.5,
      unannotated: [
        {
          name: 'Pull Up',
          category: 'bodyweight',
          primary_muscle: 'back',
        },
      ],
    });
  });

  it('summarizes substitution groups that already have alternatives', () => {
    const summary = summarizeExerciseMetadataSubstitutionGroups([
      VALID_METADATA,
      {
        ...VALID_METADATA,
        exerciseName: 'Dumbbell Bench Press',
        equipment: ['dumbbell', 'bench'],
        source_id: 'curated_seed:dumbbell_bench_press',
      },
      {
        ...VALID_METADATA,
        exerciseName: 'Overhead Press',
        movement_pattern: 'vertical_push',
        primary_muscles: ['shoulders'],
        substitution_group: 'vertical_press',
        source_id: 'curated_seed:overhead_press',
      },
      {
        ...VALID_METADATA,
        exerciseName: 'Invalid',
        movement_pattern: 'unknown',
        substitution_group: 'ignored',
      },
    ]);

    expect(summary.groups).toEqual([
      {
        group: 'horizontal_press',
        exerciseNames: ['Bench Press', 'Dumbbell Bench Press'],
        count: 2,
      },
      {
        group: 'vertical_press',
        exerciseNames: ['Overhead Press'],
        count: 1,
      },
    ]);
    expect(summary.multiExerciseGroups.map((group) => group.group)).toEqual(['horizontal_press']);
    expect(summary.singletonGroups.map((group) => group.group)).toEqual(['vertical_press']);
  });
});
