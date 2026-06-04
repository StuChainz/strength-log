import { type SQLiteDatabase } from 'expo-sqlite';
import { getFinalPRsBySession, type ExercisePRWithExercise } from './prs.repo';
import {
  calculateSessionMuscleSummary,
  type ExerciseMuscleMetadata,
  type SessionMuscleSummary,
} from '@/domain/sessionMuscles';
import {
  buildNextTimePreview,
  type NextTimePreview,
  type NextTimePreviewSet,
} from '@/domain/nextTimePreview';
import { calculateSessionVolume } from '@/domain/volume';
import type {
  BodyRegion,
  ExerciseCategory,
  Mechanics,
  MovementPattern,
  MuscleGroup,
  ProgressionRule,
  SessionNote,
  Unit,
  WorkoutSession,
  WorkoutSet,
} from '@/domain/types';
import type { SessionTag } from './tags.repo';

export interface WorkoutSummarySet extends WorkoutSet {
  exercise_name: string;
}

export interface WorkoutSummaryExercise {
  exerciseId: string;
  name: string;
  sets: WorkoutSummarySet[];
  volume: number;
}

export interface WorkoutSummary {
  session: WorkoutSession;
  setCount: number;
  volume: number;
  durationMin: number;
  prCount: number;
  prs: ExercisePRWithExercise[];
  muscleSummary: SessionMuscleSummary;
  exercises: WorkoutSummaryExercise[];
  nextTimePreviews?: NextTimePreview[];
  tags: SessionTag[];
  note: SessionNote | null;
}

interface SummaryProgressionRow {
  exercise_id: string;
  exercise_name: string;
  exercise_category: ExerciseCategory;
  exercise_default_unit: Unit | null;
  exercise_movement_pattern: MovementPattern | null;
  exercise_body_region: BodyRegion | null;
  exercise_mechanics: Mechanics | null;
  exercise_equipment_json: string | null;
  target_sets: number | null;
  target_reps: number | null;
  target_weight: number | null;
  progression_rule: ProgressionRule;
  increment_kg: number | null;
  increment_lb: number | null;
  rep_range_min: number | null;
  rep_range_max: number | null;
  rpe_cap: number | null;
  amrap_last_set: 0 | 1;
  template_position: number | null;
}

interface PreviousSummarySet extends WorkoutSummarySet {
  session_started_at: number;
}

export async function getWorkoutSummary(
  db: SQLiteDatabase,
  sessionId: string,
): Promise<WorkoutSummary | null> {
  const session = await db.getFirstAsync<WorkoutSession>(
    'SELECT * FROM workout_sessions WHERE id = ?',
    [sessionId],
  );
  if (!session) return null;

  const sets = await db.getAllAsync<WorkoutSummarySet>(
    `SELECT ws.*, COALESCE(ex.name, 'Exercise') AS exercise_name
       FROM workout_sets ws
       LEFT JOIN exercises ex ON ex.id = ws.exercise_id
      WHERE ws.session_id = ?
        AND ws.deleted_at IS NULL
      ORDER BY ws.logged_at ASC, ws.position ASC`,
    [sessionId],
  );
  const [prs, tags, note] = await Promise.all([
    getFinalPRsBySession(db, sessionId),
    getSessionTags(db, sessionId),
    getSessionNote(db, sessionId),
  ]);
  const exerciseMetadata = await getSessionExerciseMuscleMetadata(db, sets);
  const exercises = groupSummaryExercises(sets);
  const nextTimePreviews = await getNextTimePreviews(db, session, exercises);

  const endedAt = session.ended_at ?? Date.now();
  return {
    session,
    setCount: sets.length,
    volume: calculateSessionVolume(sets),
    durationMin: Math.max(0, Math.round((endedAt - session.started_at) / 60000)),
    prCount: prs.length,
    prs,
    muscleSummary: calculateSessionMuscleSummary(session, sets, exerciseMetadata),
    exercises,
    nextTimePreviews,
    tags,
    note,
  };
}

function groupSummaryExercises(sets: WorkoutSummarySet[]): WorkoutSummaryExercise[] {
  const byExercise = new Map<string, WorkoutSummaryExercise>();

  for (const set of sets) {
    let exercise = byExercise.get(set.exercise_id);
    if (!exercise) {
      exercise = {
        exerciseId: set.exercise_id,
        name: set.exercise_name,
        sets: [],
        volume: 0,
      };
      byExercise.set(set.exercise_id, exercise);
    }
    exercise.sets.push(set);
  }

  return Array.from(byExercise.values()).map((exercise) => {
    const sets = [...exercise.sets].sort((a, b) => a.position - b.position);
    return {
      ...exercise,
      sets,
      volume: calculateSessionVolume(sets),
    };
  });
}

