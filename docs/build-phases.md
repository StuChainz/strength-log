# Build Phases — Strength Log Autopilot v1

## Constraints

- 12 phases.
- No backend. No paywall. No wearables. No Apple Watch.
- Typed voice parser ships before real ASR.
- Tap logging must work before voice exists.
- Local SQLite is the source of truth throughout.
- App must be usable as early as possible (Phase 5).

---

## Phase overview

| # | Name | App state after this phase |
|---|---|---|
| 1 | Project scaffold | App boots, one screen, tests run |
| 2 | Local DB schema | SQLite live, exercises seeded, repos typed |
| 3 | Exercise library | Browse, search, create custom exercises |
| 4 | Template builder | Create / edit / delete workout templates |
| 5 | Live workout runner (tap) | **First usable app.** Log sets by tap. |
| 6 | Set edit, delete, undo | Edits recorded in event log |
| 7 | Exercise history | "Last time" sheet + conservative suggestions |
| 8 | Session recovery + idempotency | Crash-proof. Never loses a workout. |
| 9 | Post-session tags + metric samples | PEL-lite data collection begins |
| 10 | Typed voice parser | Parser proved by tests; debug text input in UI |
| 11 | Weekly insight card | One card per week from tags + session data |
| 12 | Export + settings + polish | JSON export, unit toggle, beta build |

---

## Phase 1 — Project scaffold

**Goal:** Expo + TypeScript app boots on iOS and Android, with linting, tests, and a Home screen.

**Files:** `app.config.ts`, `package.json`, `tsconfig.json`, `App.tsx`, `src/screens/Home.tsx`, `jest.config.ts`, `.eslintrc.cjs`, `.prettierrc`

**Tasks:**
- Init Expo SDK with TypeScript strict.
- Absolute imports via `@/*`.
- ESLint + Prettier (Expo defaults + import-order).
- One smoke test for the Home screen.
- Dark mode by default.

**Acceptance criteria:**
- `pnpm dev` opens in iOS simulator and shows "Strength Log."
- `pnpm test` passes.
- `pnpm lint` passes.

**Must not add:** state libraries, SQLite, navigation, voice, any feature dependency.

---

## Phase 2 — Local DB schema

**Goal:** SQLite schema live, migrations idempotent, seed exercises, typed repositories.

**Files:** `src/db/client.ts`, `src/db/migrations/001_init.sql`, `src/db/repositories/*.repo.ts`, `src/domain/types.ts`, `src/domain/ids.ts`, `src/domain/validation.ts`

**Tasks:**
- Implement all tables from `data-model.md`.
- Migration runner: idempotent, runs on app launch.
- Seed ~35 exercises (barbell, dumbbell, bodyweight stubs) + aliases.
- Repositories: CRUD with idempotency on `client_set_id` / `client_event_id`.
- Validation via zod.

**Acceptance criteria:**
- Cold launch creates DB and seeds. Second launch does not re-seed.
- Home debug line shows seed count.
- All DB tests pass including idempotency constraint test.

**Must not add:** UI beyond the debug count line, any feature logic.

---

## Phase 3 — Exercise library

**Goal:** Browse, search, filter by category, and create custom exercises.

**Files:** `src/screens/ExerciseLibrary.tsx`, `src/screens/ExerciseEdit.tsx`, `src/components/ExercisePicker.tsx`, React Navigation (stack)

**Tasks:**
- Search by `normalized_name` (case-insensitive).
- Filter chips: Barbell, Dumbbell, Machine, Bodyweight, Custom.
- Create/edit form: name, category, muscle, unit. Validation from Phase 2 zod schemas.
- Soft-delete via `archived_at`.
- Duplicate name: soft inline warning, not a hard block.

**Acceptance criteria:**
- Add "Decline Bench Press," restart app, search "decline" — found.
- Filter "Custom" shows only user-created exercises.

**Must not add:** templates, workout runner, voice, bulk import.

---

## Phase 4 — Template builder

**Goal:** Create, reorder, edit, and delete workout templates.

**Files:** `src/screens/TemplateList.tsx`, `src/screens/TemplateBuilder.tsx`, `src/db/repositories/templates.repo.ts`

**Tasks:**
- Drag-reorder via `react-native-draggable-flatlist` (or current maintained equivalent).
- Reuse `ExercisePicker` from Phase 3.
- Per exercise: optional target sets × reps × weight × RPE.
- Empty template cannot be saved.
- Soft-delete.

**Acceptance criteria:**
- Create "Push A" with Bench / OHP / Triceps, reorder, restart app — persisted correctly.

**Must not add:** supersets, nested sets, template sharing.

