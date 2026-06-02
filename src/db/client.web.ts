import { seedExercises } from './seed/exercises';
import type { Exercise, ExerciseAlias, ExerciseMetadata } from '@/domain/types';

type SqlParam = string | number | null;

type WebDbStore = {
  exercises: Exercise[];
  exercise_aliases: ExerciseAlias[];
  exercise_metadata: ExerciseMetadata[];
};

type WebDb = {
  getAllAsync: <T>(sql: string, params?: unknown[]) => Promise<T[]>;
  getFirstAsync: <T>(sql: string, params?: unknown[]) => Promise<T | null>;
  runAsync: (
    sql: string,
    params?: unknown[],
  ) => Promise<{ lastInsertRowId: number; changes: number }>;
  execAsync: (sql: string) => Promise<void>;
  withTransactionAsync: (fn: () => Promise<void>) => Promise<void>;
  _replaceStore: (nextStore: WebDbStore) => void;
};

const STORAGE_KEY = 'strengthlog.webdb.v1';

let _db: WebDb | null = null;
let _openingDb: Promise<WebDb> | null = null;

export async function openDb(): Promise<WebDb> {
  if (_db) return _db;
  if (_openingDb) return _openingDb;

  _openingDb = (async () => {
    const db = createWebDb(loadStore());
    await seedExercises(db as never);
    _db = db;
    return db;
  })();

  try {
    return await _openingDb;
  } finally {
    _openingDb = null;
  }
}

export function _resetDbSingleton(): void {
  _db = null;
  _openingDb = null;
}

export async function resetLocalData(): Promise<void> {
  removeStoredDb();
  const db = await openDb();
  db._replaceStore(createEmptyStore());
  await seedExercises(db as never);
}

function createWebDb(initialStore: WebDbStore): WebDb {
  let store = initialStore;

  const db: WebDb = {
    getAllAsync: async <T>(sql: string, params: unknown[] = []) =>
      getAll(store, sql, toSqlParams(params)) as T[],
    getFirstAsync: async <T>(sql: string, params: unknown[] = []) =>
      getFirst(store, sql, toSqlParams(params)) as T | null,
    runAsync: async (sql: string, params: unknown[] = []) => {
      const result = run(store, sql, toSqlParams(params));
      saveStore(store);
      return result;
    },
    execAsync: async (sql: string) => {
      if (/DROP TABLE IF EXISTS/i.test(sql)) {
        store = createEmptyStore();
        saveStore(store);
      }
    },
    withTransactionAsync: async (fn: () => Promise<void>) => {
      await fn();
      saveStore(store);
    },
    _replaceStore: (nextStore: WebDbStore) => {
      store = nextStore;
      saveStore(store);
    },
  };

  return db;
}

function getFirst(store: WebDbStore, sql: string, params: SqlParam[]): unknown | null {
  const normalizedSql = normalizeSql(sql);

  if (
    /SELECT id FROM exercises WHERE normalized_name = \? AND is_custom = 0/i.test(normalizedSql)
  ) {
    return (
      store.exercises.find(
        (exercise) =>
          exercise.normalized_name === params[0] &&
          exercise.is_custom === 0 &&
          exercise.archived_at === null,
      ) ?? null
    );
  }

  if (/SELECT \* FROM exercises WHERE id = \?/i.test(normalizedSql)) {
    return cloneRow(store.exercises.find((exercise) => exercise.id === params[0]) ?? null);
  }

  if (
    /SELECT substitution_group FROM exercise_metadata WHERE exercise_id = \?/i.test(normalizedSql)
  ) {
    const metadata = store.exercise_metadata.find((row) => row.exercise_id === params[0]);
    return metadata ? { substitution_group: metadata.substitution_group } : null;
  }

  if (/COUNT\(\*\) AS total/i.test(normalizedSql) && /FROM exercises/i.test(normalizedSql)) {
    const active = getActiveExercises(store);
    return {
      total: active.length,
      seed: active.filter((exercise) => exercise.is_custom === 0).length,
      custom: active.filter((exercise) => exercise.is_custom === 1).length,
    };
  }

  if (/SELECT COUNT\(\*\) AS count FROM exercise_metadata/i.test(normalizedSql)) {
    return { count: store.exercise_metadata.length };
  }

  if (/SELECT COUNT\(\*\) AS count FROM exercises/i.test(normalizedSql)) {
    return { count: getActiveExercises(store).length };
  }

  return null;
}

