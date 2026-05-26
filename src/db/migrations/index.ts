// SQL strings for each migration.
// The .sql files alongside this file are the canonical reference; these strings
// must stay in sync with them.

export interface Migration {
  name: string;
  sql: string;
}

const MIGRATION_001 = `
CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,
  display_name TEXT NOT NULL DEFAULT '',
  default_unit TEXT NOT NULL DEFAULT 'kg',
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS exercises (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  category        TEXT NOT NULL CHECK (category IN ('barbell','dumbbell','machine','bodyweight','cable','other')),
  primary_muscle  TEXT,
  default_unit    TEXT CHECK (default_unit IN ('kg','lb')),
  is_custom       INTEGER NOT NULL DEFAULT 0,
  archived_at     INTEGER,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_exercises_normalized_name ON exercises (normalized_name);
CREATE INDEX IF NOT EXISTS idx_exercises_archived        ON exercises (archived_at);

CREATE TABLE IF NOT EXISTS exercise_aliases (
  id          TEXT PRIMARY KEY,
  exercise_id TEXT NOT NULL REFERENCES exercises(id),
  alias       TEXT NOT NULL UNIQUE,
  source      TEXT NOT NULL DEFAULT 'seed' CHECK (source IN ('seed','user')),
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_aliases_alias    ON exercise_aliases (alias);
CREATE INDEX IF NOT EXISTS idx_aliases_exercise ON exercise_aliases (exercise_id);

CREATE TABLE IF NOT EXISTS templates (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  notes       TEXT,
  archived_at INTEGER,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS template_items (
  id            TEXT PRIMARY KEY,
  template_id   TEXT NOT NULL REFERENCES templates(id),
  exercise_id   TEXT NOT NULL REFERENCES exercises(id),
  position      INTEGER NOT NULL,
  target_sets   INTEGER,
  target_reps   INTEGER,
  target_weight REAL,
  target_rpe    REAL,
  UNIQUE (template_id, position)
);

CREATE TABLE IF NOT EXISTS workout_sessions (
  id                  TEXT PRIMARY KEY,
  template_id         TEXT REFERENCES templates(id),
  name                TEXT,
  status              TEXT NOT NULL CHECK (status IN ('in_progress','completed','discarded')),
  started_at          INTEGER NOT NULL,
  ended_at            INTEGER,
  total_volume_cached REAL,
  created_at          INTEGER NOT NULL,
  updated_at          INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_status  ON workout_sessions (status);
CREATE INDEX IF NOT EXISTS idx_sessions_started ON workout_sessions (started_at DESC);

CREATE TABLE IF NOT EXISTS workout_events (
  id              TEXT PRIMARY KEY,
  session_id      TEXT NOT NULL REFERENCES workout_sessions(id),
  event_type      TEXT NOT NULL,
  payload_json    TEXT NOT NULL,
  client_event_id TEXT NOT NULL UNIQUE,
  created_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_session_created ON workout_events (session_id, created_at);

CREATE TABLE IF NOT EXISTS workout_sets (
  id            TEXT PRIMARY KEY,
  session_id    TEXT NOT NULL REFERENCES workout_sessions(id),
  exercise_id   TEXT NOT NULL REFERENCES exercises(id),
  position      INTEGER NOT NULL,
  weight        REAL,
  reps          INTEGER,
  rpe           REAL,
  unit          TEXT NOT NULL DEFAULT 'kg',
  is_warmup     INTEGER NOT NULL DEFAULT 0,
  logged_at     INTEGER NOT NULL,
  source        TEXT NOT NULL DEFAULT 'tap',
  client_set_id TEXT NOT NULL UNIQUE,
  deleted_at    INTEGER
);
CREATE INDEX IF NOT EXISTS idx_sets_session         ON workout_sets (session_id, position);
CREATE INDEX IF NOT EXISTS idx_sets_exercise_logged ON workout_sets (exercise_id, logged_at DESC);

CREATE TABLE IF NOT EXISTS exercise_history_cache (
  exercise_id          TEXT PRIMARY KEY REFERENCES exercises(id),
  last_session_id      TEXT,
  last_session_at      INTEGER,
  last_top_set_weight  REAL,
  last_top_set_reps    INTEGER,
  last_session_volume  REAL,
  est_1rm              REAL,
  recent_sessions_json TEXT,
  updated_at           INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS post_session_tags (
  id         TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES workout_sessions(id),
  tag        TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  UNIQUE (session_id, tag)
);

CREATE TABLE IF NOT EXISTS session_notes (
  session_id    TEXT PRIMARY KEY REFERENCES workout_sessions(id),
  energy_rating INTEGER,
  note          TEXT,
  updated_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS metric_samples (
  id         TEXT PRIMARY KEY,
  metric_key TEXT NOT NULL,
  value_num  REAL,
  value_text TEXT,
  sampled_at INTEGER NOT NULL,
  source     TEXT NOT NULL DEFAULT 'workout',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_metric_key_sampled ON metric_samples (metric_key, sampled_at DESC);

CREATE TABLE IF NOT EXISTS weekly_insight_cards (
  id                       TEXT PRIMARY KEY,
  generated_for_week_start INTEGER NOT NULL UNIQUE,
  title                    TEXT NOT NULL,
  body                     TEXT NOT NULL,
  sample_size              INTEGER NOT NULL,
  confidence_label         TEXT NOT NULL CHECK (confidence_label IN ('low','medium','high')),
  payload_json             TEXT,
  dismissed_at             INTEGER,
  created_at               INTEGER NOT NULL
);
`;

