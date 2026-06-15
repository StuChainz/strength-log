ALTER TABLE exercise_issue_events
  ADD COLUMN set_id TEXT REFERENCES workout_sets(id);

ALTER TABLE exercise_issue_events
  ADD COLUMN client_event_id TEXT;

CREATE INDEX IF NOT EXISTS idx_exercise_issue_events_set
  ON exercise_issue_events (set_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_exercise_issue_events_client_event
  ON exercise_issue_events (client_event_id)
  WHERE client_event_id IS NOT NULL;
