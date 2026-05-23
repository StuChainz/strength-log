import { auditExerciseMetadataFixture } from '@/domain/exerciseMetadataFixtureAudit';
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
});
