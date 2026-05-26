/**
 * Tests for the DB client: migration runner and seed idempotency.
 *
 * expo-sqlite is mocked with a stateful in-memory store so we can run the real
 * client.ts / migration / seed logic without a native SQLite binary.
 */

import { openDb, resetLocalData, _resetDbSingleton } from '@/db/client';
import { MIGRATIONS } from '@/db/migrations';
import { getAllExercises } from '@/db/repositories/exercises.repo';
import { SEED_EXERCISES } from '@/db/seed/exercises';

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
      for (const [, name] of sql.matchAll(/DROP TABLE IF EXISTS (\w+)/g)) {
        delete tables[name];
      }
      for (const [, name] of sql.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)) {
        ensureTable(name);
      }
    }),

    runAsync: jest.fn(async (sql: string, params: (string | number | null)[] = []) => {
      runCalls.push({ sql, params });
      if (/INSERT(?: OR IGNORE)? INTO _migrations/.test(sql) && params[0] != null) {
        ensureTable('_migrations');
        if (!tables['_migrations'].some((row) => row.name === params[0])) {
          tables['_migrations'].push({
            name: params[0] as string,
            applied_at: params[1] as number,
          });
        }
      }
      if (/INSERT INTO exercises/.test(sql) && !/INSERT OR IGNORE/.test(sql)) {
        ensureTable('exercises');
        tables['exercises'].push({
          id: params[0] as string,
          name: params[1] as string,
          normalized_name: params[2] as string,
          is_custom: 0,
          archived_at: null,
        });
      }
      if (/INSERT OR IGNORE INTO exercise_aliases/.test(sql) && params[1] != null) {
        ensureTable('exercise_aliases');
        const alias = params[2] as string;
        if (!tables['exercise_aliases'].some((r) => r.alias === alias)) {
          tables['exercise_aliases'].push({
            id: params[0] as string,
            exercise_id: params[1] as string,
            alias,
            source: 'seed',
            created_at: params[3] as number,
          });
        }
      }
      if (/INSERT INTO exercise_metadata/.test(sql) && params[0] != null) {
        ensureTable('exercise_metadata');
        const source = params[11] as string;
        const existing = tables['exercise_metadata'].find((r) => r.exercise_id === params[0]);
        if (!existing) {
          tables['exercise_metadata'].push({
            exercise_id: params[0] as string,
            movement_pattern: params[1] as string,
            force_type: params[2] as string,
            source,
          });
        } else if (existing.source === source) {
          existing.movement_pattern = params[1] as string;
          existing.force_type = params[2] as string;
        }
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
      if (/SELECT id FROM exercises/.test(sql) && params[0] != null) {
        ensureTable('exercises');
        return (
          tables['exercises'].find((r) => r.normalized_name === params[0] && r.is_custom === 0) ??
          null
        );
      }
      return null;
    }),

    getAllAsync: jest.fn(async (sql: string) => {
      if (/FROM sqlite_master/.test(sql)) {
        return Object.keys(tables).map((name) => ({ name }));
      }
      if (/SELECT \* FROM exercises/.test(sql)) {
        ensureTable('exercises');
        return [...tables['exercises']].sort((a, b) =>
          String(a.name).localeCompare(String(b.name)),
        );
      }
      return [] as Row[];
    }),
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

  it('creates the exercise_metadata table', async () => {
    await openDb();
    expect(mockDb._tables.exercise_metadata).toBeDefined();
    const metadataMigration = mockDb._tables['_migrations']?.find(
      (r) => r.name === '003_exercise_metadata',
    );
    expect(metadataMigration).toBeDefined();
  });

  it('applies additional exercise metadata filter indexes', async () => {
    await openDb();
    const indexMigration = mockDb._tables['_migrations']?.find(
      (r) => r.name === '004_exercise_metadata_filter_indexes',
    );
    const migrationSql = mockDb._execCalls.join('\n');

    expect(indexMigration).toBeDefined();
    expect(migrationSql).toContain('idx_exercise_metadata_mechanics');
    expect(migrationSql).toContain('idx_exercise_metadata_laterality');
  });

  it('applies exercise metadata source lookup index', async () => {
    await openDb();
    const indexMigration = mockDb._tables['_migrations']?.find(
      (r) => r.name === '005_exercise_metadata_source_index',
    );
    const migrationSql = mockDb._execCalls.join('\n');

    expect(indexMigration).toBeDefined();
    expect(migrationSql).toContain('idx_exercise_metadata_source_source_id');
    expect(migrationSql).toContain('ON exercise_metadata (source, source_id)');
  });

  it('applies the workout set type migration', async () => {
    await openDb();
    const setTypeMigration = mockDb._tables['_migrations']?.find(
      (r) => r.name === '006_workout_set_type',
    );
    const migrationSql = mockDb._execCalls.join('\n');

    expect(setTypeMigration).toBeDefined();
    expect(migrationSql).toContain("ADD COLUMN set_type TEXT NOT NULL DEFAULT 'working'");
  });

  it('applies the exercise PR migration', async () => {
    await openDb();
    const prMigration = mockDb._tables['_migrations']?.find((r) => r.name === '007_exercise_prs');
    const migrationSql = mockDb._execCalls.join('\n');

    expect(prMigration).toBeDefined();
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS exercise_prs');
    expect(migrationSql).toContain('UNIQUE (exercise_id, session_id, record_key)');
  });

  it('does not re-apply migrations on second open', async () => {
    await openDb();
    _resetDbSingleton();
    await openDb();

    const migrationInserts = mockDb._runCalls.filter((c) => /INSERT INTO _migrations/.test(c.sql));
    expect(migrationInserts).toHaveLength(MIGRATIONS.length);
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

  it('repairs a native DB where migration markers exist but app tables are missing', async () => {
    mockDb._tables._migrations = MIGRATIONS.map((migration) => ({
      name: migration.name,
      applied_at: 1,
    }));

    await openDb();

    expect(mockDb._tables.exercises).toBeDefined();
    expect(mockDb._tables.exercise_metadata).toBeDefined();
    expect(mockDb._tables.exercises).toHaveLength(SEED_EXERCISES.length);
  });

  it('shares one startup promise for concurrent open calls', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sqlite = require('expo-sqlite') as { openDatabaseAsync: jest.Mock };

    await Promise.all([openDb(), openDb()]);

    expect(sqlite.openDatabaseAsync).toHaveBeenCalledTimes(1);
  });
});

