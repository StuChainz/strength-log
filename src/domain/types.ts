// ─── Scalar enums ────────────────────────────────────────────────────────────

export type Unit = 'kg' | 'lb';
export type ExerciseCategory =
  | 'barbell'
  | 'dumbbell'
  | 'machine'
  | 'bodyweight'
  | 'cable'
  | 'other';
export type ForceType = 'push' | 'pull' | 'legs' | 'hinge' | 'core' | 'carry' | 'mixed' | 'other';
export type MovementPattern =
  | 'horizontal_push'
  | 'vertical_push'
  | 'horizontal_pull'
  | 'vertical_pull'
  | 'squat'
  | 'hinge'
  | 'lunge'
  | 'hip_extension'
  | 'elbow_flexion'
  | 'elbow_extension'
  | 'shoulder_abduction'
  | 'core'
  | 'carry'
  | 'other';
export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'quadriceps'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'core'
  | 'forearms'
  | 'full_body'
  | 'other';
export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'machine'
  | 'bodyweight'
  | 'cable'
  | 'bench'
  | 'pull_up_bar'
  | 'other';
export type Mechanics = 'compound' | 'isolation' | 'other';
export type Laterality = 'bilateral' | 'unilateral' | 'alternating' | 'single_side' | 'other';
export type SessionStatus = 'in_progress' | 'completed' | 'discarded';
export type EventType =
  | 'session_started'
  | 'set_added'
  | 'set_edited'
  | 'set_deleted'
  | 'session_ended'
  | 'session_discarded'
  | 'tags_added';
export type ConfidenceLabel = 'low' | 'medium' | 'high';
export type AliasSrc = 'seed' | 'user';

// ─── Table row types ──────────────────────────────────────────────────────────

export interface User {
  id: string;
  display_name: string;
  default_unit: Unit;
  created_at: number;
  updated_at: number;
}

export interface Exercise {
  id: string;
  name: string;
  normalized_name: string;
  category: ExerciseCategory;
  primary_muscle: string | null;
  default_unit: Unit | null;
  is_custom: 0 | 1;
  archived_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface ExerciseAlias {
  id: string;
  exercise_id: string;
  alias: string;
  source: AliasSrc;
  created_at: number;
}

export interface ExerciseMetadata {
  exercise_id: string;
  movement_pattern: MovementPattern | null;
  force_type: ForceType | null;
  body_region: string | null;
  primary_muscles_json: string;
  secondary_muscles_json: string;
  equipment_json: string;
  mechanics: Mechanics | null;
  laterality: Laterality | null;
  difficulty: number | null;
  substitution_group: string | null;
  source: string;
  source_id: string | null;
  updated_at: number;
}

export interface ExerciseMetadataView {
  exercise_id: string;
  movement_pattern: MovementPattern | null;
  force_type: ForceType | null;
  body_region: string | null;
  primary_muscles: MuscleGroup[];
  secondary_muscles: MuscleGroup[];
  equipment: Equipment[];
  mechanics: Mechanics | null;
  laterality: Laterality | null;
  difficulty: number | null;
  substitution_group: string | null;
  source: string;
  source_id: string | null;
  updated_at: number;
}

export interface ExerciseWithMetadata extends Exercise {
  aliases: string[];
  metadata: ExerciseMetadataView | null;
}

export interface Template {
  id: string;
  name: string;
  notes: string | null;
  archived_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface TemplateItem {
  id: string;
  template_id: string;
  exercise_id: string;
  position: number;
  target_sets: number | null;
  target_reps: number | null;
  target_weight: number | null;
  target_rpe: number | null;
}

export interface WorkoutSession {
  id: string;
  template_id: string | null;
  name: string | null;
  status: SessionStatus;
  started_at: number;
  ended_at: number | null;
  total_volume_cached: number | null;
  created_at: number;
  updated_at: number;
}

export interface WorkoutEvent {
  id: string;
  session_id: string;
  event_type: EventType;
  payload_json: string;
  client_event_id: string;
  created_at: number;
}

export interface WorkoutSet {
  id: string;
  session_id: string;
  exercise_id: string;
  position: number;
  weight: number | null;
  reps: number | null;
  rpe: number | null;
  unit: Unit;
  is_warmup: 0 | 1;
  logged_at: number;
  source: 'tap' | 'voice';
  client_set_id: string;
  deleted_at: number | null;
}

export interface ExerciseHistoryCache {
  exercise_id: string;
  last_session_id: string | null;
  last_session_at: number | null;
  last_top_set_weight: number | null;
  last_top_set_reps: number | null;
  last_session_volume: number | null;
  est_1rm: number | null;
  recent_sessions_json: string | null;
  updated_at: number;
}

export interface PostSessionTag {
  id: string;
  session_id: string;
  tag: string;
  created_at: number;
}

export interface SessionNote {
  session_id: string;
  energy_rating: number | null;
  note: string | null;
  updated_at: number;
}

export interface MetricSample {
  id: string;
  metric_key: string;
  value_num: number | null;
  value_text: string | null;
  sampled_at: number;
  source: 'workout' | 'user_tag';
  created_at: number;
}

export interface WeeklyInsightCard {
  id: string;
  generated_for_week_start: number;
  title: string;
  body: string;
  sample_size: number;
  confidence_label: ConfidenceLabel;
  payload_json: string | null;
  dismissed_at: number | null;
  created_at: number;
}
