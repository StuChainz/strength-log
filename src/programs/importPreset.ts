import { type SQLiteDatabase } from 'expo-sqlite';
import { normalizeName } from '@/domain/ids';
import { createTemplate, type DraftItemInput } from '@/db/repositories/templates.repo';
import type { Template } from '@/domain/types';
import type { ExerciseMatch, ProgramExercise, ProgramPreset } from './types';

export interface ImportPresetResult {
  presetId: string;
  templates: Template[];
}

export class PresetExerciseResolutionError extends Error {
  readonly presetId: string;
  readonly unresolved: { workoutKey: string; position: number; normalizedName: string }[];

  constructor(
    presetId: string,
    unresolved: { workoutKey: string; position: number; normalizedName: string }[],
  ) {
    const summary = unresolved
      .map((u) => `${u.workoutKey}#${u.position} (${u.normalizedName})`)
      .join(', ');
    super(`Cannot import preset "${presetId}": unresolved exercises: ${summary}`);
    this.name = 'PresetExerciseResolutionError';
    this.presetId = presetId;
    this.unresolved = unresolved;
  }
}

async function resolveExerciseId(
  db: SQLiteDatabase,
  match: ExerciseMatch,
): Promise<string | null> {
  const candidates = [match.normalizedName, ...(match.aliases ?? [])].map((n) =>
    normalizeName(n),
  );

  for (const needle of candidates) {
    const byName = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM exercises
         WHERE normalized_name = ? AND archived_at IS NULL
         LIMIT 1`,
      [needle],
    );
    if (byName) return byName.id;

    const byAlias = await db.getFirstAsync<{ exercise_id: string }>(
      `SELECT a.exercise_id
         FROM exercise_aliases a
         JOIN exercises e ON e.id = a.exercise_id
         WHERE a.alias = ? AND e.archived_at IS NULL
         LIMIT 1`,
      [needle],
    );
    if (byAlias) return byAlias.exercise_id;
  }

  return null;
}

function toDraftItem(exerciseId: string, exercise: ProgramExercise): DraftItemInput {
  const cfg = exercise.progression;
  return {
    exercise_id: exerciseId,
    target_sets: exercise.targetSets,
    target_reps: exercise.targetReps,
    target_weight: exercise.targetWeight ?? null,
    target_rpe: exercise.targetRPE ?? null,
    rest_seconds: exercise.restSeconds ?? null,
    progression_rule: cfg.rule,
    increment_kg: cfg.incrementKg ?? null,
    increment_lb: cfg.incrementLb ?? null,
    rep_range_min: cfg.repRangeMin ?? null,
    rep_range_max: cfg.repRangeMax ?? null,
    rpe_cap: cfg.rpeCap ?? null,
    amrap_last_set: exercise.amrapLastSet ? 1 : 0,
  };
}

/**
 * Import a built-in ProgramPreset into normal editable templates.
 *
 * One template is created per workout in the preset. All preset exercises are
 * resolved against the existing exercises table up-front; if any fail to
 * resolve, the import aborts before writing anything.
 *
 * If a subsequent template insert fails after some templates have been
 * created, the partially-imported templates are removed so the import is
 * all-or-nothing from the caller's perspective.
 */
export async function importPreset(
  db: SQLiteDatabase,
  preset: ProgramPreset,
): Promise<ImportPresetResult> {
  const resolutions: { workout: ProgramPreset['workouts'][number]; ids: string[] }[] = [];
  const unresolved: { workoutKey: string; position: number; normalizedName: string }[] = [];

  for (const workout of preset.workouts) {
    const ids: string[] = [];
    for (let i = 0; i < workout.exercises.length; i++) {
      const exercise = workout.exercises[i]!;
      const id = await resolveExerciseId(db, exercise.match);
      if (id === null) {
        unresolved.push({
          workoutKey: workout.key,
          position: i,
          normalizedName: exercise.match.normalizedName,
        });
      } else {
        ids.push(id);
      }
    }
    resolutions.push({ workout, ids });
  }

  if (unresolved.length > 0) {
    throw new PresetExerciseResolutionError(preset.id, unresolved);
  }

  const created: Template[] = [];
  try {
    for (const { workout, ids } of resolutions) {
      const items: DraftItemInput[] = workout.exercises.map((exercise, i) =>
        toDraftItem(ids[i]!, exercise),
      );
      const template = await createTemplate(db, {
        name: workout.name,
        notes: workout.notes ?? null,
        items,
      });
      created.push(template);
    }
  } catch (err) {
    for (const template of created) {
      try {
        await db.runAsync(`DELETE FROM template_items WHERE template_id = ?`, [template.id]);
        await db.runAsync(`DELETE FROM templates WHERE id = ?`, [template.id]);
      } catch {
        // Best-effort rollback; surface the original error to the caller.
      }
    }
    throw err;
  }

  return { presetId: preset.id, templates: created };
}
