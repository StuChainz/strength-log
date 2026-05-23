-- Migration 003 — exercise metadata for filtering and future imports

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
