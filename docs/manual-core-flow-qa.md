# Manual Core Flow QA

Scope: beta-readiness pass for the real workout loop only. Do not use this checklist to test backend, auth, payments, sync, wearables, HealthKit, ASR, AI, social, food logging, coaching, charts, insights, or new program behavior.

Run this once on a clean local SQLite database before a small friend beta. Record Pass/Fail and notes for each row.

## Setup

1. Start the app with `pnpm dev`.
2. Open the app in Expo Go or the native dev build.
3. In Settings, wipe local data.
4. Fully close and reopen the app once.

## Core Flow Checklist

| # | Step | Expected result | Coverage |
|---|---|---|---|
| 1 | Fresh install opens Home. | Home renders with `Strength Log` and the start workout button. | Automated: `src/__tests__/Home.test.tsx`. Manual because this verifies the native shell launches. |
| 2 | Start empty workout from Home. | Live workout opens with no exercise selected and no workout is discarded. | Automated: flow repository tests create an empty local session; manual verifies navigation. |
| 3 | Add one exercise. | The exercise becomes active and the log controls appear. | Automated: `src/__tests__/flows/live-workout-screen-flow.test.tsx` covers the active exercise/log controls. Manual verifies picker wiring. |
| 4 | Log three sets quickly by tap. | Three visible set rows are created for the exercise. | Automated: `src/__tests__/flows/core-app-flow.test.ts` and `src/__tests__/flows/beta-bug-hunt.test.ts` cover tap-sourced set events and materialized sets. |
| 5 | Rapid double tap creates one set. | A fast second tap during the first write does not create a duplicate visible set. | Automated: `rapid double tapping the log button only logs one set` in `src/__tests__/flows/live-workout-screen-flow.test.tsx`. |
| 6 | Edit set weight and reps. | Edited values appear in the row and survive event-log rebuild. | Automated: screen edit tests plus `starts, logs, edits, deletes, undoes, and rebuilds workout sets from append-only events`. |
| 7 | Delete one set. | The row disappears; the event log keeps a `set_deleted` event. | Automated: repository flow tests cover soft delete and rebuild. Manual verifies the confirmation UI. |
| 8 | Undo last visible set. | The latest remaining visible set is removed, and previous deleted sets stay deleted. | Automated: screen undo test and repository delete-as-undo event coverage. Manual verifies the confirmation UI. |
| 9 | Kill app during active workout. | No completed or discarded state is written. | Manual-only: force-kill behavior depends on OS/app container lifecycle. |
| 10 | Reopen app. | Home shows the in-progress workout recovery card. | Automated: `src/__tests__/Home.test.tsx` covers recovery surfaces; manual verifies native startup. |
| 11 | Resume workout. | Live workout resumes the same local SQLite session. | Automated: `session recovery` and flow rebuild tests cover active session recovery. Manual verifies the alert/navigation path. |
| 12 | Confirm sets, edits, deletes, and undo state are correct. | Visible rows match the state before the kill: edited values remain, deleted/undone rows are absent, and set order is sensible. | Automated: event-log rebuild tests cover add/edit/delete replay and duplicate-safe rebuild. |
| 13 | Finish workout. | Session status becomes `completed`, summary opens, and no sets are lost. | Automated: `EndWorkoutSummary.test.tsx` and flow tests cover completed summary data. Manual verifies the Finish confirmation UI. |
| 14 | Kill app before saving tags. | The completed session remains untagged; no workout data is discarded. | Automated: repository test covers untagged completed session lookup. Manual-only for OS kill timing. |
| 15 | Reopen app. | Home shows `FINISH THIS SESSION`. | Automated: `src/__tests__/Home.test.tsx` covers the card. Manual verifies native startup. |
| 16 | Save tags, energy, and note. | Tags, energy rating, note, and metrics save locally; Home no longer prompts for that session. | Automated: `src/__tests__/flows/core-app-flow.test.ts`, `src/__tests__/flows/beta-bug-hunt.test.ts`, and `src/__tests__/tags.test.ts`. |
| 17 | Export data. | Export completes from Settings. | Manual-only for share-sheet/file handoff; export repository is automated. |
| 18 | Confirm exported JSON includes sessions, events, sets, tags, notes, and app settings. | JSON has `workout_sessions`, `workout_events`, `workout_sets`, `post_session_tags`, `session_notes`, and `app_settings` table keys. | Automated: export schema/repository tests verify required tables. Manual verifies the actual exported file. |

## Known Manual Gaps

- Native force-kill/reopen behavior cannot be fully simulated by Jest; rows 9, 10, 14, 15, and 17 need a real device or simulator pass.
- Exercise picker navigation is partially manual in this scoped checklist because the screen tests mock the picker component.
- The checklist verifies the export file has required table keys, not a full field-by-field JSON audit.
