CREATE TABLE IF NOT EXISTS issues (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  note       TEXT,
  active     INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_issues_active ON issues (active);

CREATE TABLE IF NOT EXISTS exercise_issue_events (
  id            TEXT PRIMARY KEY,
  issue_id      TEXT NOT NULL REFERENCES issues(id),
  exercise_id   TEXT NOT NULL REFERENCES exercises(id),
  session_id    TEXT REFERENCES workout_sessions(id),
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('aggravated','helped')),
  severity      INTEGER CHECK (severity IS NULL OR (severity >= 1 AND severity <= 5)),
  note          TEXT,
  created_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_exercise_issue_events_issue_created
  ON exercise_issue_events (issue_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_exercise_issue_events_exercise_created
  ON exercise_issue_events (exercise_id, created_at DESC);