---

## Phase 5 — Live workout runner (tap logging)

**Goal:** Start a workout, tap-log sets, navigate exercises. First phase where a beta user can do something real.

**Files:** `src/screens/LiveWorkout.tsx`, `src/state/session.store.ts`, `src/components/SetRow.tsx`, `src/components/NumberStepper.tsx`, `src/db/repositories/sessions.repo.ts`, `src/db/repositories/sets.repo.ts`, `src/db/repositories/events.repo.ts`, `src/domain/events.ts`

**Tasks:**
- Start from template or "Empty workout."
- `client_set_id` allocated on tap intent, before DB call.
- `set_added` event + `workout_sets` row written in one transaction.
- Steppers: ±2.5 kg / ±5 kg long-press for ±10 kg. Reps ±1 / long-press ±5.
- Inline last-session line above the logger.
- At most one `in_progress` session; second start prompts resume.
- No end-summary yet.

**Acceptance criteria:**
- Complete a Push A workout end-to-end. All sets in DB. Events table contains matching rows.
- Double-tap produces exactly one set.

**Must not add:** edit/undo, history, voice, tags.

---

## Phase 6 — Set edit, delete, undo

**Goal:** Edit and delete sets via the event log. Undo chip.

**Files:** `src/screens/LiveWorkout.tsx`, `src/components/SetRow.tsx`, `src/db/repositories/sets.repo.ts`, `src/db/repositories/events.repo.ts`, `src/domain/events.ts`

**Tasks:**
- Swipe-left on a set → Edit / Delete.
- Edit writes `set_edited` event, updates the materialised row.
- Delete writes `set_deleted` event, sets `deleted_at`.
- Undo chip: always visible when ≥ 1 set exists; taps the most recent non-deleted set.
- `rebuildSets(sessionId)` called on `LiveWorkout` mount.

**Acceptance criteria:**
- Edit weight, kill app, reopen — change persisted via event log.
- Event log has only appended rows; no `UPDATE` or `DELETE` SQL on `workout_events`.

---

## Phase 7 — Exercise history + progression suggestions

**Goal:** History sheet (from live runner and library). Conservative next-set suggestion.

**Files:** `src/screens/ExerciseHistorySheet.tsx`, `src/db/repositories/history.repo.ts`, `src/domain/progression.ts`, `src/domain/volume.ts`

**Tasks:**
- Query last 5 sessions for the exercise.
- Display: date, sets, top set, volume, est. 1RM (Epley; hidden when reps > 10).
- Cache results to `exercise_history_cache` on session end and on set edit/delete.
- Suggestion rules:
  - No history → "No suggestion yet."
  - RPE ≤ 7, reps hit target → +2.5 kg (barbell) / +1 kg (dumbbell).
  - RPE 7–8.5, or reps hit → same weight, same reps.
  - RPE > 8.5, or reps missed once → same weight, reps − 1.
  - Reps missed twice in a row → −10% weight.
- Tap the suggestion to pre-fill the logger. Never auto-fills.

**Acceptance criteria:**
- History sheet opens in < 200ms with 50+ sessions in DB (use fixtures).
- Every suggestion rule branch covered by unit tests.

**Must not add:** charts, ML, anything beyond the described rules.

---

## Phase 8 — Session recovery + idempotency hardening

**Goal:** The app never loses a workout across kills, crashes, or restarts.

**Files:** `src/db/client.ts`, `src/state/session.store.ts`, `src/screens/LiveWorkout.tsx`, (no new sync modules — no backend in v1)

**Tasks:**
- On app launch: detect `in_progress` sessions, run `rebuildSets`, restore store.
- Banner: "Resumed your workout from [time]."
- If `started_at` > 12h ago: prompt Resume / End / Discard.
- Confirm `client_set_id` allocated before every DB write in the tap path.
- Confirm transaction boundary: event + set row written atomically.
- Run all 10 manual QA scenarios from `reliability-model.md`.

**Acceptance criteria:**
- All 10 manual QA scenarios pass on a debug build.
- Force-kill mid-set → reopen → no duplicates, no missing sets.

**Must not add:** backend sync queue, transport layer, network code.

---

## Phase 9 — Post-session tags + metric samples

**Goal:** End-of-workout flow with summary, tags, energy rating, and metric sample writes.

**Files:** `src/screens/EndWorkoutSummary.tsx`, `src/screens/PostSessionTags.tsx`, `src/components/TagChip.tsx`, `src/db/repositories/tags.repo.ts`

