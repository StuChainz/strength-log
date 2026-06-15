CREATE TRIGGER IF NOT EXISTS trg_workout_sessions_one_in_progress_insert
BEFORE INSERT ON workout_sessions
WHEN NEW.status = 'in_progress'
  AND EXISTS (
    SELECT 1 FROM workout_sessions WHERE status = 'in_progress'
  )
BEGIN
  SELECT RAISE(ABORT, 'only one in-progress workout session is allowed');
END;

CREATE TRIGGER IF NOT EXISTS trg_workout_sessions_one_in_progress_update
BEFORE UPDATE OF status ON workout_sessions
WHEN NEW.status = 'in_progress'
  AND OLD.status <> 'in_progress'
  AND EXISTS (
    SELECT 1 FROM workout_sessions
    WHERE status = 'in_progress' AND id <> NEW.id
  )
BEGIN
  SELECT RAISE(ABORT, 'only one in-progress workout session is allowed');
END;