function getAll(store: WebDbStore, sql: string, params: SqlParam[]): unknown[] {
  const normalizedSql = normalizeSql(sql);

  if (/PRAGMA table_info\(\w+\)/i.test(normalizedSql)) return [];

  if (/FROM sqlite_master/i.test(normalizedSql)) {
    return ['exercises', 'exercise_aliases', 'exercise_metadata'].map((name) => ({ name }));
  }

  if (/FROM exercise_metadata m INNER JOIN exercises e/i.test(normalizedSql)) {
    const activeIds = new Set(getActiveExercises(store).map((exercise) => exercise.id));
    return store.exercise_metadata
      .filter((metadata) => activeIds.has(metadata.exercise_id))
      .map(cloneRow);
  }

  if (/SELECT id, name FROM exercises WHERE normalized_name IN/i.test(normalizedSql)) {
    const names = new Set(params);
    return getActiveExercises(store)
      .filter((exercise) => names.has(exercise.normalized_name))
      .map(({ id, name }) => ({ id, name }));
  }

  if (/LEFT JOIN exercise_metadata m ON m\.exercise_id = e\.id/i.test(normalizedSql)) {
    return filterExercisesWithMetadata(store, normalizedSql, params).map((exercise) =>
      toExerciseWithMetadataRow(store, exercise),
    );
  }

  if (/SELECT e\.\* FROM exercises e/i.test(normalizedSql)) {
    return filterExercisesWithMetadata(store, normalizedSql, params).map(cloneRow);
  }

  if (/SELECT \* FROM exercises/i.test(normalizedSql)) {
    return getActiveExercises(store).map(cloneRow);
  }

  return [];
}

function run(
  store: WebDbStore,
  sql: string,
  params: SqlParam[],
): { lastInsertRowId: number; changes: number } {
  const normalizedSql = normalizeSql(sql);

  if (/INSERT INTO exercises/i.test(normalizedSql) && !/INSERT OR IGNORE/i.test(normalizedSql)) {
    const isCustom = /VALUES \(\?, \?, \?, \?, \?, \?, 1, \?, \?\)/i.test(normalizedSql) ? 1 : 0;
    store.exercises.push({
      id: String(params[0]),
      name: String(params[1]),
      normalized_name: String(params[2]),
      category: params[3] as Exercise['category'],
      primary_muscle: params[4] === undefined ? null : (params[4] as string | null),
      default_unit: params[5] as Exercise['default_unit'],
      is_custom: isCustom,
      archived_at: null,
      created_at: Number(params[6]),
      updated_at: Number(params[7]),
    });
    return { lastInsertRowId: store.exercises.length, changes: 1 };
  }

  if (/INSERT OR IGNORE INTO exercise_aliases/i.test(normalizedSql)) {
    const alias = String(params[2]);
    if (store.exercise_aliases.some((row) => row.alias === alias)) {
      return { lastInsertRowId: 0, changes: 0 };
    }
    store.exercise_aliases.push({
      id: String(params[0]),
      exercise_id: String(params[1]),
      alias,
      source: 'seed',
      created_at: Number(params[3]),
    });
    return { lastInsertRowId: store.exercise_aliases.length, changes: 1 };
  }

  if (/INSERT INTO exercise_metadata/i.test(normalizedSql)) {
    const next: ExerciseMetadata = {
      exercise_id: String(params[0]),
      movement_pattern: params[1] as ExerciseMetadata['movement_pattern'],
      force_type: params[2] as ExerciseMetadata['force_type'],
      body_region: params[3] as ExerciseMetadata['body_region'],
      primary_muscles_json: String(params[4] ?? '[]'),
      secondary_muscles_json: String(params[5] ?? '[]'),
      equipment_json: String(params[6] ?? '[]'),
      mechanics: params[7] as ExerciseMetadata['mechanics'],
      laterality: params[8] as ExerciseMetadata['laterality'],
      difficulty: params[9] === null ? null : Number(params[9]),
      substitution_group: params[10] as string | null,
      source: String(params[11]),
      source_id: params[12] as string | null,
      updated_at: Number(params[13]),
    };
    const index = store.exercise_metadata.findIndex((row) => row.exercise_id === next.exercise_id);
    if (index === -1) {
      store.exercise_metadata.push(next);
      return { lastInsertRowId: store.exercise_metadata.length, changes: 1 };
    }
    if (store.exercise_metadata[index]?.source === next.source) {
      store.exercise_metadata[index] = next;
      return { lastInsertRowId: index + 1, changes: 1 };
    }
    return { lastInsertRowId: 0, changes: 0 };
  }

  if (/UPDATE exercises SET name = \?, normalized_name = \?, category = \?/i.test(normalizedSql)) {
    const exercise = store.exercises.find((row) => row.id === params[6]);
    if (!exercise) return { lastInsertRowId: 0, changes: 0 };

    exercise.name = String(params[0]);
    exercise.normalized_name = String(params[1]);
    exercise.category = params[2] as Exercise['category'];
    exercise.primary_muscle = params[3] as string | null;
    exercise.default_unit = params[4] as Exercise['default_unit'];
    exercise.updated_at = Number(params[5]);
    return { lastInsertRowId: 0, changes: 1 };
  }

  if (/UPDATE exercises SET archived_at = \? WHERE id = \?/i.test(normalizedSql)) {
    const exercise = store.exercises.find((row) => row.id === params[1]);
    if (!exercise) return { lastInsertRowId: 0, changes: 0 };

    exercise.archived_at = Number(params[0]);
    return { lastInsertRowId: 0, changes: 1 };
  }

  return { lastInsertRowId: 0, changes: 0 };
}

