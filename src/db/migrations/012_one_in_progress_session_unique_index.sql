CREATE UNIQUE INDEX IF NOT EXISTS idx_one_in_progress_session
  ON workout_sessions(status)
  WHERE status = 'in_progress';
