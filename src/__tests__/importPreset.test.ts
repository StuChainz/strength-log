import {
  importPreset,
  PresetExerciseResolutionError,
} from '@/programs/importPreset';
import { ALL_PRESETS, LINEAR_5X5, REDDIT_PPL } from '@/programs/presets';
import type { ProgramPreset } from '@/programs/types';
import { SEED_EXERCISES } from '@/db/seed/exercises';
import { normalizeName } from '@/domain/ids';

// ─── In-memory stateful mock DB ───────────────────────────────────────────────
//
// Models the subset of expo-sqlite we need: an `exercises` table keyed by
// normalized_name and `templates` / `template_items` tables we insert into.
// Just enough SQL is implemented to exercise importPreset end-to-end without
// a real SQLite binary.

type Row = Record<string, string | number | null>;

interface MockOptions {
  failOnTemplateInsertAt?: number;
}

function createMockDb(presetExerciseNames: string[], opts: MockOptions = {}) {
  const exercises: Row[] = presetExerciseNames.map((normalized_name, i) => ({
    id: `ex-${i}`,
    normalized_name,
    archived_at: null,
  }));
  const aliases: Row[] = [];
  const templates: Row[] = [];
  const template_items: Row[] = [];

  let templateInsertCount = 0;

  const db = {
    _exercises: exercises,
    _aliases: aliases,
    _templates: templates,
    _template_items: template_items,

    addAlias(exerciseId: string, alias: string) {
      aliases.push({ id: `alias-${aliases.length}`, exercise_id: exerciseId, alias });
    },

    getFirstAsync: jest.fn(async (sql: string, params: unknown[] = []) => {
      if (/FROM exercises\s+WHERE normalized_name = \?/.test(sql)) {
        const needle = params[0] as string;
        return (
          exercises.find((e) => e.normalized_name === needle && e.archived_at === null) ?? null
        );
      }
      if (/FROM exercise_aliases a/.test(sql)) {
        const needle = params[0] as string;
        const found = aliases.find((a) => a.alias === needle);
        if (!found) return null;
        const ex = exercises.find((e) => e.id === found.exercise_id);
        if (!ex || ex.archived_at !== null) return null;
        return { exercise_id: found.exercise_id };
      }
      return null;
    }),

    runAsync: jest.fn(async (sql: string, params: unknown[] = []) => {
      if (/^INSERT INTO templates/.test(sql)) {
        templateInsertCount++;
        if (
          opts.failOnTemplateInsertAt !== undefined &&
          templateInsertCount === opts.failOnTemplateInsertAt
        ) {
          throw new Error('simulated template insert failure');
        }
        templates.push({
          id: params[0] as string,
          name: params[1] as string,
          notes: (params[2] as string | null) ?? null,
          archived_at: null,
          created_at: params[4] as number,
          updated_at: params[4] as number,
        });
      } else if (/^INSERT INTO template_items/.test(sql)) {
        template_items.push({
          id: params[0] as string,
          template_id: params[1] as string,
          exercise_id: params[2] as string,
          position: params[3] as number,
          target_sets: params[4] as number | null,
          target_reps: params[5] as number | null,
          target_weight: params[6] as number | null,
          target_rpe: params[7] as number | null,
          rest_seconds: params[8] as number | null,
          progression_rule: params[9] as string,
          increment_kg: params[10] as number | null,
          increment_lb: params[11] as number | null,
          rep_range_min: params[12] as number | null,
          rep_range_max: params[13] as number | null,
          rpe_cap: params[14] as number | null,
          amrap_last_set: params[15] as number,
        });
      } else if (/^DELETE FROM template_items WHERE template_id = \?/.test(sql)) {
        const tid = params[0] as string;
        for (let i = template_items.length - 1; i >= 0; i--) {
          if (template_items[i]!.template_id === tid) template_items.splice(i, 1);
        }
      } else if (/^DELETE FROM templates WHERE id = \?/.test(sql)) {
        const tid = params[0] as string;
        const i = templates.findIndex((t) => t.id === tid);
        if (i >= 0) templates.splice(i, 1);
      }
      return { lastInsertRowId: 1, changes: 1 };
    }),

    getAllAsync: jest.fn(async () => []),
    execAsync: jest.fn(async () => {}),
    withTransactionAsync: jest.fn(async (task: () => Promise<void>) => task()),
  };

  return db;
}

function uniqueNamesIn(preset: ProgramPreset): string[] {
  const set = new Set<string>();
  for (const workout of preset.workouts) {
    for (const ex of workout.exercises) set.add(ex.match.normalizedName);
  }
  return Array.from(set);
}