async function getNextTimePreviews(
  db: SQLiteDatabase,
  session: WorkoutSession,
  exercises: WorkoutSummaryExercise[],
): Promise<NextTimePreview[]> {
  if (exercises.length === 0) return [];

  const exerciseIds = exercises.map((exercise) => exercise.exerciseId);
  const progressionRows = await getSummaryProgressionRows(db, session.template_id, exerciseIds);
  const previousSetsByExercise = await getPreviousSessionSetsByExercise(
    db,
    session.id,
    session.started_at,
    exerciseIds,
  );

  return exercises
    .map((exercise) => {
      const row = progressionRows.get(exercise.exerciseId);
      if (!row) return null;

      const unit = row.exercise_default_unit ?? exercise.sets[0]?.unit ?? 'kg';
      const equipment = parseStringArray(row.exercise_equipment_json);

      return buildNextTimePreview({
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.name,
        exercise: {
          category: row.exercise_category,
          movementPattern: row.exercise_movement_pattern,
          bodyRegion: row.exercise_body_region,
          mechanics: row.exercise_mechanics,
          equipment,
        },
        templateTarget: {
          targetSets: row.target_sets,
          targetReps: row.target_reps,
          targetWeight: row.target_weight,
          unit,
          amrapLastSet: row.amrap_last_set === 1,
        },
        progressionRule: {
          rule: row.progression_rule,
          incrementKg: row.increment_kg,
          incrementLb: row.increment_lb,
          repRangeMin: row.rep_range_min,
          repRangeMax: row.rep_range_max,
          rpeCap: row.rpe_cap,
        },
        recentSets: exercise.sets,
        previousSessionSets: previousSetsByExercise.get(exercise.exerciseId) ?? [],
      });
    })
    .filter((preview): preview is NextTimePreview => preview !== null);
}

async function getSummaryProgressionRows(
  db: SQLiteDatabase,
  templateId: string | null,
  exerciseIds: string[],
): Promise<Map<string, SummaryProgressionRow>> {
  const rows = new Map<string, SummaryProgressionRow>();
  const exerciseRows = await getExerciseProgressionFallbackRows(db, exerciseIds);
  for (const row of exerciseRows) rows.set(row.exercise_id, row);

  if (templateId === null) return rows;

  const placeholders = exerciseIds.map(() => '?').join(',');
  const templateRows = await db.getAllAsync<SummaryProgressionRow>(
    `SELECT ti.exercise_id,
            e.name AS exercise_name,
            e.category AS exercise_category,
            e.default_unit AS exercise_default_unit,
            em.movement_pattern AS exercise_movement_pattern,
            em.body_region AS exercise_body_region,
            em.mechanics AS exercise_mechanics,
            em.equipment_json AS exercise_equipment_json,
            ti.target_sets,
            ti.target_reps,
            ti.target_weight,
            ti.progression_rule,
            ti.increment_kg,
            ti.increment_lb,
            ti.rep_range_min,
            ti.rep_range_max,
            ti.rpe_cap,
            ti.amrap_last_set,
            ti.position AS template_position
       FROM template_items ti
       JOIN exercises e ON e.id = ti.exercise_id
       LEFT JOIN exercise_metadata em ON em.exercise_id = e.id
      WHERE ti.template_id = ?
        AND ti.exercise_id IN (${placeholders})
      ORDER BY ti.position ASC`,
    [templateId, ...exerciseIds],
  );

  for (const row of templateRows) {
    if (!rows.has(row.exercise_id) || rows.get(row.exercise_id)?.template_position === null) {
      rows.set(row.exercise_id, row);
    }
  }

  return rows;
}

async function getExerciseProgressionFallbackRows(
  db: SQLiteDatabase,
  exerciseIds: string[],
): Promise<SummaryProgressionRow[]> {
  const placeholders = exerciseIds.map(() => '?').join(',');
  return db.getAllAsync<SummaryProgressionRow>(
    `SELECT e.id AS exercise_id,
            e.name AS exercise_name,
            e.category AS exercise_category,
            e.default_unit AS exercise_default_unit,
            em.movement_pattern AS exercise_movement_pattern,
            em.body_region AS exercise_body_region,
            em.mechanics AS exercise_mechanics,
            em.equipment_json AS exercise_equipment_json,
            NULL AS target_sets,
            NULL AS target_reps,
            NULL AS target_weight,
            'none' AS progression_rule,
            NULL AS increment_kg,
            NULL AS increment_lb,
            NULL AS rep_range_min,
            NULL AS rep_range_max,
            NULL AS rpe_cap,
            0 AS amrap_last_set,
            NULL AS template_position
       FROM exercises e
       LEFT JOIN exercise_metadata em ON em.exercise_id = e.id
      WHERE e.id IN (${placeholders})`,
    exerciseIds,
  );
}

