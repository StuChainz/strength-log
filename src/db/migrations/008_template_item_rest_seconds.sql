ALTER TABLE template_items
  ADD COLUMN rest_seconds INTEGER
  CHECK (rest_seconds IS NULL OR rest_seconds > 0);
