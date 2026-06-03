-- Migration 013 — tertiary muscle metadata support

ALTER TABLE exercise_metadata
  ADD COLUMN tertiary_muscles_json TEXT NOT NULL DEFAULT '[]';
