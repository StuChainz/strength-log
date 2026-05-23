import {
  createExercise,
  getExerciseMetadataFacets,
  getExercisesWithMetadata,
  getSubstitutionCandidates,
  searchExercises,
} from '@/db/repositories/exercises.repo';

function createMockDb(
  rows: unknown[] = [],
  firstRow: unknown = {
    id: 'custom-1',
    name: 'Custom Press',
    normalized_name: 'custom press',
    category: 'barbell',
    primary_muscle: 'chest',
    default_unit: 'kg',
    is_custom: 1,
    archived_at: null,
    created_at: 1,
    updated_at: 1,
  },
) {
  const runCalls: { sql: string; params: unknown[] }[] = [];
  const allCalls: { sql: string; params: unknown[] }[] = [];
  const firstCalls: { sql: string; params: unknown[] }[] = [];

  return {
    runCalls,
    allCalls,
    firstCalls,
    runAsync: jest.fn(async (sql: string, params: unknown[] = []) => {
      runCalls.push({ sql, params });
      return { lastInsertRowId: 1, changes: 1 };
    }),
    getFirstAsync: jest.fn(async (sql: string, params: unknown[] = []) => {
      firstCalls.push({ sql, params });
      return firstRow;
    }),
    getAllAsync: jest.fn(async (sql: string, params: unknown[] = []) => {
      allCalls.push({ sql, params });
      return rows;
    }),
    execAsync: jest.fn(async () => {}),
    withTransactionAsync: jest.fn(async (task: () => Promise<void>) => task()),
  };
}

