CREATE TABLE IF NOT EXISTS issue_checkins (
  id         TEXT PRIMARY KEY,
  issue_id   TEXT NOT NULL REFERENCES issues(id),
  severity   INTEGER NOT NULL CHECK (severity >= 1 AND severity <= 5),
  note       TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_issue_checkins_issue_created
  ON issue_checkins (issue_id, created_at DESC);
