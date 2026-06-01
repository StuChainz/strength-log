import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { MIGRATIONS } from './migrations';
import { seedExercises } from './seed/exercises';

let _db: SQLiteDatabase | null = null;
let _openingDb: Promise<SQLiteDatabase> | null = null;

const REQUIRED_TABLES = [
  'users',
  'exercises',
  'exercise_aliases',
  'templates',
  'template_items',
  'workout_sessions',
  'workout_events',
  'workout_sets',
  'exercise_prs',
  'exercise_history_cache',
  'post_session_tags',
  'session_notes',
  'metric_samples',
  'weekly_insight_cards',
  'app_settings',
  'exercise_metadata',
] as const;

/**
 * Open (or return the cached) SQLite database.
 * Runs pending migrations and seeds on first call.
 */
export async function openDb(): Promise<SQLiteDatabase> {
  if (_db) return _db;
  if (_openingDb) return _openingDb;

  _openingDb = (async () => {
    const db = await openDatabaseAsync('strengthlog.db');
    await enableForeignKeys(db);
    await runMigrations(db);
    await seedExercises(db);
    _db = db;
    return db;
  })();

  try {
    return await _openingDb;
  } catch (error) {
    _openingDb = null;
    throw error;
  } finally {
    if (_db) _openingDb = null;
  }
}

/**
 * Reset the singleton. Used in tests only.
 */
export function _resetDbSingleton(): void {
  _db = null;
  _openingDb = null;
}

export async function resetLocalData(): Promise<void> {
  const db = await openDb();
  await enableForeignKeys(db);
  await db.execAsync(`
    DROP TABLE IF EXISTS app_settings;
    DROP TABLE IF EXISTS weekly_insight_cards;
    DROP TABLE IF EXISTS metric_samples;
    DROP TABLE IF EXISTS session_notes;
    DROP TABLE IF EXISTS post_session_tags;
    DROP TABLE IF EXISTS exercise_history_cache;
    DROP TABLE IF EXISTS exercise_prs;
    DROP TABLE IF EXISTS workout_sets;
    DROP TABLE IF EXISTS workout_events;
    DROP TABLE IF EXISTS workout_sessions;
    DROP TABLE IF EXISTS template_items;
    DROP TABLE IF EXISTS templates;
    DROP TABLE IF EXISTS exercise_metadata;
    DROP TABLE IF EXISTS exercise_aliases;
    DROP TABLE IF EXISTS exercises;
    DROP TABLE IF EXISTS users;
    DROP TABLE IF EXISTS _migrations;
  `);
  await runMigrations(db);
  await seedExercises(db);
}

// ─── Migration runner ─────────────────────────────────────────────────────────

async function enableForeignKeys(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA foreign_keys = ON;');
}

async function runMigrations(db: SQLiteDatabase): Promise<void> {
  // Bootstrap the migrations tracking table.
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name       TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );
  `);

  for (const migration of MIGRATIONS) {
    const already = await db.getFirstAsync<{ name: string }>(
      'SELECT name FROM _migrations WHERE name = ?',
      [migration.name],
    );
    if (already) continue;

    // Apply the migration in a transaction so it's all-or-nothing.
    await db.withTransactionAsync(async () => {
      const applied = await runMigrationSql(db, migration.sql);
      if (applied) {
        await db.runAsync('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)', [
          migration.name,
          Date.now(),
        ]);
      }
    });
  }

  await repairMissingRequiredTables(db);
}

async function getMissingRequiredTables(db: SQLiteDatabase): Promise<string[]> {
  const rows = await db.getAllAsync<{ name: string }>(
    `SELECT name
       FROM sqlite_master
      WHERE type = 'table'
        AND name IN (${REQUIRED_TABLES.map(() => '?').join(', ')})`,
    [...REQUIRED_TABLES],
  );
  const existing = new Set(rows.map((row) => row.name));
  return REQUIRED_TABLES.filter((table) => !existing.has(table));
}

async function repairMissingRequiredTables(db: SQLiteDatabase): Promise<void> {
  const missing = await getMissingRequiredTables(db);
  if (missing.length === 0) return;

  for (const migration of MIGRATIONS) {
    await db.withTransactionAsync(async () => {
      const applied = await runMigrationSql(db, migration.sql);
      if (applied) {
        await db.runAsync('INSERT OR IGNORE INTO _migrations (name, applied_at) VALUES (?, ?)', [
          migration.name,
          Date.now(),
        ]);
      }
    });
  }

  const stillMissing = await getMissingRequiredTables(db);
  if (stillMissing.length > 0) {
    throw new Error(`Database schema repair failed. Missing tables: ${stillMissing.join(', ')}`);
  }
}

async function runMigrationSql(db: SQLiteDatabase, sql: string): Promise<boolean> {
  if (/idx_one_in_progress_session/i.test(sql) && (await hasDuplicateInProgressSessions(db))) {
    return false;
  }

  if (/CREATE\s+TRIGGER/i.test(sql)) {
    await db.execAsync(sql);
    return true;
  }

  const statements = sql
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    const addedColumn = parseAddColumnStatement(statement);
    if (addedColumn && (await columnExists(db, addedColumn.tableName, addedColumn.columnName))) {
      continue;
    }

    await db.execAsync(`${statement};`);
  }

  return true;
}

function parseAddColumnStatement(
  statement: string,
): { tableName: string; columnName: string } | null {
  const normalized = statement.replace(/\s+/g, ' ');
  const match = /^ALTER TABLE (\w+) ADD COLUMN (\w+)\b/i.exec(normalized);
  if (!match) return null;

  return { tableName: match[1]!, columnName: match[2]! };
}

async function columnExists(
  db: SQLiteDatabase,
  tableName: string,
  columnName: string,
): Promise<boolean> {
  const rows = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${tableName})`);
  return rows.some((row) => row.name === columnName);
}

async function hasDuplicateInProgressSessions(db: SQLiteDatabase): Promise<boolean> {
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) AS count FROM workout_sessions WHERE status = 'in_progress'",
  );
  return (row?.count ?? 0) > 1;
}