async function getPreviousSessionSetsByExercise(
  db: SQLiteDatabase,
  currentSessionId: string,
  currentSessionStartedAt: number,
  exerciseIds: string[],
): Promise<Map<string, NextTimePreviewSet[]>> {
  const placeholders = exerciseIds.map(() => '?').join(',');
  const rows = await db.getAllAsync<PreviousSummarySet>(
    `SELECT ws.*, COALESCE(ex.name, 'Exercise') AS exercise_name,
            sess.started_at AS session_started_at
       FROM workout_sets ws
       JOIN workout_sessions sess ON sess.id = ws.session_id
       LEFT JOIN exercises ex ON ex.id = ws.exercise_id
      WHERE ws.exercise_id IN (${placeholders})
        AND ws.session_id != ?
        AND ws.deleted_at IS NULL
        AND sess.status = 'completed'
        AND sess.started_at < ?
      ORDER BY ws.exercise_id ASC, sess.started_at DESC, ws.position ASC`,
    [...exerciseIds, currentSessionId, currentSessionStartedAt],
  );

  const selectedSessionByExercise = new Map<string, string>();
  const setsByExercise = new Map<string, NextTimePreviewSet[]>();

  for (const row of rows) {
    const selectedSessionId = selectedSessionByExercise.get(row.exercise_id);
    if (!selectedSessionId) {
      selectedSessionByExercise.set(row.exercise_id, row.session_id);
    }
    if ((selectedSessionByExercise.get(row.exercise_id) ?? null) !== row.session_id) continue;

    const set: NextTimePreviewSet = {
      weight: row.weight,
      reps: row.reps,
      rpe: row.rpe,
      unit: row.unit,
      set_type: row.set_type,
      is_warmup: row.is_warmup,
      logged_at: row.logged_at,
      position: row.position,
      deleted_at: row.deleted_at,
    };
    setsByExercise.set(row.exercise_id, [...(setsByExercise.get(row.exercise_id) ?? []), set]);
  }

  return setsByExercise;
}

async function getSessionTags(db: SQLiteDatabase, sessionId: string): Promise<SessionTag[]> {
  const rows = await db.getAllAsync<{ tag: SessionTag }>(
    'SELECT tag FROM post_session_tags WHERE session_id = ? ORDER BY tag ASC',
    [sessionId],
  );
  return rows.map((row) => row.tag);
}

async function getSessionNote(db: SQLiteDatabase, sessionId: string): Promise<SessionNote | null> {
  return db.getFirstAsync<SessionNote>('SELECT * FROM session_notes WHERE session_id = ?', [
    sessionId,
  ]);
}

async function getSessionExerciseMuscleMetadata(
  db: SQLiteDatabase,
  sets: WorkoutSet[],
): Promise<ExerciseMuscleMetadata[]> {
  const exerciseIds = [...new Set(sets.map((set) => set.exercise_id))];
  if (exerciseIds.length === 0) return [];

  try {
    const rows = await db.getAllAsync<{
      exercise_id: string;
      primary_muscles_json: string | null;
      secondary_muscles_json: string | null;
      tertiary_muscles_json: string | null;
    }>(
      `SELECT exercise_id, primary_muscles_json, secondary_muscles_json, tertiary_muscles_json
       FROM exercise_metadata
       WHERE exercise_id IN (${exerciseIds.map(() => '?').join(',')})`,
      exerciseIds,
    );

    return rows.map((row) => ({
      exercise_id: row.exercise_id,
      primary_muscles: parseMuscleArray(row.primary_muscles_json),
      secondary_muscles: parseMuscleArray(row.secondary_muscles_json),
      tertiary_muscles: parseMuscleArray(row.tertiary_muscles_json),
    }));
  } catch (error) {
    if (!isMissingMetadataTableError(error)) throw error;
    return [];
  }
}

function parseMuscleArray(json: string | null): MuscleGroup[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is MuscleGroup => typeof value === 'string')
      : [];
  } catch {
    return [];
  }
}

function parseStringArray(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === 'string')
      : [];
  } catch {
    return [];
  }
}

function isMissingMetadataTableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /no such table: .*exercise_metadata/i.test(message);
}
