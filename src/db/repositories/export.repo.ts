import { type SQLiteDatabase } from 'expo-sqlite';
import {
  EXPORT_TABLES,
  validateExportPayload,
  type StrengthLogExport,
} from '@/export/schema';

export async function exportDatabase(db: SQLiteDatabase): Promise<StrengthLogExport> {
  const tables = {} as StrengthLogExport['tables'];

  for (const table of EXPORT_TABLES) {
    tables[table] = await db.getAllAsync(`SELECT * FROM ${table}`);
  }

  const payload: StrengthLogExport = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    tables,
  };

  if (!validateExportPayload(payload)) {
    throw new Error('Export payload failed schema validation');
  }

  return payload;
}
