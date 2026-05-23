import { type SQLiteDatabase } from 'expo-sqlite';
import { type Exercise } from '@/domain/types';
import { newId, normalizeName } from '@/domain/ids';
import { type CreateExerciseInput, type UpdateExerciseInput } from '@/domain/validation';

export async function getExerciseCount(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM exercises WHERE archived_at IS NULL',
  );
  return row?.count ?? 0;
}

export async function getAllExercises(db: SQLiteDatabase): Promise<Exercise[]> {
  return db.getAllAsync<Exercise>(
    'SELECT * FROM exercises WHERE archived_at IS NULL ORDER BY name ASC',
  );
}

export async function getExerciseById(
  db: SQLiteDatabase,
  id: string,
): Promise<Exercise | null> {
  return db.getFirstAsync<Exercise>('SELECT * FROM exercises WHERE id = ?', [id]);
}

export async function searchExercises(
  db: SQLiteDatabase,
  query: string,
): Promise<Exercise[]> {
  const needle = normalizeName(query);
  return db.getAllAsync<Exercise>(
    `SELECT * FROM exercises
     WHERE normalized_name LIKE ? AND archived_at IS NULL
     ORDER BY name ASC`,
    [`%${needle}%`],
  );
}

export async function createExercise(
  db: SQLiteDatabase,
  input: CreateExerciseInput,
): Promise<Exercise> {
  const now = Date.now();
  const id = newId();
  const normalised = normalizeName(input.name);

  await db.runAsync(
    `INSERT INTO exercises
       (id, name, normalized_name, category, primary_muscle, default_unit,
        is_custom, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    [
      id,
      input.name,
      normalised,
      input.category,
      input.primary_muscle ?? null,
      input.default_unit ?? null,
      now,
      now,
    ],
  );

  return (await getExerciseById(db, id))!;
}

export async function updateExercise(
  db: SQLiteDatabase,
  id: string,
  input: UpdateExerciseInput,
): Promise<Exercise | null> {
  const existing = await getExerciseById(db, id);
  if (!existing) return null;

  const name = input.name ?? existing.name;
  const normalised = input.name ? normalizeName(input.name) : existing.normalized_name;

  await db.runAsync(
    `UPDATE exercises
     SET name = ?, normalized_name = ?, category = ?,
         primary_muscle = ?, default_unit = ?, updated_at = ?
     WHERE id = ?`,
    [
      name,
      normalised,
      input.category ?? existing.category,
      input.primary_muscle !== undefined ? (input.primary_muscle ?? null) : existing.primary_muscle,
      input.default_unit !== undefined ? (input.default_unit ?? null) : existing.default_unit,
      Date.now(),
      id,
    ],
  );

  return getExerciseById(db, id);
}

export async function archiveExercise(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('UPDATE exercises SET archived_at = ? WHERE id = ?', [Date.now(), id]);
}