const MIGRATION_002 = `
CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
`;

const MIGRATION_003 = `
CREATE TABLE IF NOT EXISTS exercise_metadata (
  exercise_id            TEXT PRIMARY KEY REFERENCES exercises(id),
  movement_pattern       TEXT,
  force_type             TEXT CHECK (force_type IN ('push','pull','legs','hinge','core','carry','mixed','other')),
  body_region            TEXT,
  primary_muscles_json   TEXT NOT NULL DEFAULT '[]',
  secondary_muscles_json TEXT NOT NULL DEFAULT '[]',
  equipment_json         TEXT NOT NULL DEFAULT '[]',
  mechanics              TEXT CHECK (mechanics IN ('compound','isolation','other')),
  laterality             TEXT CHECK (laterality IN ('bilateral','unilateral','alternating','single_side','other')),
  difficulty             INTEGER,
  substitution_group     TEXT,
  source                 TEXT NOT NULL DEFAULT 'curated_seed',
  source_id              TEXT,
  updated_at             INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_exercise_metadata_force_type
  ON exercise_metadata (force_type);
CREATE INDEX IF NOT EXISTS idx_exercise_metadata_movement_pattern
  ON exercise_metadata (movement_pattern);
CREATE INDEX IF NOT EXISTS idx_exercise_metadata_body_region
  ON exercise_metadata (body_region);
CREATE INDEX IF NOT EXISTS idx_exercise_metadata_substitution_group
  ON exercise_metadata (substitution_group);
`;

const MIGRATION_004 = `
CREATE INDEX IF NOT EXISTS idx_exercise_metadata_mechanics
  ON exercise_metadata (mechanics);

CREATE INDEX IF NOT EXISTS idx_exercise_metadata_laterality
  ON exercise_metadata (laterality);
`;

const MIGRATION_005 = `
CREATE INDEX IF NOT EXISTS idx_exercise_metadata_source_source_id
  ON exercise_metadata (source, source_id);
`;

const MIGRATION_006 = `
ALTER TABLE workout_sets
  ADD COLUMN set_type TEXT NOT NULL DEFAULT 'working'
  CHECK (set_type IN ('warmup','working','drop'));
`;

const MIGRATION_007 = `
CREATE TABLE IF NOT EXISTS exercise_prs (
  id          TEXT PRIMARY KEY,
  exercise_id TEXT NOT NULL REFERENCES exercises(id),
  session_id TEXT NOT NULL REFERENCES workout_sessions(id),
  set_id      TEXT REFERENCES workout_sets(id),
  record_type TEXT NOT NULL CHECK (record_type IN ('rep_max','estimated_1rm','session_volume')),
  record_key  TEXT NOT NULL,
  reps        INTEGER,
  weight      REAL,
  value       REAL NOT NULL,
  unit        TEXT NOT NULL DEFAULT 'kg',
  achieved_at INTEGER NOT NULL,
  created_at  INTEGER NOT NULL,
  UNIQUE (exercise_id, session_id, record_key)
);
CREATE INDEX IF NOT EXISTS idx_exercise_prs_exercise_id ON exercise_prs (exercise_id);
CREATE INDEX IF NOT EXISTS idx_exercise_prs_session_id ON exercise_prs (session_id);
CREATE INDEX IF NOT EXISTS idx_exercise_prs_record_type ON exercise_prs (record_type);
CREATE INDEX IF NOT EXISTS idx_exercise_prs_achieved_at ON exercise_prs (achieved_at DESC);
`;

const MIGRATION_008 = `
ALTER TABLE template_items
  ADD COLUMN rest_seconds INTEGER
  CHECK (rest_seconds IS NULL OR rest_seconds > 0);
`;

export const MIGRATIONS: Migration[] = [
  { name: '001_init', sql: MIGRATION_001 },
  { name: '002_app_settings', sql: MIGRATION_002 },
  { name: '003_exercise_metadata', sql: MIGRATION_003 },
  { name: '004_exercise_metadata_filter_indexes', sql: MIGRATION_004 },
  { name: '005_exercise_metadata_source_index', sql: MIGRATION_005 },
  { name: '006_workout_set_type', sql: MIGRATION_006 },
  { name: '007_exercise_prs', sql: MIGRATION_007 },
  { name: '008_template_item_rest_seconds', sql: MIGRATION_008 },
];