**Tasks:**
- End workout → summary screen (volume, duration, set count, PRs).
- Tags screen: fixed vocabulary chips (see `data-model.md`), energy slider, note field (≤ 280 chars).
- Auto-tag `evening_session` / `morning_session` based on local time; user can remove.
- On save: write `post_session_tags`, `session_notes`, and `metric_samples` rows.
- If app killed before tags save: "Finish this session" prompt on next launch.

**Acceptance criteria:**
- Completing a workout produces metric_samples with the expected rows.
- Re-saving with different tags replaces the prior tag set for that session.

**Must not add:** custom tag vocabulary, insight generation.

---

## Phase 10 — Typed voice parser

**Goal:** Parser proved by unit tests and exercisable via a debug text input. No real ASR yet.

**Files:** `src/voice/parser.ts`, `src/voice/grammar.ts`, `src/voice/commands.ts`, `src/voice/confidence.ts`, `src/components/MicButton.tsx` (disabled state), `src/screens/VoiceConfirm.tsx` (debug mode)

**Tasks:**
- Implement the parser from `voice-parser-spec.md` as a pure function.
- All 15+ test cases from the spec must pass.
- Fuzz test: 200 random strings, parser never throws.
- Debug UI: a text input on the live workout screen (hidden behind a dev flag) that feeds strings directly to the parser and shows the `IntentResult`.
- Confirmation chip behaviour per the spec.
- Stale-command guard (60s).

**Acceptance criteria:**
- All spec test cases pass.
- Fuzz test passes.
- Debug input field can exercise "bench 80 for 5" end-to-end and produces a logged set.
- Real ASR is NOT wired. Mic button shows "Coming soon" if tapped.

---

## Phase 11 — Weekly insight card

**Goal:** Generate and display one insight card per week when data thresholds are met.

**Files:** `src/insights/generator.ts`, `src/insights/copy.ts`, `src/insights/thresholds.ts`, `src/db/repositories/insights.repo.ts`, `src/components/InsightCard.tsx`, `src/screens/WeeklyInsights.tsx`

**Tasks:**
- Generator runs on app foreground, if `last_card.week < this_week` and local time ≥ Sunday 19:00.
- Compares tagged-vs-untagged sessions for the hardcoded pairs (evening_session ↔ volume, sleep_short ↔ energy, etc.).
- Skips if < 4 sessions in either group, or < 8 total sessions in trailing 8 weeks.
- Skips if `abs(relative_effect) < 10%`.
- Skips if one outlier drives the entire effect.
- Confidence labels: `low`, `medium`, `high`.
- Copy rules (enforced by a test): no causal language, sample size visible, ≤ 3 sentences, no imperative advice.
- Banned words test: `cause`, `causes`, `causing`, `should`, `must`, `try` must not appear in any generated card body.
- Insight card on Home; full list on Insights screen; "Why am I seeing this?" expandable.

**Acceptance criteria:**
- Deterministic synthetic fixture data → expected card text.
- Insufficient data → no card, Home shows hint.
- Banned-words test passes.

---

## Phase 12 — Export, settings, and beta polish

**Goal:** Full JSON export, settings screen, accessibility pass, performance budget, beta build.

**Files:** `src/screens/Settings.tsx`, export helpers across repos, broad accessibility + perf pass.

**Tasks:**
- Settings: unit (kg/lb), week-start day, voice mode toggle (default OFF), "Export data," "Wipe local data" (with confirm).
- Export covers all tables from `data-model.md`; uses native Share sheet; validates against a written JSON schema.
- Wipe drops and re-creates the DB, re-runs migrations and seed.
- Cold-start < 1.5s on mid-tier device (Pixel 6, iPhone 12).
- Dynamic type up to 200%: no clipped text.
- Haptics: light on `log_set`, success on `workout_completed`.
- Run the full manual gym script twice; fix anything that fails.
- Beta feedback form (5 questions) accessible from Settings.

**Acceptance criteria:**
- Export JSON validates against schema, contains all tables, no bare PII beyond `display_name`.
- Zero crashes in 1 hour of manual fuzz.
- Cold-start budget met.
- Full test suite green.

**Must not add:** import, real payments, real ASR, backend.

---

## Files not to touch across phases

| Rule | Rationale |
|---|---|
| Never `UPDATE` or `DELETE` from `workout_events` | Append-only invariant |
| Never skip `rebuildSets` on LiveWorkout mount | Consistency guarantee |
| Never allocate `client_set_id` after the DB call | Idempotency guarantee |
| Never add a backend call or network dependency | No backend in v1 |
| Never add a paywall or purchase SDK | Out of scope for v1 |
| Never add wearable or ASR dependencies before Phase 10 | Ordered dependency |
