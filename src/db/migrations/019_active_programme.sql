-- Migration 019 — simple active programme marker on imported templates.

ALTER TABLE templates
  ADD COLUMN program_preset_id TEXT;

ALTER TABLE templates
  ADD COLUMN is_active_programme INTEGER NOT NULL DEFAULT 0
  CHECK (is_active_programme IN (0, 1));

CREATE INDEX IF NOT EXISTS idx_templates_program_preset
  ON templates (program_preset_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_programme
  ON templates(is_active_programme)
  WHERE is_active_programme = 1;
