import { type SQLiteDatabase } from 'expo-sqlite';
import {
  type Template,
  type TemplateItem,
  type ExerciseCategory,
  type Mechanics,
  type MovementPattern,
  type BodyRegion,
  type ProgressionRule,
} from '@/domain/types';
import { newId } from '@/domain/ids';

export interface TemplateItemWithExercise extends TemplateItem {
  exercise_name: string;
  exercise_category: ExerciseCategory;
  exercise_default_unit: 'kg' | 'lb' | null;
  exercise_movement_pattern: MovementPattern | null;
  exercise_body_region: BodyRegion | null;
  exercise_mechanics: Mechanics | null;
  exercise_equipment_json: string | null;
}

export interface TemplateSummary {
  id: string;
  name: string;
  notes: string | null;
  archived_at: number | null;
  created_at: number;
  updated_at: number;
  item_count: number;
}

export interface DraftItemInput {
  exercise_id: string;
  target_sets: number | null;
  target_reps: number | null;
  target_weight: number | null;
  target_rpe: number | null;
  rest_seconds: number | null;
  note?: string | null;
  progression_rule?: ProgressionRule | null;
  increment_kg?: number | null;
  increment_lb?: number | null;
  rep_range_min?: number | null;
  rep_range_max?: number | null;
  rpe_cap?: number | null;
  amrap_last_set?: boolean | 0 | 1 | null;
}

interface NormalizedDraftItemInput
  extends Required<Omit<DraftItemInput, 'amrap_last_set' | 'note'>> {
  note: string | null;
  progression_rule: ProgressionRule;
  amrap_last_set: 0 | 1;
}

function assertValidRestSeconds(value: number | null): void {
  if (value !== null && (!Number.isInteger(value) || value <= 0)) {
    throw new RangeError('rest_seconds must be a positive integer when set');
  }
}

function assertPositiveNumber(value: number | null, field: string): void {
  if (value !== null && (!Number.isFinite(value) || value <= 0)) {
    throw new RangeError(`${field} must be a positive number when set`);
  }
}

function assertPositiveInteger(value: number | null, field: string): void {
  if (value !== null && (!Number.isInteger(value) || value <= 0)) {
    throw new RangeError(`${field} must be a positive integer when set`);
  }
}

