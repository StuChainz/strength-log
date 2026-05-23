import { type SQLiteDatabase } from 'expo-sqlite';
import {
  BODY_REGIONS,
  EQUIPMENT,
  FORCE_TYPES,
  LATERALITY_TYPES,
  MECHANICS_TYPES,
  MOVEMENT_PATTERNS,
  MUSCLE_GROUPS,
  type BodyRegion,
  type Equipment,
  type Exercise,
  type ExerciseCategory,
  type ExerciseMetadata,
  type ExerciseMetadataView,
  type ExerciseWithMetadata,
  type ForceType,
  type Laterality,
  type Mechanics,
  type MovementPattern,
  type MuscleGroup,
} from '@/domain/types';
import { newId, normalizeName } from '@/domain/ids';
import { type CreateExerciseInput, type UpdateExerciseInput } from '@/domain/validation';

export interface ExerciseMetadataFilters {
  query?: string;
  category?: ExerciseCategory;
  custom?: boolean;
  has_metadata?: boolean;
  force_type?: ForceType;
  movement_pattern?: MovementPattern | string;
  body_region?: BodyRegion | string;
  substitution_group?: string;
  mechanics?: Mechanics | string;
  laterality?: Laterality | string;
  muscle?: MuscleGroup | string;
  primary_muscle?: MuscleGroup | string;
  secondary_muscle?: MuscleGroup | string;
  equipment?: Equipment | string;
  source?: string;
  source_id?: string;
}

export interface ExerciseMetadataFacets {
  force_types: ForceType[];
  movement_patterns: MovementPattern[];
  body_regions: BodyRegion[];
  mechanics: Mechanics[];
  lateralities: Laterality[];
  primary_muscles: MuscleGroup[];
  secondary_muscles: MuscleGroup[];
  muscles: MuscleGroup[];
  equipment: Equipment[];
  substitution_groups: string[];
  sources: string[];
}

type ExerciseWithMetadataRow = Exercise & {
  aliases_concat: string | null;
  metadata_exercise_id: string | null;
  movement_pattern: ExerciseMetadata['movement_pattern'] | null;
  force_type: ExerciseMetadata['force_type'] | null;
  body_region: ExerciseMetadata['body_region'] | null;
  primary_muscles_json: string | null;
  secondary_muscles_json: string | null;
  equipment_json: string | null;
  mechanics: ExerciseMetadata['mechanics'] | null;
  laterality: ExerciseMetadata['laterality'] | null;
  difficulty: number | null;
  substitution_group: string | null;
  source: string | null;
  source_id: string | null;
  metadata_updated_at: number | null;
};

type ExerciseMetadataFacetRow = {
  movement_pattern: ExerciseMetadata['movement_pattern'] | null;
  force_type: ExerciseMetadata['force_type'] | null;
  body_region: ExerciseMetadata['body_region'] | null;
  primary_muscles_json: string | null;
  secondary_muscles_json: string | null;
  equipment_json: string | null;
  mechanics: ExerciseMetadata['mechanics'] | null;
  laterality: ExerciseMetadata['laterality'] | null;
  substitution_group: string | null;
  source: string | null;
};

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

