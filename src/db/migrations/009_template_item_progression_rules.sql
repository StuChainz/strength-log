ALTER TABLE template_items
  ADD COLUMN progression_rule TEXT NOT NULL DEFAULT 'none'
  CHECK (progression_rule IN ('none','linear','double','rpe_gated'));

ALTER TABLE template_items
  ADD COLUMN increment_kg REAL;

ALTER TABLE template_items
  ADD COLUMN increment_lb REAL;

ALTER TABLE template_items
  ADD COLUMN rep_range_min INTEGER
  CHECK (rep_range_min IS NULL OR rep_range_min > 0);

ALTER TABLE template_items
  ADD COLUMN rep_range_max INTEGER
  CHECK (rep_range_max IS NULL OR rep_range_max > 0);

ALTER TABLE template_items
  ADD COLUMN rpe_cap REAL
  CHECK (rpe_cap IS NULL OR (rpe_cap >= 1 AND rpe_cap <= 10));