function cleanText(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeDraftItem(item: DraftItemInput): NormalizedDraftItemInput {
  const progressionRule = item.progression_rule ?? 'none';
  if (!['none', 'linear', 'double', 'rpe_gated'].includes(progressionRule)) {
    throw new RangeError('progression_rule must be none, linear, double, or rpe_gated');
  }

  const normalized: NormalizedDraftItemInput = {
    exercise_id: item.exercise_id,
    target_sets: item.target_sets,
    target_reps: item.target_reps,
    target_weight: item.target_weight,
    target_rpe: item.target_rpe,
    rest_seconds: item.rest_seconds,
    note: cleanText(item.note),
    progression_rule: progressionRule,
    increment_kg: item.increment_kg ?? null,
    increment_lb: item.increment_lb ?? null,
    rep_range_min: item.rep_range_min ?? null,
    rep_range_max: item.rep_range_max ?? null,
    rpe_cap: item.rpe_cap ?? null,
    amrap_last_set: item.amrap_last_set ? 1 : 0,
  };

  assertValidRestSeconds(normalized.rest_seconds);
  assertPositiveNumber(normalized.increment_kg, 'increment_kg');
  assertPositiveNumber(normalized.increment_lb, 'increment_lb');
  assertPositiveInteger(normalized.rep_range_min, 'rep_range_min');
  assertPositiveInteger(normalized.rep_range_max, 'rep_range_max');

  if (
    normalized.rep_range_min !== null &&
    normalized.rep_range_max !== null &&
    normalized.rep_range_min > normalized.rep_range_max
  ) {
    throw new RangeError('rep_range_min must be less than or equal to rep_range_max');
  }

  if (
    normalized.rpe_cap !== null &&
    (!Number.isFinite(normalized.rpe_cap) || normalized.rpe_cap < 1 || normalized.rpe_cap > 10)
  ) {
    throw new RangeError('rpe_cap must be between 1 and 10 when set');
  }

  if (normalized.progression_rule !== 'double') {
    normalized.rep_range_min = null;
    normalized.rep_range_max = null;
  }
  if (normalized.progression_rule !== 'rpe_gated') {
    normalized.rpe_cap = null;
  }
  if (normalized.progression_rule === 'none') {
    normalized.increment_kg = null;
    normalized.increment_lb = null;
  }

  return normalized;
}

export async function getAllTemplates(db: SQLiteDatabase): Promise<Template[]> {
  return db.getAllAsync<Template>(
    'SELECT * FROM templates WHERE archived_at IS NULL ORDER BY name ASC',
  );
}

export async function getAllTemplatesWithCount(db: SQLiteDatabase): Promise<TemplateSummary[]> {
  return db.getAllAsync<TemplateSummary>(
    `SELECT t.*, COUNT(ti.id) AS item_count
     FROM templates t
     LEFT JOIN template_items ti ON ti.template_id = t.id
     WHERE t.archived_at IS NULL
     GROUP BY t.id
     ORDER BY t.name ASC`,
  );
}

export async function getTemplateById(
  db: SQLiteDatabase,
  id: string,
): Promise<Template | null> {
  return db.getFirstAsync<Template>('SELECT * FROM templates WHERE id = ?', [id]);
}

export async function getTemplateItemsWithExercise(
  db: SQLiteDatabase,
  templateId: string,
): Promise<TemplateItemWithExercise[]> {
  return db.getAllAsync<TemplateItemWithExercise>(
    `SELECT ti.*, e.name AS exercise_name, e.category AS exercise_category,
            e.default_unit AS exercise_default_unit,
            em.movement_pattern AS exercise_movement_pattern,
            em.body_region AS exercise_body_region,
            em.mechanics AS exercise_mechanics,
            em.equipment_json AS exercise_equipment_json
     FROM template_items ti
     JOIN exercises e ON e.id = ti.exercise_id
     LEFT JOIN exercise_metadata em ON em.exercise_id = e.id
     WHERE ti.template_id = ?
     ORDER BY ti.position ASC`,
    [templateId],
  );
}

export async function createTemplate(
  db: SQLiteDatabase,
  data: { name: string; notes: string | null; items: DraftItemInput[] },
): Promise<Template> {
  const id = newId();
  const now = Date.now();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO templates (id, name, notes, archived_at, created_at, updated_at)
       VALUES (?, ?, ?, NULL, ?, ?)`,
      [id, data.name, data.notes, now, now],
    );
    for (let i = 0; i < data.items.length; i++) {
      const item = normalizeDraftItem(data.items[i]!);
      await db.runAsync(
        `INSERT INTO template_items
           (id, template_id, exercise_id, position, target_sets, target_reps, target_weight,
            target_rpe, rest_seconds, note, progression_rule, increment_kg, increment_lb,
            rep_range_min, rep_range_max, rpe_cap, amrap_last_set)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newId(),
          id,
          item.exercise_id,
          i,
          item.target_sets,
          item.target_reps,
          item.target_weight,
          item.target_rpe,
          item.rest_seconds,
          item.note,
          item.progression_rule,
          item.increment_kg,
          item.increment_lb,
          item.rep_range_min,
          item.rep_range_max,
          item.rpe_cap,
          item.amrap_last_set,
        ],
      );
    }
  });

  return {
    id,
    name: data.name,
    notes: data.notes,
    archived_at: null,
    created_at: now,
    updated_at: now,
  };
}

export async function updateTemplate(
  db: SQLiteDatabase,
  id: string,
  data: { name: string; notes: string | null; items: DraftItemInput[] },
): Promise<void> {
  const now = Date.now();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE templates SET name = ?, notes = ?, updated_at = ? WHERE id = ?`,
      [data.name, data.notes, now, id],
    );
    await db.runAsync(`DELETE FROM template_items WHERE template_id = ?`, [id]);
    for (let i = 0; i < data.items.length; i++) {
      const item = normalizeDraftItem(data.items[i]!);
      await db.runAsync(
        `INSERT INTO template_items
           (id, template_id, exercise_id, position, target_sets, target_reps, target_weight,
            target_rpe, rest_seconds, note, progression_rule, increment_kg, increment_lb,
            rep_range_min, rep_range_max, rpe_cap, amrap_last_set)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newId(),
          id,
          item.exercise_id,
          i,
          item.target_sets,
          item.target_reps,
          item.target_weight,
          item.target_rpe,
          item.rest_seconds,
          item.note,
          item.progression_rule,
          item.increment_kg,
          item.increment_lb,
          item.rep_range_min,
          item.rep_range_max,
          item.rpe_cap,
          item.amrap_last_set,
        ],
      );
    }
  });
}

export async function archiveTemplate(db: SQLiteDatabase, id: string): Promise<void> {
  const now = Date.now();
  await db.runAsync(
    `UPDATE templates SET archived_at = ?, updated_at = ? WHERE id = ?`,
    [now, now, id],
  );
}