export async function getExercisesWithMetadata(
  db: SQLiteDatabase,
  filters: ExerciseMetadataFilters = {},
): Promise<ExerciseWithMetadata[]> {
  const where = ['e.archived_at IS NULL'];
  const params: (string | number)[] = [];

  if (filters.category) {
    where.push('e.category = ?');
    params.push(filters.category);
  }
  if (filters.custom !== undefined) {
    where.push('e.is_custom = ?');
    params.push(filters.custom ? 1 : 0);
  }
  if (filters.has_metadata !== undefined) {
    where.push(filters.has_metadata ? 'm.exercise_id IS NOT NULL' : 'm.exercise_id IS NULL');
  }
  if (filters.force_type) {
    where.push('m.force_type = ?');
    params.push(filters.force_type);
  }
  if (filters.movement_pattern) {
    where.push('m.movement_pattern = ?');
    params.push(filters.movement_pattern);
  }
  if (filters.body_region) {
    where.push('m.body_region = ?');
    params.push(filters.body_region);
  }
  if (filters.substitution_group) {
    where.push('m.substitution_group = ?');
    params.push(filters.substitution_group);
  }
  if (filters.mechanics) {
    where.push('m.mechanics = ?');
    params.push(filters.mechanics);
  }
  if (filters.laterality) {
    where.push('m.laterality = ?');
    params.push(filters.laterality);
  }
  if (filters.muscle) {
    where.push('(m.primary_muscles_json LIKE ? OR m.secondary_muscles_json LIKE ?)');
    const needle = jsonArrayContainsNeedle(filters.muscle);
    params.push(needle, needle);
  }
  if (filters.primary_muscle) {
    where.push('m.primary_muscles_json LIKE ?');
    params.push(jsonArrayContainsNeedle(filters.primary_muscle));
  }
  if (filters.secondary_muscle) {
    where.push('m.secondary_muscles_json LIKE ?');
    params.push(jsonArrayContainsNeedle(filters.secondary_muscle));
  }
  if (filters.equipment) {
    where.push('m.equipment_json LIKE ?');
    params.push(jsonArrayContainsNeedle(filters.equipment));
  }
  if (filters.source) {
    where.push('m.source = ?');
    params.push(filters.source);
  }
  if (filters.source_id) {
    where.push('m.source_id = ?');
    params.push(filters.source_id);
  }
  if (filters.query?.trim()) {
    where.push(
      `(e.normalized_name LIKE ?
        OR EXISTS (
          SELECT 1 FROM exercise_aliases alias_match
          WHERE alias_match.exercise_id = e.id AND alias_match.alias LIKE ?
        ))`,
    );
    const needle = `%${normalizeName(filters.query)}%`;
    params.push(needle, needle);
  }

  const rows = await db.getAllAsync<ExerciseWithMetadataRow>(
    `SELECT
       e.*,
       (
         SELECT GROUP_CONCAT(alias_list.alias, char(31))
         FROM exercise_aliases alias_list
         WHERE alias_list.exercise_id = e.id
       ) AS aliases_concat,
       m.exercise_id AS metadata_exercise_id,
       m.movement_pattern,
       m.force_type,
       m.body_region,
       m.primary_muscles_json,
       m.secondary_muscles_json,
       m.equipment_json,
       m.mechanics,
       m.laterality,
       m.difficulty,
       m.substitution_group,
       m.source,
       m.source_id,
       m.updated_at AS metadata_updated_at
     FROM exercises e
     LEFT JOIN exercise_metadata m ON m.exercise_id = e.id
     WHERE ${where.join(' AND ')}
     ORDER BY e.name ASC`,
    params,
  );

  return rows.map(rowToExerciseWithMetadata);
}

export async function getExerciseMetadataFacets(
  db: SQLiteDatabase,
): Promise<ExerciseMetadataFacets> {
  const rows = await db.getAllAsync<ExerciseMetadataFacetRow>(
    `SELECT
       m.movement_pattern,
       m.force_type,
       m.body_region,
       m.primary_muscles_json,
       m.secondary_muscles_json,
       m.equipment_json,
       m.mechanics,
       m.laterality,
       m.substitution_group,
       m.source
     FROM exercise_metadata m
     INNER JOIN exercises e ON e.id = m.exercise_id
     WHERE e.archived_at IS NULL`,
  );

  const forceTypes = new Set<ForceType>();
  const movementPatterns = new Set<MovementPattern>();
  const bodyRegions = new Set<BodyRegion>();
  const mechanics = new Set<Mechanics>();
  const lateralities = new Set<Laterality>();
  const primaryMuscles = new Set<MuscleGroup>();
  const secondaryMuscles = new Set<MuscleGroup>();
  const equipment = new Set<Equipment>();
  const substitutionGroups = new Set<string>();
  const sources = new Set<string>();

  rows.forEach((row) => {
    addIfPresent(forceTypes, row.force_type);
    addIfPresent(movementPatterns, row.movement_pattern);
    addIfPresent(bodyRegions, row.body_region);
    addIfPresent(mechanics, row.mechanics);
    addIfPresent(lateralities, row.laterality);
    addIfPresent(substitutionGroups, row.substitution_group);
    addIfPresent(sources, row.source);
    parseStringArray<MuscleGroup>(row.primary_muscles_json).forEach((value) =>
      primaryMuscles.add(value),
    );
    parseStringArray<MuscleGroup>(row.secondary_muscles_json).forEach((value) =>
      secondaryMuscles.add(value),
    );
    parseStringArray<Equipment>(row.equipment_json).forEach((value) => equipment.add(value));
  });

  return {
    force_types: sortByKnownOrder([...forceTypes], FORCE_TYPES),
    movement_patterns: sortByKnownOrder([...movementPatterns], MOVEMENT_PATTERNS),
    body_regions: sortByKnownOrder([...bodyRegions], BODY_REGIONS),
    mechanics: sortByKnownOrder([...mechanics], MECHANICS_TYPES),
    lateralities: sortByKnownOrder([...lateralities], LATERALITY_TYPES),
    primary_muscles: sortByKnownOrder([...primaryMuscles], MUSCLE_GROUPS),
    secondary_muscles: sortByKnownOrder([...secondaryMuscles], MUSCLE_GROUPS),
    muscles: sortByKnownOrder(
      [...new Set([...primaryMuscles, ...secondaryMuscles])],
      MUSCLE_GROUPS,
    ),
    equipment: sortByKnownOrder([...equipment], EQUIPMENT),
    substitution_groups: [...substitutionGroups].sort(),
    sources: [...sources].sort(),
  };
}

