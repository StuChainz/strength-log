import type { Unit } from '@/domain/types';

export type VoiceIntent =
  | 'log_set'
  | 'log_set_same'
  | 'log_set_delta'
  | 'set_rpe'
  | 'undo'
  | 'next_exercise'
  | 'prev_exercise'
  | 'start_rest_timer'
  | 'end_workout';

export type VoiceConfidence = 'high' | 'medium' | 'low';

export interface IntentResult {
  commandId: string;
  intent: VoiceIntent;
  args: Record<string, unknown>;
  confidence: VoiceConfidence;
  rawText: string;
  recognisedAt: number;
  requiresConfirmation?: boolean;
}

export interface VoiceExercise {
  id: string;
  normalizedName: string;
  aliases?: string[];
}

export interface LastSetContext {
  setId?: string;
  exerciseId: string;
  weight: number | null;
  reps: number | null;
  rpe?: number | null;
  unit: Unit;
  loggedAt?: number;
}

export interface ParserContext {
  activeExerciseId: string | null;
  defaultUnit: Unit;
  exercises: VoiceExercise[];
  lastSet?: LastSetContext | null;
  now?: number;
  commandId?: string;
}
