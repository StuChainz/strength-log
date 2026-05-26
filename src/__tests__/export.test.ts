import { exportDatabase } from '@/db/repositories/export.repo';
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

  it('includes final exercise PR records in v1 exports', () => {
    expect(EXPORT_TABLES).toContain('exercise_prs');
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

  it('exports missing optional local tables as empty arrays instead of crashing', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const db = {
      getAllAsync: jest.fn(async (sql: string) => {
        if (sql.includes('exercise_prs')) throw new Error('no such table: exercise_prs');
        if (sql.includes('post_session_tags')) throw new Error('no such table: post_session_tags');
        return [];
      }),
    };

    const exported = await exportDatabase(db as never);

    expect(Object.keys(exported.tables).sort()).toEqual([...EXPORT_TABLES].sort());
    expect(exported.tables.exercise_prs).toEqual([]);
    expect(exported.tables.post_session_tags).toEqual([]);
    expect(validateExportPayload(exported)).toBe(true);
    expect(warnSpy).toHaveBeenCalledWith(
      '[export] Missing table "exercise_prs" during export; exporting it as empty',
      expect.any(Error),
    );
    warnSpy.mockRestore();
  });
});