export async function getExerciseById(db: SQLiteDatabase, id: string): Promise<Exercise | null> {
  return db.getFirstAsync<Exercise>('SELECT * FROM exercises WHERE id = ?', [id]);
}

export async function searchExercises(db: SQLiteDatabase, query: string): Promise<Exercise[]> {
  const needle = normalizeName(query);
  return db.getAllAsync<Exercise>(
    `SELECT e.* FROM exercises e
     WHERE e.archived_at IS NULL
       AND (
         e.normalized_name LIKE ?
         OR EXISTS (
           SELECT 1 FROM exercise_aliases alias_match
           WHERE alias_match.exercise_id = e.id AND alias_match.alias LIKE ?
         )
       )
     ORDER BY name ASC`,
    [`%${needle}%`, `%${needle}%`],
  );
}

export async function getSubstitutionCandidates(
  db: SQLiteDatabase,
  exerciseId: string,
): Promise<ExerciseWithMetadata[]> {
  const row = await db.getFirstAsync<{ substitution_group: string | null }>(
    `SELECT substitution_group
     FROM exercise_metadata
     WHERE exercise_id = ?`,
    [exerciseId],
  );

  if (!row?.substitution_group) {
    return [];
  }

  const candidates = await getExercisesWithMetadata(db, {
    substitution_group: row.substitution_group,
  });

  return candidates.filter((exercise) => exercise.id !== exerciseId);
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

function rowToExerciseWithMetadata(row: ExerciseWithMetadataRow): ExerciseWithMetadata {
  const exercise: Exercise = {
    id: row.id,
    name: row.name,
    normalized_name: row.normalized_name,
    category: row.category,
    primary_muscle: row.primary_muscle,
    default_unit: row.default_unit,
    is_custom: row.is_custom,
    archived_at: row.archived_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };

  if (!row.metadata_exercise_id) {
    return { ...exercise, aliases: parseAliasList(row.aliases_concat), metadata: null };
  }

  const metadata: ExerciseMetadataView = {
    exercise_id: row.metadata_exercise_id,
    movement_pattern: row.movement_pattern,
    force_type: row.force_type,
    body_region: row.body_region,
    primary_muscles: parseStringArray<MuscleGroup>(row.primary_muscles_json),
    secondary_muscles: parseStringArray<MuscleGroup>(row.secondary_muscles_json),
    equipment: parseStringArray<Equipment>(row.equipment_json),
    mechanics: row.mechanics,
    laterality: row.laterality,
    difficulty: row.difficulty,
    substitution_group: row.substitution_group,
    source: row.source ?? 'curated_seed',
    source_id: row.source_id,
    updated_at: row.metadata_updated_at ?? 0,
  };

  return { ...exercise, aliases: parseAliasList(row.aliases_concat), metadata };
}

function parseStringArray<T extends string>(json: string | null): T[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is T => typeof value === 'string')
      : [];
  } catch {
    return [];
  }
}

function jsonArrayContainsNeedle(value: string): string {
  return `%"${value}"%`;
}

function parseAliasList(value: string | null): string[] {
  if (!value) return [];
  return value.split('\u001f').filter(Boolean);
}

function addIfPresent<T extends string>(set: Set<T>, value: T | null): void {
  if (value) set.add(value);
}

function sortByKnownOrder<T extends string>(values: T[], order: readonly T[]): T[] {
  return values.sort((a, b) => {
    const aIndex = order.indexOf(a);
    const bIndex = order.indexOf(b);

    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });
}