describe('exercises repository metadata', () => {
  it('parses metadata rows and preserves exercises missing metadata', async () => {
    const db = createMockDb([
      {
        id: 'ex-1',
        name: 'Bench Press',
        normalized_name: 'bench press',
        aliases_concat: 'bench\u001fflat bench',
        category: 'barbell',
        primary_muscle: 'chest',
        default_unit: 'kg',
        is_custom: 0,
        archived_at: null,
        created_at: 1,
        updated_at: 1,
        metadata_exercise_id: 'ex-1',
        movement_pattern: 'horizontal_push',
        force_type: 'push',
        body_region: 'upper_body',
        primary_muscles_json: '["chest"]',
        secondary_muscles_json: '["triceps","shoulders"]',
        equipment_json: '["barbell","bench"]',
        mechanics: 'compound',
        laterality: 'bilateral',
        difficulty: 3,
        substitution_group: 'horizontal_press',
        source: 'curated_seed',
        source_id: 'curated_seed:bench_press',
        metadata_updated_at: 1,
      },
      {
        id: 'custom-1',
        name: 'Custom Move',
        normalized_name: 'custom move',
        aliases_concat: null,
        category: 'other',
        primary_muscle: null,
        default_unit: null,
        is_custom: 1,
        archived_at: null,
        created_at: 1,
        updated_at: 1,
        metadata_exercise_id: null,
      },
    ]);

    const exercises = await getExercisesWithMetadata(db as never);

    expect(exercises[0].metadata?.force_type).toBe('push');
    expect(exercises[0].aliases).toEqual(['bench', 'flat bench']);
    expect(exercises[0].metadata?.primary_muscles).toEqual(['chest']);
    expect(exercises[0].metadata?.equipment).toEqual(['barbell', 'bench']);
    expect(exercises[1].metadata).toBeNull();
  });

  it('supports category, custom, metadata, muscle, equipment, and name or alias filters', async () => {
    const db = createMockDb([]);

    await getExercisesWithMetadata(db as never, {
      category: 'barbell',
      custom: false,
      force_type: 'push',
      movement_pattern: 'horizontal_push',
      body_region: 'upper_body',
      substitution_group: 'horizontal_press',
      mechanics: 'compound',
      laterality: 'bilateral',
      muscle: 'chest',
      equipment: 'barbell',
      source: 'curated_seed',
      source_id: 'curated_seed:barbell_bench_press',
      query: 'bench',
    });

    expect(db.allCalls[0].sql).toContain('e.category = ?');
    expect(db.allCalls[0].sql).toContain('e.is_custom = ?');
    expect(db.allCalls[0].sql).toContain('m.force_type = ?');
    expect(db.allCalls[0].sql).toContain('m.movement_pattern = ?');
    expect(db.allCalls[0].sql).toContain('m.body_region = ?');
    expect(db.allCalls[0].sql).toContain('m.substitution_group = ?');
    expect(db.allCalls[0].sql).toContain('m.mechanics = ?');
    expect(db.allCalls[0].sql).toContain('m.laterality = ?');
    expect(db.allCalls[0].sql).toContain('m.primary_muscles_json LIKE ?');
    expect(db.allCalls[0].sql).toContain('m.equipment_json LIKE ?');
    expect(db.allCalls[0].sql).toContain('m.source = ?');
    expect(db.allCalls[0].sql).toContain('m.source_id = ?');
    expect(db.allCalls[0].sql).toContain('e.normalized_name LIKE ?');
    expect(db.allCalls[0].sql).toContain('EXISTS');
    expect(db.allCalls[0].sql).toContain('alias_match.alias LIKE ?');
    expect(db.allCalls[0].params).toEqual([
      'barbell',
      0,
      'push',
      'horizontal_push',
      'upper_body',
      'horizontal_press',
      'compound',
      'bilateral',
      '%"chest"%',
      '%"chest"%',
      '%"barbell"%',
      'curated_seed',
      'curated_seed:barbell_bench_press',
      '%bench%',
      '%bench%',
    ]);
  });

  it('supports primary and secondary muscle filters separately', async () => {
    const db = createMockDb([]);

    await getExercisesWithMetadata(db as never, {
      primary_muscle: 'chest',
      secondary_muscle: 'triceps',
    });

    expect(db.allCalls[0].sql).toContain('m.primary_muscles_json LIKE ?');
    expect(db.allCalls[0].sql).toContain('m.secondary_muscles_json LIKE ?');
    expect(db.allCalls[0].params).toEqual(['%"chest"%', '%"triceps"%']);
  });

  it('returns available metadata facets from active exercises', async () => {
    const db = createMockDb([
      {
        movement_pattern: 'vertical_pull',
        force_type: 'pull',
        body_region: 'upper_body',
        primary_muscles_json: '["back"]',
        secondary_muscles_json: '["biceps","core"]',
        equipment_json: '["bodyweight","pull_up_bar"]',
        mechanics: 'compound',
        laterality: 'bilateral',
        substitution_group: 'vertical_pull',
        source: 'curated_seed',
      },
      {
        movement_pattern: 'horizontal_push',
        force_type: 'push',
        body_region: 'upper_body',
        primary_muscles_json: '["chest"]',
        secondary_muscles_json: '["triceps"]',
        equipment_json: '["barbell","bench"]',
        mechanics: 'compound',
        laterality: 'bilateral',
        substitution_group: 'horizontal_press',
        source: 'curated_seed',
      },
      {
        movement_pattern: null,
        force_type: null,
        body_region: null,
        primary_muscles_json: 'not json',
        secondary_muscles_json: null,
        equipment_json: '[]',
        mechanics: null,
        laterality: null,
        substitution_group: null,
        source: null,
      },
    ]);

    const facets = await getExerciseMetadataFacets(db as never);

    expect(db.allCalls[0].sql).toContain('INNER JOIN exercises e ON e.id = m.exercise_id');
    expect(db.allCalls[0].sql).toContain('e.archived_at IS NULL');
    expect(facets.force_types).toEqual(['push', 'pull']);
    expect(facets.movement_patterns).toEqual(['horizontal_push', 'vertical_pull']);
    expect(facets.body_regions).toEqual(['upper_body']);
    expect(facets.mechanics).toEqual(['compound']);
    expect(facets.lateralities).toEqual(['bilateral']);
    expect(facets.primary_muscles).toEqual(['chest', 'back']);
    expect(facets.secondary_muscles).toEqual(['biceps', 'triceps', 'core']);
    expect(facets.muscles).toEqual(['chest', 'back', 'biceps', 'triceps', 'core']);
    expect(facets.equipment).toEqual(['barbell', 'bodyweight', 'bench', 'pull_up_bar']);
    expect(facets.substitution_groups).toEqual(['horizontal_press', 'vertical_pull']);
    expect(facets.sources).toEqual(['curated_seed']);
  });

  it('still creates custom exercises without requiring metadata', async () => {
    const db = createMockDb();

    const exercise = await createExercise(db as never, {
      name: 'Custom Press',
      category: 'barbell',
      primary_muscle: 'chest',
      default_unit: 'kg',
    });

    expect(db.runCalls[0].sql).toContain('INSERT INTO exercises');
    expect(db.runCalls[0].params).toContain('custom press');
    expect(exercise.is_custom).toBe(1);
  });

  it('searches exercises by name or alias', async () => {
    const db = createMockDb([]);

    await searchExercises(db as never, 'flat bench');

    expect(db.allCalls[0].sql).toContain('e.normalized_name LIKE ?');
    expect(db.allCalls[0].sql).toContain('alias_match.alias LIKE ?');
    expect(db.allCalls[0].params).toEqual(['%flat bench%', '%flat bench%']);
  });

  it('returns substitution candidates from the same group', async () => {
    const db = createMockDb(
      [
        {
          id: 'ex-1',
          name: 'Bench Press',
          normalized_name: 'bench press',
          aliases_concat: null,
          category: 'barbell',
          primary_muscle: 'chest',
          default_unit: 'kg',
          is_custom: 0,
          archived_at: null,
          created_at: 1,
          updated_at: 1,
          metadata_exercise_id: 'ex-1',
          movement_pattern: 'horizontal_push',
          force_type: 'push',
          body_region: 'upper_body',
          primary_muscles_json: '["chest"]',
          secondary_muscles_json: '["triceps"]',
          equipment_json: '["barbell"]',
          mechanics: 'compound',
          laterality: 'bilateral',
          difficulty: 3,
          substitution_group: 'horizontal_press',
          source: 'curated_seed',
          source_id: 'curated_seed:bench_press',
          metadata_updated_at: 1,
        },
        {
          id: 'ex-2',
          name: 'Push Up',
          normalized_name: 'push up',
          aliases_concat: 'pushup',
          category: 'bodyweight',
          primary_muscle: 'chest',
          default_unit: null,
          is_custom: 0,
          archived_at: null,
          created_at: 1,
          updated_at: 1,
          metadata_exercise_id: 'ex-2',
          movement_pattern: 'horizontal_push',
          force_type: 'push',
          body_region: 'upper_body',
          primary_muscles_json: '["chest"]',
          secondary_muscles_json: '["triceps"]',
          equipment_json: '["bodyweight"]',
          mechanics: 'compound',
          laterality: 'bilateral',
          difficulty: 2,
          substitution_group: 'horizontal_press',
          source: 'curated_seed',
          source_id: 'curated_seed:push_up',
          metadata_updated_at: 1,
        },
      ],
      { substitution_group: 'horizontal_press' },
    );

    const candidates = await getSubstitutionCandidates(db as never, 'ex-1');

    expect(db.firstCalls[0].sql).toContain('FROM exercise_metadata');
    expect(db.firstCalls[0].params).toEqual(['ex-1']);
    expect(db.allCalls[0].sql).toContain('m.substitution_group = ?');
    expect(db.allCalls[0].params).toEqual(['horizontal_press']);
    expect(candidates.map((exercise) => exercise.id)).toEqual(['ex-2']);
  });

  it('returns no substitution candidates when metadata is missing', async () => {
    const db = createMockDb([], null);

    const candidates = await getSubstitutionCandidates(db as never, 'custom-1');

    expect(candidates).toEqual([]);
    expect(db.allCalls).toHaveLength(0);
  });
});
