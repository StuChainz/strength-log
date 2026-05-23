import type { Unit } from './types';

export interface SessionStartedPayload {
  template_id: string | null;
  name: string | null;
}

export interface SetAddedPayload {
  set_id: string;
  exercise_id: string;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  unit: Unit;
  is_warmup: 0 | 1;
  position: number;
  source: 'tap' | 'voice';
  client_set_id: string;
  logged_at: number;
}

export interface SetEditedPayload {
  set_id: string;
  weight?: number | null;
  reps?: number | null;
  rpe?: number | null;
}

export interface SetDeletedPayload {
  set_id: string;
}

export interface SessionEndedPayload {
  ended_at: number;
  total_volume: number | null;
}

export interface SessionDiscardedPayload {
  discarded_at: number;
}
