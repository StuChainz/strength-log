# Reliability Model — Strength Log Autopilot v1

## Core guarantee

**Never lose a workout.** Every set must survive: app kills, crashes, backgrounding, low memory, and bad signal. There is no backend in v1, so local durability is the only durability.

---

## Event log

- `workout_events` is the **source of truth**.
- `workout_sets` is a derived materialisation, always rebuildable from events.
- Events are append-only: no `UPDATE`, no `DELETE` on this table, ever.
- A "deleted" set is represented by a `set_deleted` event, not a SQL `DELETE`.
- Deletes and edits are therefore auditable and reversible.

### Event types

| Type | Payload (key fields) |
|---|---|
| `session_started` | `session_id`, `template_id?`, `started_at` |
| `set_added` | `set_id`, `exercise_id`, `weight`, `reps`, `rpe?`, `unit`, `is_warmup`, `source`, `client_set_id` |
| `set_edited` | `set_id`, `delta: { weight?, reps?, rpe?, is_warmup? }` |
| `set_deleted` | `set_id` |
| `session_ended` | `ended_at` |
| `session_discarded` | `discarded_at` |
| `tags_added` | `tags[]`, `energy_rating?`, `note?` |

---

## Idempotency

### Client-side ID allocation

The `client_set_id` and `client_event_id` are **allocated in the UI at intent time** — before any DB call is made. This means:

1. User taps "Log set" → `client_set_id = uuidv7()` generated immediately.
2. DB write is attempted with that ID.
3. If the write fails and the UI retries, it uses the **same** ID.
4. The `UNIQUE (client_set_id)` constraint in `workout_sets` silently ignores the duplicate insert.

The same pattern applies to `client_event_id` in `workout_events`.

### Idempotency checklist

- [ ] `workout_sets.client_set_id` has a `UNIQUE` constraint.
- [ ] `workout_events.client_event_id` has a `UNIQUE` constraint.
- [ ] The set-add code path catches the SQLite `UNIQUE` constraint error and treats it as a success (returns the existing row).
- [ ] `client_set_id` is stored in `session.store.ts` state so that a re-render or a retry within the same session doesn't generate a new ID.

---

## Transaction boundaries

Every set write that touches more than one table must be wrapped in a single SQLite transaction:

```
BEGIN TRANSACTION
  INSERT INTO workout_events (id, session_id, event_type, payload_json, client_event_id, created_at)
  INSERT OR IGNORE INTO workout_sets (...)      -- idempotent via client_set_id
COMMIT
```

A crash after `COMMIT` leaves both rows. A crash before `COMMIT` leaves neither. There is no half-written state.

---

## Session recovery

### On app launch

1. Query `workout_sessions WHERE status = 'in_progress'`.
2. If found:
   a. Call `rebuildSets(session_id)` — recompute `workout_sets` from events.
   b. Restore `session.store.ts` to reflect the live session.
   c. Show a banner: "Resumed your workout from [time]."
   d. If `started_at` was more than 12 hours ago: prompt "Still working out? Resume / End / Discard."
3. If not found: show the home screen normally.

### `rebuildSets(sessionId)`

Pure logic, no side-effects beyond the `workout_sets` upsert:

```
events = SELECT * FROM workout_events
           WHERE session_id = ? ORDER BY created_at ASC

for each event:
  set_added   → upsert into workout_sets
  set_edited  → update the relevant fields
  set_deleted → set deleted_at = event.created_at
```

Call this function on `LiveWorkout` mount — do not trust the existing `workout_sets` rows without running it first.

### Invariant enforced on resume

- At most one `status = 'in_progress'` session. If two are found (should be impossible), log a warning, mark the older one `discarded`, and resume the newer one.

---

## Crash mid-workout

| Scenario | Outcome |
|---|---|
| Crash before `BEGIN TRANSACTION` | No data written. Next tap retries with same `client_set_id`. Safe. |
| Crash inside transaction, before `COMMIT` | SQLite rolls back. Next tap retries. Safe. |
| Crash after `COMMIT` | Both event and set rows exist. Recovery reads them correctly. Safe. |
| App killed while confirmation chip is showing (voice) | The tap was never made. No write happened. Safe. |

---

## Voice stale-command guard

- Every recognised utterance carries a `recognised_at` timestamp.
- Commands older than **60 seconds** at commit time are rejected silently, and the user sees "Tap to log instead."
- Each voice command carries a `command_id`. The command handler checks this against a short-lived in-memory dedup set within the session.

---

## Manual QA scenarios

Run these before each beta build.

| # | Scenario | Expected |
|---|---|---|
| 1 | Log 3 sets. Force-kill app. Reopen. | All 3 sets visible. Session resumes. |
| 2 | Tap "Log set" twice in fast succession (double-tap). | Only 1 set in DB. |
| 3 | Log a set. Edit its weight. Kill app. Reopen. | Edited weight persisted. |
| 4 | Delete a set. Kill app. Reopen. | Set still deleted. |
| 5 | Start session. Put phone in background for 20 min. Resume. | Session intact. Timer continues. |
| 6 | Start session. Change phone clock backward 2 hours. | No negative duration shown. `started_at` is immutable. |
| 7 | Log 5 sets. Tap undo 5 times. | 0 sets visible. Event log has 5 `set_added` + 5 `set_deleted`. |
| 8 | End workout. Kill app before the tags screen saves. | On reopen, "finish this session" prompt leads back to tags screen. |
| 9 | Start a second workout when one is in progress. | Prompt: Resume / Discard current. No silent overwrite. |
| 10 | Run `rebuildSets` on a session with 1 add + 1 edit + 1 delete for the same set. | Only the delete state is reflected in `workout_sets`. |
