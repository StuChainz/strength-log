CREATE TABLE IF NOT EXISTS issue_routines (
  id          TEXT PRIMARY KEY,
  issue_id    TEXT NOT NULL REFERENCES issues(id),
  template_id TEXT NOT NULL REFERENCES templates(id),
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  UNIQUE (issue_id)
);
CREATE INDEX IF NOT EXISTS idx_issue_routines_issue
  ON issue_routines (issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_routines_template
  ON issue_routines (template_id);
