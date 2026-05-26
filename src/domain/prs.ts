import type { ExercisePRRecordType, SetType, Unit, WorkoutSet } from './types';

export interface PreviousRepMax {
  exerciseId: string;
  reps: number;
  weight: number;
}

export interface PreviousEstimated1RM {
  exerciseId: string;
  value: number;
}

export interface PreviousSessionVolume {
  exerciseId: string;
  value: number;
}

export interface PreviousPRData {
  repMaxes: PreviousRepMax[];
  estimated1RMs: PreviousEstimated1RM[];
  sessionVolumes: PreviousSessionVolume[];
}

export interface DetectedPR {
  exercise_id: string;
  session_id: string;
  set_id: string | null;
  record_type: ExercisePRRecordType;
  record_key: string;
  reps: number | null;
  weight: number | null;
  value: number;
  unit: Unit;
  achieved_at: number;
}

export interface LivePotentialPR extends DetectedPR {
  label: string;
}

type PRSet = Pick<
  WorkoutSet,
  | 'id'
  | 'session_id'
  | 'exercise_id'
  | 'weight'
  | 'reps'
  | 'unit'
  | 'set_type'
  | 'logged_at'
  | 'deleted_at'
> & {
  set_type?: SetType;
  is_warmup?: 0 | 1;
  deleted_at?: number | null;
};

interface ValidSet {
  id: string;
  session_id: string;
  exercise_id: string;
  weight: number;
  reps: number;
  unit: Unit;
  logged_at: number;
}

const EPSILON = 0.000001;

export function calculateEstimated1RM(weight: number, reps: number): number | null {
  if (reps <= 0 || reps > 10) return null;
  return weight * (1 + reps / 30);
}

function isIncludedSet(set: PRSet): boolean {
  return (
    (set.deleted_at ?? null) === null &&
    (set.set_type ?? 'working') !== 'warmup' &&
    (set.is_warmup ?? 0) === 0 &&
    set.weight !== null &&
    set.reps !== null &&
    set.reps > 0
  );
}

function toValidSets(sets: PRSet[]): ValidSet[] {
  return sets.filter(isIncludedSet).map((set) => ({
    id: set.id,
    session_id: set.session_id,
    exercise_id: set.exercise_id,
    weight: set.weight as number,
    reps: set.reps as number,
    unit: set.unit,
    logged_at: set.logged_at,
  }));
}

export function getSessionExerciseVolume(sets: PRSet[]): Map<string, number> {
  const volumes = new Map<string, number>();
  for (const set of toValidSets(sets)) {
    volumes.set(set.exercise_id, (volumes.get(set.exercise_id) ?? 0) + set.weight * set.reps);
  }
  return volumes;
}

function buildRepBaseline(previousBestData: PreviousPRData): Map<string, number> {
  const baseline = new Map<string, number>();
  for (const row of previousBestData.repMaxes) {
    baseline.set(`${row.exerciseId}:${row.reps}`, row.weight);
  }
  return baseline;
}

function buildValueBaseline<T extends { exerciseId: string; value: number }>(
  rows: T[],
): Map<string, number> {
  const baseline = new Map<string, number>();
  for (const row of rows) baseline.set(row.exerciseId, row.value);
  return baseline;
}

function beatsPrevious(value: number, previous: number | undefined): boolean {
  return value > 0 && (previous === undefined || value > previous + EPSILON);
}

function detectPRs(sets: PRSet[], previousBestData: PreviousPRData): DetectedPR[] {
  const validSets = toValidSets(sets);
  const repBaseline = buildRepBaseline(previousBestData);
  const estimatedBaseline = buildValueBaseline(previousBestData.estimated1RMs);
  const volumeBaseline = buildValueBaseline(previousBestData.sessionVolumes);
  const bestRepSets = new Map<string, ValidSet>();
  const bestEstimatedSets = new Map<string, ValidSet & { estimated1RM: number }>();
  const sessionVolumes = new Map<
    string,
    { sessionId: string; unit: Unit; value: number; achievedAt: number }
  >();

  for (const set of validSets) {
    const repKey = `${set.exercise_id}:${set.reps}`;
    const currentRepBest = bestRepSets.get(repKey);
    if (!currentRepBest || set.weight > currentRepBest.weight) {
      bestRepSets.set(repKey, set);
    }

    const estimated1RM = calculateEstimated1RM(set.weight, set.reps);
    if (estimated1RM !== null) {
      const currentEstimatedBest = bestEstimatedSets.get(set.exercise_id);
      if (!currentEstimatedBest || estimated1RM > currentEstimatedBest.estimated1RM) {
        bestEstimatedSets.set(set.exercise_id, { ...set, estimated1RM });
      }
    }

    const currentVolume = sessionVolumes.get(set.exercise_id);
    sessionVolumes.set(set.exercise_id, {
      sessionId: set.session_id,
      unit: set.unit,
      value: (currentVolume?.value ?? 0) + set.weight * set.reps,
      achievedAt: Math.max(currentVolume?.achievedAt ?? 0, set.logged_at),
    });
  }

  const records: DetectedPR[] = [];

  for (const [key, set] of bestRepSets) {
    if (!beatsPrevious(set.weight, repBaseline.get(key))) continue;
    records.push({
      exercise_id: set.exercise_id,
      session_id: set.session_id,
      set_id: set.id,
      record_type: 'rep_max',
      record_key: `rep_max:${set.reps}`,
      reps: set.reps,
      weight: set.weight,
      value: set.weight,
      unit: set.unit,
      achieved_at: set.logged_at,
    });
  }

  for (const set of bestEstimatedSets.values()) {
    if (!beatsPrevious(set.estimated1RM, estimatedBaseline.get(set.exercise_id))) continue;
    records.push({
      exercise_id: set.exercise_id,
      session_id: set.session_id,
      set_id: set.id,
      record_type: 'estimated_1rm',
      record_key: 'estimated_1rm',
      reps: set.reps,
      weight: set.weight,
      value: set.estimated1RM,
      unit: set.unit,
      achieved_at: set.logged_at,
    });
  }

  for (const [exerciseId, volume] of sessionVolumes) {
    if (!beatsPrevious(volume.value, volumeBaseline.get(exerciseId))) continue;
    records.push({
      exercise_id: exerciseId,
      session_id: volume.sessionId,
      set_id: null,
      record_type: 'session_volume',
      record_key: 'session_volume',
      reps: null,
      weight: null,
      value: volume.value,
      unit: volume.unit,
      achieved_at: volume.achievedAt,
    });
  }

  return records.sort((a, b) => {
    if (a.exercise_id !== b.exercise_id) return a.exercise_id.localeCompare(b.exercise_id);
    return a.record_key.localeCompare(b.record_key);
  });
}

export function detectFinalSessionPRs(
  currentSessionSets: PRSet[],
  previousBestData: PreviousPRData,
): DetectedPR[] {
  return detectPRs(currentSessionSets, previousBestData);
}

export function detectLivePotentialPRs(
  currentValidSessionSets: PRSet[],
  previousBestData: PreviousPRData,
): LivePotentialPR[] {
  return detectPRs(currentValidSessionSets, previousBestData).map((record) => ({
    ...record,
    label:
      record.record_type === 'rep_max'
        ? 'Potential rep PR'
        : record.record_type === 'estimated_1rm'
          ? 'Potential estimated 1RM PR'
          : 'Potential volume PR',
  }));
}