describe('importPreset', () => {
  it.each(ALL_PRESETS.map((preset) => [preset.id, preset] as const))(
    'imports every built-in preset against the seeded exercise library: %s',
    async (_id, preset) => {
      const seedNames = SEED_EXERCISES.map((exercise) => normalizeName(exercise.name));
      const db = createMockDb(seedNames);

      const result = await importPreset(db as never, preset);

      expect(result.templates).toHaveLength(preset.workouts.length);
      expect(db._templates).toHaveLength(preset.workouts.length);
      expect(db._template_items).toHaveLength(
        preset.workouts.reduce((n, workout) => n + workout.exercises.length, 0),
      );
    },
  );

  it('creates one template per workout for the 5x5 preset', async () => {
    const db = createMockDb(uniqueNamesIn(LINEAR_5X5));

    const result = await importPreset(db as never, LINEAR_5X5);

    expect(result.presetId).toBe('linear-5x5');
    expect(result.templates).toHaveLength(LINEAR_5X5.workouts.length);
    expect(db._templates).toHaveLength(LINEAR_5X5.workouts.length);

    const expectedItemCount = LINEAR_5X5.workouts.reduce(
      (n, w) => n + w.exercises.length,
      0,
    );
    expect(db._template_items).toHaveLength(expectedItemCount);

    expect(result.templates.map((t) => t.name)).toEqual(
      LINEAR_5X5.workouts.map((w) => w.name),
    );
  });

  it('creates one template per workout for the PPL preset', async () => {
    const db = createMockDb(uniqueNamesIn(REDDIT_PPL));

    const result = await importPreset(db as never, REDDIT_PPL);

    expect(result.templates).toHaveLength(REDDIT_PPL.workouts.length);
    expect(db._templates).toHaveLength(REDDIT_PPL.workouts.length);

    const expectedItemCount = REDDIT_PPL.workouts.reduce(
      (n, w) => n + w.exercises.length,
      0,
    );
    expect(db._template_items).toHaveLength(expectedItemCount);
  });

  it('preserves item order, sets, reps, rest, and progression metadata', async () => {
    const db = createMockDb(uniqueNamesIn(REDDIT_PPL));

    const result = await importPreset(db as never, REDDIT_PPL);

    const firstWorkout = REDDIT_PPL.workouts[0]!;
    const firstTemplate = result.templates[0]!;
    const items = db._template_items.filter((it) => it.template_id === firstTemplate.id);

    expect(items).toHaveLength(firstWorkout.exercises.length);

    items.forEach((item, i) => {
      const source = firstWorkout.exercises[i]!;
      expect(item.position).toBe(i);
      expect(item.target_sets).toBe(source.targetSets);
      expect(item.target_reps).toBe(source.targetReps);
      expect(item.rest_seconds).toBe(source.restSeconds ?? null);
      expect(item.progression_rule).toBe(source.progression.rule);

      if (source.progression.rule === 'double') {
        expect(item.rep_range_min).toBe(source.progression.repRangeMin);
        expect(item.rep_range_max).toBe(source.progression.repRangeMax);
      }
      if (source.progression.rule !== 'none') {
        if (source.progression.incrementKg != null) {
          expect(item.increment_kg).toBe(source.progression.incrementKg);
        }
        if (source.progression.incrementLb != null) {
          expect(item.increment_lb).toBe(source.progression.incrementLb);
        }
      }

      const expectedAmrap = source.amrapLastSet ? 1 : 0;
      expect(item.amrap_last_set).toBe(expectedAmrap);
    });
  });

  it('importing twice creates independent template rows (no merge, no overwrite)', async () => {
    const db = createMockDb(uniqueNamesIn(LINEAR_5X5));

    const first = await importPreset(db as never, LINEAR_5X5);
    const second = await importPreset(db as never, LINEAR_5X5);

    expect(db._templates).toHaveLength(LINEAR_5X5.workouts.length * 2);

    const firstIds = new Set(first.templates.map((t) => t.id));
    const secondIds = new Set(second.templates.map((t) => t.id));
    for (const id of secondIds) {
      expect(firstIds.has(id)).toBe(false);
    }
  });

  it('throws PresetExerciseResolutionError when an exercise cannot be resolved', async () => {
    // Drop one exercise so it fails to resolve.
    const names = uniqueNamesIn(LINEAR_5X5).slice(1);
    const db = createMockDb(names);

    await expect(importPreset(db as never, LINEAR_5X5)).rejects.toBeInstanceOf(
      PresetExerciseResolutionError,
    );
  });

  it('writes no partial templates when resolution fails', async () => {
    const names = uniqueNamesIn(LINEAR_5X5).slice(1);
    const db = createMockDb(names);

    await expect(importPreset(db as never, LINEAR_5X5)).rejects.toBeInstanceOf(
      PresetExerciseResolutionError,
    );

    expect(db._templates).toHaveLength(0);
    expect(db._template_items).toHaveLength(0);
    // No INSERTs should have been attempted at all post-resolution.
    const inserts = db.runAsync.mock.calls.filter(([sql]) =>
      /^INSERT INTO templates|^INSERT INTO template_items/.test(sql as string),
    );
    expect(inserts).toHaveLength(0);
  });

  it('rolls back previously-created templates if a later insert fails', async () => {
    const db = createMockDb(uniqueNamesIn(REDDIT_PPL), { failOnTemplateInsertAt: 3 });

    await expect(importPreset(db as never, REDDIT_PPL)).rejects.toThrow(
      'simulated template insert failure',
    );

    expect(db._templates).toHaveLength(0);
    expect(db._template_items).toHaveLength(0);
  });

  it('falls back to alias lookup when the canonical name is not found', async () => {
    const preset: ProgramPreset = {
      id: 'tiny',
      name: 'Tiny',
      shortDescription: 's',
      description: 'd',
      daysPerWeek: 1,
      experienceLevel: 'beginner',
      defaultUnit: 'kg',
      workouts: [
        {
          key: 'w1',
          name: 'Workout 1',
          exercises: [
            {
              match: { normalizedName: 'phantom exercise', aliases: ['barbell back squat'] },
              targetSets: 5,
              targetReps: 5,
              progression: { rule: 'none' },
            },
          ],
        },
      ],
    };

    const db = createMockDb(['barbell back squat']);

    const result = await importPreset(db as never, preset);

    expect(result.templates).toHaveLength(1);
    expect(db._template_items).toHaveLength(1);
    expect(db._template_items[0]!.exercise_id).toBe('ex-0');
  });
});
