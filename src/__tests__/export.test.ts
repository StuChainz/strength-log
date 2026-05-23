import { EXPORT_TABLES, validateExportPayload, type StrengthLogExport } from '@/export/schema';

function emptyTables(): StrengthLogExport['tables'] {
  const tables = {} as StrengthLogExport['tables'];
  for (const table of EXPORT_TABLES) {
    tables[table] = [];
  }
  return tables;
}

describe('export schema', () => {
  it('includes exercise metadata in v1 exports', () => {
    expect(EXPORT_TABLES).toContain('exercise_metadata');
  });

  it('requires all v1 tables', () => {
    const payload: StrengthLogExport = {
      schemaVersion: 1,
      exportedAt: new Date(0).toISOString(),
      tables: emptyTables(),
    };

    expect(validateExportPayload(payload)).toBe(true);
  });

  it('rejects payloads missing a table', () => {
    const payload: StrengthLogExport = {
      schemaVersion: 1,
      exportedAt: new Date(0).toISOString(),
      tables: emptyTables(),
    };
    delete (payload.tables as Partial<StrengthLogExport['tables']>).workout_events;

    expect(validateExportPayload(payload)).toBe(false);
  });
});
