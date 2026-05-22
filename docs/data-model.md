# Data Model — Strength Log Autopilot v1

## Principles

- SQLite is the source of truth. There is no backend in v1.
- All IDs are UUIDv7 (sortable, generated client-side before any DB call).
- All timestamps are stored as `INTEGER` (Unix ms). ISO strings on the wire.
- `workout_sets` is a **derived / materialised** table, rebuilt from `workout_events`.
- Events are **append-only**. Deletes are recorded as `set_deleted` events, never as SQL DELETE.
- Every write that creates or mutates a set must be idempotent via `client_set_id`.

---

## Tables

### `users`
Single row. Local profile.

| Field | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUIDv7 |
| `display_name` | TEXT | |
| `default_unit` | TEXT | `'kg'` or `'lb'` |
| `created_at` | INTEGER | |
| `updated_at` | INTEGER | |

---

### `exercises`
Seed catalogue plus user-created exercises.

| Field | Type | Notes |
|---|---|---|
| `id` | TEXT PK | UUIDv7 |
| `name` | TEXT NOT NULL | Display name |
| `normalized_name` | TEXT NOT NULL | Lowercase, punctuation stripped — used for search and voice matching |
| `category` | TEXT NOT NULL | `barbell`, `dumbbell`, `machine`, `bodyweight`, `cable`, `other` |
| `primary_muscle` | TEXT | Optional |
| `default_unit` | TEXT | `'kg'` or `'lb'` — falls back to user default |
| `is_custom` | INTEGER | `0` = seed, `1` = user-created |
| `archived_at` | INTEGER | Soft delete |
| `created_at` | INTEGER | |
| `updated_at` | INTEGER | |

**Indexes:** `idx_exercises_normalized_name`, `idx_exercises_archived`

**Seed target:** ~35 common barbell / dumbbell / bodyweight exercises plus 5–10 machine stubs.

---

### `exercise_aliases`
Voice-match shortcuts. `"bench"` → Bench Press.

| Field | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `exercise_id` | TEXT FK | → `exercises.id` |
| `alias` | TEXT NOT NULL | Normalised (lowercase, no punctuation) |
| `source` | TEXT | `'seed'` or `'user'` |
| `created_at` | INTEGER | |

**Indexes:** `idx_aliases_alias`, `idx_aliases_exercise`
**Unique:** `alias` globally unique. Conflicts on user creation fail loudly.

---

### `templates`
Named workout programmes.

| Field | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `name` | TEXT NOT NULL | |
| `notes` | TEXT | Optional |
| `archived_at` | INTEGER | Soft delete |
| `created_at` | INTEGER | |
| `updated_at` | INTEGER | |

---

### `template_items`
Ordered exercises inside a template.

| Field | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `template_id` | TEXT FK | |
| `exercise_id` | TEXT FK | |
| `position` | INTEGER NOT NULL | 0-indexed |
| `target_sets` | INTEGER | Optional |
| `target_reps` | INTEGER | Optional |
| `target_weight` | REAL | Optional |
| `target_rpe` | REAL | Optional |

**Unique:** `(template_id, position)`

---

### `workout_sessions`
One row per workout attempt.

| Field | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `template_id` | TEXT FK | Nullable |
| `name` | TEXT | Optional display name |
| `status` | TEXT NOT NULL | `in_progress`, `completed`, `discarded` |
| `started_at` | INTEGER NOT NULL | |
| `ended_at` | INTEGER | Nullable |
| `total_volume_cached` | REAL | Denormalised — recalculated on session end |
| `created_at` | INTEGER | |
| `updated_at` | INTEGER | |

**Indexes:** `idx_sessions_status`, `idx_sessions_started DESC`
**Invariant:** at most one row with `status = 'in_progress'` at any time.

---

### `workout_events`
**Append-only event log. The canonical truth.**

| Field | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `session_id` | TEXT FK | |
| `event_type` | TEXT NOT NULL | See types below |
| `payload_json` | TEXT NOT NULL | Serialised event data |
| `client_event_id` | TEXT NOT NULL UNIQUE | Idempotency key for this event |
| `created_at` | INTEGER NOT NULL | |

**Event types:** `session_started`, `set_added`, `set_edited`, `set_deleted`, `session_ended`, `session_discarded`, `tags_added`

**Rules:**
- Never UPDATE or DELETE a row from this table.
- `client_event_id` unique constraint prevents duplicate events on retry.

**Indexes:** `idx_events_session_created (session_id, created_at)`, `UNIQUE (client_event_id)`

---

### `workout_sets`
**Materialised / derived. Rebuilt from `workout_events` via `rebuildSets(sessionId)`.**

