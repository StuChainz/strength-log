CREATE TABLE IF NOT EXISTS issue_exercise_links (
  id          TEXT PRIMARY KEY,
  issue_id    TEXT NOT NULL REFERENCES issues(id),
  exercise_id TEXT NOT NULL REFERENCES exercises(id),
  link_type   TEXT NOT NULL CHECK (link_type IN ('helpful','aggravating')),
  note        TEXT,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  UNIQUE (issue_id, exercise_id, link_type)
);
CREATE INDEX IF NOT EXISTS idx_issue_exercise_links_issue
  ON issue_exercise_links (issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_exercise_links_exercise
  ON issue_exercise_links (exercise_id);
