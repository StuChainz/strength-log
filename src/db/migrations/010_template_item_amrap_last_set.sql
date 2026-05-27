ALTER TABLE template_items
  ADD COLUMN amrap_last_set INTEGER NOT NULL DEFAULT 0
  CHECK (amrap_last_set IN (0, 1));