// ─── Seed idempotency ─────────────────────────────────────────────────────────

describe('Seed idempotency', () => {
  it('inserts seed exercises on first open', async () => {
    await openDb();
    const exerciseInserts = mockDb._runCalls.filter((c) => /INSERT INTO exercises/.test(c.sql));
    expect(exerciseInserts.length).toBeGreaterThan(0);
    expect(mockDb._tables.exercises.length).toBeGreaterThan(0);
  });

  it('openDb seeds all curated exercises', async () => {
    await openDb();

    expect(mockDb._tables.exercises).toHaveLength(SEED_EXERCISES.length);
  });

  it('getAllExercises returns seeded rows', async () => {
    const db = await openDb();
    const exercises = await getAllExercises(db);

    expect(exercises).toHaveLength(SEED_EXERCISES.length);
    expect(exercises.map((exercise) => exercise.name)).toContain('Barbell Back Squat');
  });

  it('repairs missing seed exercises on an existing database', async () => {
    await openDb();
    mockDb._tables.exercises = mockDb._tables.exercises.filter(
      (exercise) => exercise.name !== 'Barbell Back Squat',
    );

    _resetDbSingleton();
    await openDb();

    expect(mockDb._tables.exercises.map((exercise) => exercise.name)).toContain(
      'Barbell Back Squat',
    );
    expect(mockDb._tables.exercises).toHaveLength(SEED_EXERCISES.length);
  });

  it('resetLocalData recreates and reseeds exercises', async () => {
    await openDb();
    mockDb._tables.exercises = [];

    await resetLocalData();

    expect(mockDb._tables.exercises).toHaveLength(SEED_EXERCISES.length);
    expect(mockDb._tables['_migrations']).toHaveLength(MIGRATIONS.length);
  });

  it('inserts seed metadata on first open', async () => {
    await openDb();
    expect(mockDb._tables.exercise_metadata.length).toBeGreaterThan(0);
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

  it('does not duplicate seed metadata on second open', async () => {
    await openDb();
    const countAfterFirst = mockDb._tables.exercise_metadata.length;

    _resetDbSingleton();
    await openDb();
    const countAfterSecond = mockDb._tables.exercise_metadata.length;

    expect(countAfterSecond).toBe(countAfterFirst);
  });

  it('upserts curated seed metadata so future fixture corrections can apply', async () => {
    await openDb();

    const metadataWrites = mockDb._runCalls.filter((c) =>
      /INSERT INTO exercise_metadata/.test(c.sql),
    );

    expect(metadataWrites[0].sql).toContain('ON CONFLICT(exercise_id) DO UPDATE');
    expect(metadataWrites[0].sql).toContain('exercise_metadata.source = excluded.source');
    expect(metadataWrites[0].sql).toContain('updated_at = excluded.updated_at');
  });
});
