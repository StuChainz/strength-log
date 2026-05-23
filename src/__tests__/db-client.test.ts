/**
 * Tests for the DB client: migration runner and seed idempotency.
 *
 * expo-sqlite is mocked with a stateful in-memory store so we can run the real
 * client.ts / migration / seed logic without a native SQLite binary.
 */

import { openDb, _resetDbSingleton } from '@/db/client';

// jest.mock is hoisted by Babel before any imports, so the factory can safely
// reference `mockDb` (a let declared below) via closure.
jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(async () => mockDb),
}));

// ─── Stateful mock DB ─────────────────────────────────────────────────────────

type Row = Record<string, string | number | null>;

let mockDb: ReturnType<typeof createMockDb>;

function createMockDb() {
  const tables: Record<string, Row[]> = {};
  const execCalls: string[] = [];
  const runCalls: { sql: string; params: (string | number | null)[] }[] = [];

  function ensureTable(name: string) {
    if (!tables[name]) tables[name] = [];
  }

  return {
    _execCalls: execCalls,
    _runCalls: runCalls,
    _tables: tables,

    execAsync: jest.fn(async (sql: string) => {
      execCalls.push(sql);
      for (const [, name] of sql.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)) {
        ensureTable(name);
      }
    }),

    runAsync: jest.fn(async (sql: string, params: (string | number | null)[] = []) => {
      runCalls.push({ sql, params });
      if (/INSERT INTO _migrations/.test(sql) && params[0] != null) {
        ensureTable('_migrations');
        tables['_migrations'].push({ name: params[0] as string, applied_at: params[1] as number });
      }
      if (/INSERT INTO exercises/.test(sql) && !/INSERT OR IGNORE/.test(sql)) {
        ensureTable('exercises');
        tables['exercises'].push({ id: params[0] as string, is_custom: 0 });
      }
      return { lastInsertRowId: 1, changes: 1 };
    }),

    getFirstAsync: jest.fn(async (sql: string, params: (string | number | null)[] = []) => {
      if (/FROM _migrations/.test(sql) && params[0] != null) {
        ensureTable('_migrations');
        return tables['_migrations'].find((r) => r.name === params[0]) ?? null;
      }
      if (/COUNT\(\*\)/.test(sql) && /exercises/.test(sql)) {
        ensureTable('exercises');
        return { count: tables['exercises'].filter((r) => r.is_custom === 0).length };
      }
      return null;
    }),

    getAllAsync: jest.fn(async () => [] as Row[]),
    withTransactionAsync: jest.fn(async (task: () => Promise<void>) => task()),
    closeAsync: jest.fn(async () => {}),
  };
}

// ─── Test lifecycle ───────────────────────────────────────────────────────────

beforeEach(() => {
  mockDb = createMockDb();
  _resetDbSingleton();
  jest.clearAllMocks();
  // Re-point openDatabaseAsync to the freshly created mockDb.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  (require('expo-sqlite') as { openDatabaseAsync: jest.Mock }).openDatabaseAsync.mockResolvedValue(
    mockDb,
  );
});

// ─── Migration runner ─────────────────────────────────────────────────────────

describe('Migration runner', () => {
  it('applies the 001_init migration on first open', async () => {
    await openDb();
    expect(mockDb._tables['_migrations']?.find((r) => r.name === '001_init')).toBeDefined();
  });

  it('does not re-apply migrations on second open', async () => {
    await openDb();
    _resetDbSingleton();
    await openDb();

    const migrationInserts = mockDb._runCalls.filter((c) =>
      /INSERT INTO _migrations/.test(c.sql),
    );
    expect(migrationInserts).toHaveLength(2);
  });

  it('wraps migration SQL in a transaction', async () => {
    await openDb();
    expect(mockDb.withTransactionAsync).toHaveBeenCalled();
  });

  it('creates the _migrations bootstrap table on every open', async () => {
    await openDb();
    const bootstrapCalls = mockDb._execCalls.filter((s) =>
      /CREATE TABLE IF NOT EXISTS _migrations/.test(s),
    );
    expect(bootstrapCalls.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── Seed idempotency ─────────────────────────────────────────────────────────

describe('Seed idempotency', () => {
  it('inserts seed exercises on first open', async () => {
    await openDb();
    const exerciseInserts = mockDb._runCalls.filter((c) => /INSERT INTO exercises/.test(c.sql));
    expect(exerciseInserts.length).toBeGreaterThan(0);
  });

  it('does not re-seed on second open when exercises already exist', async () => {
    await openDb();
    const countAfterFirst = mockDb._runCalls.filter((c) =>
      /INSERT INTO exercises/.test(c.sql),
    ).length;

    _resetDbSingleton();
    await openDb();
    const countAfterSecond = mockDb._runCalls.filter((c) =>
      /INSERT INTO exercises/.test(c.sql),
    ).length;

    expect(countAfterSecond).toBe(countAfterFirst); // no new inserts
  });
});
