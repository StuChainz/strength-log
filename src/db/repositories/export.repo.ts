import { type SQLiteDatabase } from 'expo-sqlite';
import { EXPORT_TABLES, validateExportPayload, type StrengthLogExport } from '@/export/schema';

function isMissingTableError(error: unknown): boolean {
  return error instanceof Error && /no such table/i.test(error.message);
}

export async function exportDatabase(db: SQLiteDatabase): Promise<StrengthLogExport> {
  const tables = {} as StrengthLogExport['tables'];

  for (const table of EXPORT_TABLES) {
    try {
      tables[table] = await db.getAllAsync(`SELECT * FROM ${table}`);
    } catch (error) {
      if (!isMissingTableError(error)) throw error;
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn(
          `[export] Missing table "${table}" during export; exporting it as empty`,
          error,
        );
      }
      tables[table] = [];
    }
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