function filterExercisesWithMetadata(
  store: WebDbStore,
  normalizedSql: string,
  params: SqlParam[],
): Exercise[] {
  let paramIndex = 0;
  let rows = getActiveExercises(store);

  const metadataFor = (exercise: Exercise) =>
    store.exercise_metadata.find((metadata) => metadata.exercise_id === exercise.id) ?? null;

  if (/e\.category = \?/i.test(normalizedSql)) {
    const category = params[paramIndex++];
    rows = rows.filter((exercise) => exercise.category === category);
  }
  if (/e\.is_custom = \?/i.test(normalizedSql)) {
    const custom = params[paramIndex++];
    rows = rows.filter((exercise) => exercise.is_custom === custom);
  }
  if (/m\.exercise_id IS NOT NULL/i.test(normalizedSql)) {
    rows = rows.filter((exercise) => Boolean(metadataFor(exercise)));
  }
  if (/m\.exercise_id IS NULL/i.test(normalizedSql)) {
    rows = rows.filter((exercise) => !metadataFor(exercise));
  }
  if (/m\.force_type = \?/i.test(normalizedSql)) {
    const forceType = params[paramIndex++];
    rows = rows.filter((exercise) => metadataFor(exercise)?.force_type === forceType);
  }
  if (/m\.movement_pattern = \?/i.test(normalizedSql)) {
    const movementPattern = params[paramIndex++];
    rows = rows.filter((exercise) => metadataFor(exercise)?.movement_pattern === movementPattern);
  }
  if (/m\.body_region = \?/i.test(normalizedSql)) {
    const bodyRegion = params[paramIndex++];
    rows = rows.filter((exercise) => metadataFor(exercise)?.body_region === bodyRegion);
  }
  if (/m\.substitution_group = \?/i.test(normalizedSql)) {
    const substitutionGroup = params[paramIndex++];
    rows = rows.filter(
      (exercise) => metadataFor(exercise)?.substitution_group === substitutionGroup,
    );
  }
  if (/m\.mechanics = \?/i.test(normalizedSql)) {
    const mechanics = params[paramIndex++];
    rows = rows.filter((exercise) => metadataFor(exercise)?.mechanics === mechanics);
  }
  if (/m\.laterality = \?/i.test(normalizedSql)) {
    const laterality = params[paramIndex++];
    rows = rows.filter((exercise) => metadataFor(exercise)?.laterality === laterality);
  }
  const hasCombinedMuscleFilter =
    /m\.primary_muscles_json LIKE \? OR m\.secondary_muscles_json LIKE \?/i.test(normalizedSql);

  if (hasCombinedMuscleFilter) {
    const primaryNeedle = params[paramIndex++];
    const secondaryNeedle = params[paramIndex++];
    rows = rows.filter((exercise) => {
      const metadata = metadataFor(exercise);
      return (
        Boolean(metadata?.primary_muscles_json.includes(stripLike(primaryNeedle))) ||
        Boolean(metadata?.secondary_muscles_json.includes(stripLike(secondaryNeedle)))
      );
    });
  }
  if (!hasCombinedMuscleFilter && /m\.primary_muscles_json LIKE \?/i.test(normalizedSql)) {
    const needle = stripLike(params[paramIndex++]);
    rows = rows.filter((exercise) => metadataFor(exercise)?.primary_muscles_json.includes(needle));
  }
  if (!hasCombinedMuscleFilter && /m\.secondary_muscles_json LIKE \?/i.test(normalizedSql)) {
    const needle = stripLike(params[paramIndex++]);
    rows = rows.filter((exercise) =>
      metadataFor(exercise)?.secondary_muscles_json.includes(needle),
    );
  }
  if (/m\.equipment_json LIKE \?/i.test(normalizedSql)) {
    const needle = stripLike(params[paramIndex++]);
    rows = rows.filter((exercise) => metadataFor(exercise)?.equipment_json.includes(needle));
  }
  if (/m\.source = \?/i.test(normalizedSql)) {
    const source = params[paramIndex++];
    rows = rows.filter((exercise) => metadataFor(exercise)?.source === source);
  }
  if (/m\.source_id = \?/i.test(normalizedSql)) {
    const sourceId = params[paramIndex++];
    rows = rows.filter((exercise) => metadataFor(exercise)?.source_id === sourceId);
  }
  if (/e\.normalized_name LIKE \?/i.test(normalizedSql)) {
    const needle = stripLike(params[paramIndex++]);
    paramIndex += 1;
    rows = rows.filter(
      (exercise) =>
        exercise.normalized_name.includes(needle) ||
        store.exercise_aliases.some(
          (alias) => alias.exercise_id === exercise.id && alias.alias.includes(needle),
        ),
    );
  }

  return rows.sort((a, b) => a.name.localeCompare(b.name)).map(cloneRow);
}

