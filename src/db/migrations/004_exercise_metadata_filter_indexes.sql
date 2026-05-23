-- Migration 004 — indexes for additional exercise metadata filters

CREATE INDEX IF NOT EXISTS idx_exercise_metadata_mechanics
  ON exercise_metadata (mechanics);

CREATE INDEX IF NOT EXISTS idx_exercise_metadata_laterality
  ON exercise_metadata (laterality);
