import { type SQLiteDatabase } from 'expo-sqlite';
import { getFinalPRsBySession, type ExercisePRWithExercise } from './prs.repo';
import {
  calculateSessionMuscleSummary,
  type ExerciseMuscleMetadata,
  type SessionMuscleSummary,
} from '@/domain/sessionMuscles';
import { calculateSessionVolume } from '@/domain/volume';
import type { MuscleGroup, SessionNote, WorkoutSession, WorkoutSet } from '@/domain/types';
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
  tags: SessionTag[];
  note: SessionNote | null;
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

  const endedAt = session.ended_at ?? Date.now();
  return {
    session,
    setCount: sets.length,
    volume: calculateSessionVolume(sets),
    durationMin: Math.max(0, Math.round((endedAt - session.started_at) / 60000)),
    prCount: prs.length,
    prs,
    muscleSummary: calculateSessionMuscleSummary(session, sets, exerciseMetadata),
    exercises: groupSummaryExercises(sets),
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

function isMissingMetadataTableError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /no such table: .*exercise_metadata/i.test(message);
}
