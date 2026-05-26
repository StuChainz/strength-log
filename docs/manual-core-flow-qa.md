# Manual Core Flow QA

Use this checklist for the native Expo Go pass. Keep it short and record only clear pass/fail notes.

## Setup

1. Start the app with `pnpm dev`.
2. Open the native Expo Go app from the `exp://` QR code.
3. In the app, open Settings and wipe local data.
4. Relaunch the app once so migrations and seed data run from a clean native SQLite database.

## Exercise Library

1. Open Exercise Library.
2. Confirm the seeded library count is present and seeded rows render.
3. Search `bench` and confirm bench exercises appear.
4. Search `dl` and confirm Deadlift appears through alias search.
5. Tap Push, Pull, Legs, Hinge, and Core chips and confirm each returns relevant rows.
6. Create a custom exercise with minimal metadata, such as `QA Carry`, category `Other`, no muscle, no unit.
7. Return to Exercise Library, tap Custom, and confirm `QA Carry` appears and does not crash the list.

## Templates

1. Create a template named `QA Push`.
2. Add at least two exercises.
3. Set target sets/reps for one exercise.
4. While editing the template name, notes, sets, reps, weight, and RPE fields, confirm the keyboard does not cover the focused field.
5. Save, leave the screen, return to Templates, and confirm the template and item count persist.

## Live Workout

1. Start a workout from `QA Push`.
2. Confirm the first exercise is active and the log button is visible.
3. Type `32.5` directly into the weight field and confirm the log button reflects the value.
4. Tap the weight `+` and `-` controls and confirm they still change weight in the existing quick increments.
5. Select `Warm-up`, log a set, and confirm the row shows `WARM-UP`.
6. Select `Working`, log a set after the direct weight edit, and confirm the row records the typed weight and shows `WORKING`.
7. Select `Drop`, log a set, and confirm the row shows `DROP`.
8. Edit the first set, change its set type, save, and confirm the row updates.
9. Force close Expo Go, reopen, resume the workout, and verify the set types persist.
10. Open the workout summary and verify elapsed time, total sets, working sets, total volume, working volume, completed set details, and left-to-do target sets.
11. Delete the second set.
12. Use Undo and confirm the remaining latest set is removed according to current app behavior.
13. Add another exercise to the live workout.
14. Type a supported typed voice command such as `80 for 5` and confirm it logs a set.
15. Log a first workout set and confirm a subtle potential PR appears live.
16. Log a stronger set and confirm a live pending PR appears.
17. Edit the stronger set lower and confirm the pending PR disappears.
18. Delete the stronger set and confirm the pending PR disappears.
19. Change a qualifying set to `Warm-up` and confirm the pending PR disappears.

## Recovery

1. With an in-progress workout containing at least one logged set, force close Expo Go.
2. Reopen Expo Go.
3. Confirm the app offers to resume the in-progress workout.
4. Resume and confirm the logged sets are still present.

## End Session

1. Tap the explicit `Finish` button in the live workout top bar.
2. Confirm `Cancel` leaves the workout active.
3. Tap `Finish` again.
4. Confirm `Discard` is destructive and clearly labelled.
5. Tap `Finish` again, then confirm `End Workout` saves and moves to the summary/tags flow.
6. Confirm the end-workout summary still shows duration, set count, and volume.
7. Confirm final PRs appear on the end-workout summary.
8. Log a weaker second workout and confirm no false final PRs appear.
9. Log warm-up-only work and confirm no final PR appears.
10. Force close/reopen before ending a workout, then end and confirm final PRs calculate correctly.
11. Continue to post-session tags.
12. Select fixed tags, set an energy rating, and enter a note under 280 characters.
13. Save and return home.

## History And Export

1. Open the exercise history for an exercise used in the completed session.
2. Confirm recent session data, top set, volume, and estimated 1RM display where eligible.
3. Open Settings export.
4. Confirm export completes and includes exercises, metadata, templates, sessions, events, sets, PR records, tags, notes, metrics, history cache, and insights if present.

## Weekly Insight

1. With only a few sessions, confirm no weekly insight is shown.
2. After enough representative completed sessions exist, confirm at most one cautious insight card appears.
3. Confirm the insight wording includes sample size/confidence and does not make causal or imperative claims.
