ALTER TABLE workout_sets
  ADD COLUMN set_type TEXT NOT NULL DEFAULT 'working'
  CHECK (set_type IN ('warmup','working','drop'));
