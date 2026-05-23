import { createExercise, getExercisesWithMetadata } from '@/db/repositories/exercises.repo';

function createMockDb(rows: unknown[] = []) {
  const runCalls: { sql: string; params: unknown[] }[] = [];
  const allCalls: { sql: string; params: unknown[] }[] = [];

  return {
    runCalls,
    allCalls,
    runAsync: jest.fn(async (sql: string, params: unknown[] = []) => {
      runCalls.push({ sql, params });
      return { lastInsertRowId: 1, changes: 1 };
    }),
    getFirstAsync: jest.fn(async () => ({
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
    })),
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

  it('supports category, custom, force, muscle, equipment, and name or alias filters', async () => {
    const db = createMockDb([]);

    await getExercisesWithMetadata(db as never, {
      category: 'barbell',
      custom: false,
      force_type: 'push',
      muscle: 'chest',
      equipment: 'barbell',
      query: 'bench',
    });

    expect(db.allCalls[0].sql).toContain('e.category = ?');
    expect(db.allCalls[0].sql).toContain('e.is_custom = ?');
    expect(db.allCalls[0].sql).toContain('m.force_type = ?');
    expect(db.allCalls[0].sql).toContain('m.primary_muscles_json LIKE ?');
    expect(db.allCalls[0].sql).toContain('m.equipment_json LIKE ?');
    expect(db.allCalls[0].sql).toContain('e.normalized_name LIKE ?');
    expect(db.allCalls[0].sql).toContain('EXISTS');
    expect(db.allCalls[0].sql).toContain('alias_match.alias LIKE ?');
    expect(db.allCalls[0].params).toEqual([
      'barbell',
      0,
      'push',
      '%"chest"%',
      '%"chest"%',
      '%"barbell"%',
      '%bench%',
      '%bench%',
    ]);
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
});
