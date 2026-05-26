CREATE TABLE IF NOT EXISTS exercise_prs (
  id          TEXT PRIMARY KEY,
  exercise_id TEXT NOT NULL REFERENCES exercises(id),
  session_id TEXT NOT NULL REFERENCES workout_sessions(id),
  set_id      TEXT REFERENCES workout_sets(id),
  record_type TEXT NOT NULL CHECK (record_type IN ('rep_max','estimated_1rm','session_volume')),
  record_key  TEXT NOT NULL,
  reps        INTEGER,
  weight      REAL,
  value       REAL NOT NULL,
  unit        TEXT NOT NULL DEFAULT 'kg',
  achieved_at INTEGER NOT NULL,
  created_at  INTEGER NOT NULL,
  UNIQUE (exercise_id, session_id, record_key)
);
CREATE INDEX IF NOT EXISTS idx_exercise_prs_exercise_id ON exercise_prs (exercise_id);
CREATE INDEX IF NOT EXISTS idx_exercise_prs_session_id ON exercise_prs (session_id);
CREATE INDEX IF NOT EXISTS idx_exercise_prs_record_type ON exercise_prs (record_type);
CREATE INDEX IF NOT EXISTS idx_exercise_prs_achieved_at ON exercise_prs (achieved_at DESC);
