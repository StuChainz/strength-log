-- Migration 005 — source lookup index for future curated metadata imports

CREATE INDEX IF NOT EXISTS idx_exercise_metadata_source_source_id
  ON exercise_metadata (source, source_id);