| Field | Type | Notes |
|---|---|---|
| `id` | TEXT PK | Matches the `set_added` event's set ID |
| `session_id` | TEXT FK | |
| `exercise_id` | TEXT FK | |
| `position` | INTEGER NOT NULL | Within session + exercise |
| `weight` | REAL | |
| `reps` | INTEGER | |
| `rpe` | REAL | Optional, 1–10 |
| `unit` | TEXT | `'kg'` or `'lb'` |
| `is_warmup` | INTEGER | Default 0 |
| `logged_at` | INTEGER NOT NULL | |
| `source` | TEXT NOT NULL | `'tap'` or `'voice'` |
| `client_set_id` | TEXT NOT NULL UNIQUE | Idempotency key — allocated client-side before the DB write |
| `deleted_at` | INTEGER | Soft delete via `set_deleted` event |

**Indexes:** `idx_sets_session (session_id, position)`, `idx_sets_exercise_logged (exercise_id, logged_at DESC)`, `UNIQUE (client_set_id)`

---

### `exercise_history_cache`
Pre-aggregated per-exercise stats. Rebuilt on session end and on set edit/delete.

| Field | Type | Notes |
|---|---|---|
| `exercise_id` | TEXT PK | |
| `last_session_id` | TEXT | |
| `last_session_at` | INTEGER | |
| `last_top_set_weight` | REAL | |
| `last_top_set_reps` | INTEGER | |
| `last_session_volume` | REAL | |
| `est_1rm` | REAL | Epley: `weight × (1 + reps/30)`. Hidden when reps > 10 |
| `recent_sessions_json` | TEXT | Serialised array of last 5 sessions |
| `updated_at` | INTEGER | |

---

### `post_session_tags`
Tags applied after a session is completed.

| Field | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `session_id` | TEXT FK | |
| `tag` | TEXT NOT NULL | From fixed vocabulary (see below) |
| `created_at` | INTEGER | |

**Unique:** `(session_id, tag)`

**Fixed tag vocabulary (v1):**
`sleep_short`, `sleep_long`, `stressed`, `sore`, `fasted`, `caffeinated`, `ill`, `traveled`, `alcohol_prev_night`, `evening_session`, `morning_session`, `felt_strong`, `felt_weak`

Auto-tagged (user can remove):
- `evening_session` — if session ended after 20:00 local.
- `morning_session` — if session started before 09:00 local.

---

### `session_notes`
Energy rating and free-text note. One row per session.

| Field | Type | Notes |
|---|---|---|
| `session_id` | TEXT PK | |
| `energy_rating` | INTEGER | 1–10, optional |
| `note` | TEXT | ≤ 280 chars, optional |
| `updated_at` | INTEGER | |

---

### `metric_samples`
Key/value time-series for the PEL insight layer. Written on session end.

| Field | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `metric_key` | TEXT NOT NULL | e.g. `session_volume`, `tag.evening_session`, `energy_rating` |
| `value_num` | REAL | |
| `value_text` | TEXT | Rarely used in v1 |
| `sampled_at` | INTEGER NOT NULL | |
| `source` | TEXT | `'workout'` or `'user_tag'` |
| `created_at` | INTEGER | |

**Index:** `idx_metric_key_sampled (metric_key, sampled_at DESC)`

Metrics written per session end:
- `session_volume`
- `session_duration_min`
- `session_set_count`
- `tag.<tag_name>` = 1 for each tag
- `energy_rating` (if provided)

---

### `weekly_insight_cards`
One card generated per week (if data thresholds are met).

| Field | Type | Notes |
|---|---|---|
| `id` | TEXT PK | |
| `generated_for_week_start` | INTEGER NOT NULL | Unix ms of Monday 00:00 local |
| `title` | TEXT NOT NULL | |
| `body` | TEXT NOT NULL | ≤ 3 sentences |
| `sample_size` | INTEGER NOT NULL | |
| `confidence_label` | TEXT NOT NULL | `low`, `medium`, `high` |
| `payload_json` | TEXT | Metrics and session IDs referenced |
| `dismissed_at` | INTEGER | |
| `created_at` | INTEGER | |

**Unique:** `(generated_for_week_start)` — one card per week.

---

## Key invariants

1. `workout_events` is never mutated after insert.
2. `workout_sets` is always rebuildable from `workout_events` alone.
3. `client_set_id` is allocated before the DB write, on the tap/voice intent.
4. At most one `workout_sessions` row has `status = 'in_progress'`.
5. A `set_deleted` event makes the set invisible to queries filtering `deleted_at IS NULL`.
6. All writes to `workout_events` also write to `workout_sets` in the **same transaction**.
