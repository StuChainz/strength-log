import type { ProgressionRule, Unit } from '@/domain/types';

export type PresetExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

export interface PresetSource {
  label: string;
  url?: string;
}

export interface ExerciseMatch {
  /**
   * Canonical exercise name, matched at import time against the seeded
   * exercise library via normalizeName(). Must correspond to a row in
   * SEED_EXERCISES.
   */
  normalizedName: string;
  /** Optional fallback names to try if normalizedName ever drifts. */
  aliases?: string[];
}

export interface ProgressionRuleConfig {
  rule: ProgressionRule;
  incrementKg?: number | null;
  incrementLb?: number | null;
  repRangeMin?: number | null;
  repRangeMax?: number | null;
  rpeCap?: number | null;
}

export interface ProgramExercise {
  match: ExerciseMatch;
  targetSets: number;
  /** null when reps are driven by a rep range or AMRAP. */
  targetReps: number | null;
  targetWeight?: number | null;
  targetRPE?: number | null;
  restSeconds?: number | null;
  progression: ProgressionRuleConfig;
  /** When true, the final working set is performed as AMRAP (reps to failure). */
  amrapLastSet?: boolean;
  /** Free-form note for program-specific quirks the engine doesn't model. */
  notes?: string;
}

export interface ProgramWorkout {
  /** Stable key within the preset, used by the future importer for de-dupe. */
  key: string;
  name: string;
  notes?: string;
  exercises: ProgramExercise[];
}

export interface ProgramPreset {
  id: string;
  name: string;
  shortDescription: string;
  description: string;
  daysPerWeek: number;
  experienceLevel: PresetExperienceLevel;
  source?: PresetSource;
  defaultUnit: Unit;
  workouts: ProgramWorkout[];
}