function toExerciseWithMetadataRow(store: WebDbStore, exercise: Exercise): Record<string, unknown> {
  const metadata = store.exercise_metadata.find((row) => row.exercise_id === exercise.id);
  const aliases = store.exercise_aliases
    .filter((alias) => alias.exercise_id === exercise.id)
    .map((alias) => alias.alias)
    .join('\u001f');

  return {
    ...cloneRow(exercise),
    aliases_concat: aliases || null,
    metadata_exercise_id: metadata?.exercise_id ?? null,
    movement_pattern: metadata?.movement_pattern ?? null,
    force_type: metadata?.force_type ?? null,
    body_region: metadata?.body_region ?? null,
    primary_muscles_json: metadata?.primary_muscles_json ?? null,
    secondary_muscles_json: metadata?.secondary_muscles_json ?? null,
    equipment_json: metadata?.equipment_json ?? null,
    mechanics: metadata?.mechanics ?? null,
    laterality: metadata?.laterality ?? null,
    difficulty: metadata?.difficulty ?? null,
    substitution_group: metadata?.substitution_group ?? null,
    source: metadata?.source ?? null,
    source_id: metadata?.source_id ?? null,
    metadata_updated_at: metadata?.updated_at ?? null,
  };
}

function getActiveExercises(store: WebDbStore): Exercise[] {
  return store.exercises
    .filter((exercise) => exercise.archived_at === null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function normalizeSql(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim();
}

function stripLike(value: SqlParam): string {
  return String(value ?? '')
    .replace(/^%/, '')
    .replace(/%$/, '');
}

function cloneRow<T>(row: T): T {
  return row == null ? row : JSON.parse(JSON.stringify(row));
}

function toSqlParams(params: unknown[]): SqlParam[] {
  return params.map((param) => {
    if (typeof param === 'string' || typeof param === 'number' || param === null) return param;
    if (param === undefined) return null;
    return String(param);
  });
}

function createEmptyStore(): WebDbStore {
  return {
    exercises: [],
    exercise_aliases: [],
    exercise_metadata: [],
  };
}

function loadStore(): WebDbStore {
  const fallback = createEmptyStore();
  const storage = getStorage();
  if (!storage) return fallback;

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<WebDbStore>;
    return {
      exercises: Array.isArray(parsed.exercises) ? parsed.exercises : [],
      exercise_aliases: Array.isArray(parsed.exercise_aliases) ? parsed.exercise_aliases : [],
      exercise_metadata: Array.isArray(parsed.exercise_metadata) ? parsed.exercise_metadata : [],
    };
  } catch {
    return fallback;
  }
}

function saveStore(store: WebDbStore): void {
  const storage = getStorage();
  if (!storage) return;

  storage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function removeStoredDb(): void {
  const storage = getStorage();
  if (storage) storage.removeItem(STORAGE_KEY);
  _resetDbSingleton();
}

function getStorage(): Storage | null {
  try {
    return typeof globalThis.localStorage === 'undefined' ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}
