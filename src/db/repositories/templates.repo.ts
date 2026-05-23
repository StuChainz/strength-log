import { type SQLiteDatabase } from 'expo-sqlite';
import { type Template, type TemplateItem, type ExerciseCategory } from '@/domain/types';
import { newId } from '@/domain/ids';

export interface TemplateItemWithExercise extends TemplateItem {
  exercise_name: string;
  exercise_category: ExerciseCategory;
  exercise_default_unit: 'kg' | 'lb' | null;
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
            e.default_unit AS exercise_default_unit
     FROM template_items ti
     JOIN exercises e ON e.id = ti.exercise_id
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
      const item = data.items[i]!;
      await db.runAsync(
        `INSERT INTO template_items
           (id, template_id, exercise_id, position, target_sets, target_reps, target_weight, target_rpe)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newId(),
          id,
          item.exercise_id,
          i,
          item.target_sets,
          item.target_reps,
          item.target_weight,
          item.target_rpe,
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
      const item = data.items[i]!;
      await db.runAsync(
        `INSERT INTO template_items
           (id, template_id, exercise_id, position, target_sets, target_reps, target_weight, target_rpe)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newId(),
          id,
          item.exercise_id,
          i,
          item.target_sets,
          item.target_reps,
          item.target_weight,
          item.target_rpe,
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
