# MVP Scope — Strength Log Autopilot v1

## What this prototype proves

1. A gym session can be logged faster than with Strong, Hevy, or paper.
2. The app never loses a set, even across crashes and kills.
3. Post-session tags + one weekly insight feel worth doing.
4. Exercise history ("what did I do last time?") gets opened during workouts.

## What this prototype does NOT prove

- Whether wearable integrations matter.
- Whether AI coaching adds value.
- Whether social features drive growth.
- Long-term retention beyond 6 weeks.
- Monetisation conversion.

## Success metrics (4-week beta, n = 15–30)

| Metric | Target |
|---|---|
| Median time to log a set (tap) | ≤ 4 seconds |
| Started workouts that reach completed state | ≥ 80% |
| Lost workouts | 0 |
| Completed workouts with ≥ 1 post-session tag | ≥ 50% |
| Users who open the weekly insight card | ≥ 40% |
| Sessions with ≥ 1 exercise-history view | Median ≥ 1 |

---

## Must-have (first working prototype)

- Local SQLite database (source of truth, no backend).
- Exercise library: seed exercises + create custom.
- Workout templates: create, edit, delete.
- Live workout runner: tap-to-log sets (weight, reps, optional RPE).
- Set edit and undo.
- End-of-workout summary.
- Exercise history view ("last time you did this").
- Typed voice parser for the narrow command set (no real ASR until parser works).
- Post-session tags (fixed vocabulary).
- Session recovery after app kill / crash.
- Idempotency on every set write.
- One weekly insight card.
- Local JSON data export.

## Should-have (after first prototype is stable)

- Rest timer with notification.
- Plate calculator.
- Supersets / circuits in templates.
- Customisable tag vocabulary.
- Real speech recognition wired to the working parser.
- Cloud backup / multi-device sync (backend required — out of v1 scope).

## Explicitly out of scope for v1

| Category | Detail |
|---|---|
| Backend / sync | No server. All data stays in SQLite. |
| Wearables | No Oura, WHOOP, Garmin, Strava, Apple Watch. |
| Apple Watch app | Deferred entirely. |
| Real ASR | Voice parser ships as a typed-input debug tool first. |
| AI coaching | No form analysis, no adaptive programmes. |
| Social | No sharing, friends, feed, or marketplace. |
| Food / calories | Not in scope. |
| Paywall | No payment flows. Gating hooks can be added in a later phase. |
| Localisations | English only. |
| Push notifications | Only for the rest timer, if built. |

---

## Platform decision

**React Native / Expo — not web-first.**

Web-first would be faster to scaffold but cannot validate the core hypothesis ("fast logging beats existing apps"). PWA voice APIs are inconsistent on iOS Safari, background behaviour is hostile, and tap-target / haptic requirements are awkward in a browser. Build Expo, ship to TestFlight and Play Internal Testing from Phase 1.
