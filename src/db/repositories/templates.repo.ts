// Phase 4 — Template builder
// Stub: types and signatures only. Implementation added in Phase 4.
import { type SQLiteDatabase } from 'expo-sqlite';
import { type Template } from '@/domain/types';

export async function getAllTemplates(db: SQLiteDatabase): Promise<Template[]> {
  return db.getAllAsync<Template>(
    'SELECT * FROM templates WHERE archived_at IS NULL ORDER BY name ASC',
  );
}

export async function getTemplateById(
  db: SQLiteDatabase,
  id: string,
): Promise<Template | null> {
  return db.getFirstAsync<Template>('SELECT * FROM templates WHERE id = ?', [id]);
}
