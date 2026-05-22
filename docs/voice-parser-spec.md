# Voice Parser Spec — Strength Log Autopilot v1

## Build order constraint

**The typed parser ships before real speech recognition (ASR).**

Phase 8 implements the parser as a pure function that accepts a plain string. The UI exposes a debug text input field to exercise it. Real ASR is wired in a later phase, after the parser is proven correct by unit tests and manual testing.

This avoids coupling two complex, independently-testable systems together before either is stable.

---

## Design principles

- The parser is a **pure function**: `string → IntentResult | null`. No DB calls, no state, no async.
- Every risky command requires explicit tap confirmation before any state change.
- No command can produce invisible side effects.
- When in doubt, the parser returns `null`. The user taps instead.

---

## Supported commands (v1 narrow set)

| Intent | Examples |
|---|---|
| `log_set` | `"bench 80 for 5"`, `"squats 100 by 3"`, `"80 for 5"` *(uses active exercise)* |
| `log_set_same` | `"same again"`, `"again"` |
| `log_set_delta` | `"add 2.5 kilos"`, `"add 5 pounds"` |
| `set_rpe` | `"rpe 8"`, `"rpe 8.5"` *(applied to last set if within 30s)* |
| `undo` | `"undo"`, `"undo last set"` |
| `next_exercise` | `"next exercise"`, `"next"` |
| `prev_exercise` | `"previous exercise"`, `"back"` |
| `start_rest_timer` | `"rest 3 minutes"`, `"rest 90 seconds"` |
| `end_workout` | `"end workout"` — **always requires tap confirmation, never auto-commits** |

Anything outside this list → `null`. UI shows "Tap to log instead."

---

## Grammar (informal)

```
log_set          := exercise? weight sep? reps
log_set_same     := "same again" | "again"
log_set_delta    := ("add" | "plus" | "minus") number unit?
set_rpe          := "rpe" number
undo             := "undo" ("last")? ("set")?
next_exercise    := "next" ("exercise")?
prev_exercise    := ("previous" | "prev" | "back") ("exercise")?
start_rest_timer := "rest" ("timer")? duration
end_workout      := ("end" | "finish") "workout"

exercise := longest-match against normalized_name ∪ alias
weight   := number unit?
reps     := number ("reps")?
sep      := "for" | "by" | "x" | (empty)
unit     := "kg" | "kilo" | "kilos" | "lb" | "lbs" | "pounds"
number   := digit+ ("." | ",")? digit*
duration := number ("min" | "minute" | "minutes" | "sec" | "second" | "seconds")
```

---

## Parsing rules

1. **Normalise first:** lowercase, strip punctuation, collapse whitespace.
2. **Number words:** map `one`…`twenty`, `twenty-five`, `fifty`, `hundred` → digits.
3. **Decimal variants:** `"80.5"`, `"80,5"`, `"eighty point five"` all → `80.5`.
4. **Implicit exercise:** if no exercise token matches, use the session's currently active exercise.
5. **Exercise matching:** longest-prefix match against `exercises.normalized_name` ∪ `exercise_aliases.alias`. On a tie, use Levenshtein distance; on a further tie, bias toward `log_set`.
6. **Unit fallback:** if no unit token, use `user.default_unit`.
7. **Multiple intents:** pick highest `confidence`. On tie, bias toward `log_set`.
8. **Invalid values:** `reps = 0` or `weight < 0` → parser returns `null`.

---

## IntentResult type

```typescript
type IntentResult = {
  intent: Intent
  args: Record<string, unknown>
  confidence: 'high' | 'medium' | 'low'
  rawText: string
}

type Intent =
  | 'log_set'
  | 'log_set_same'
  | 'log_set_delta'
  | 'set_rpe'
  | 'undo'
  | 'next_exercise'
  | 'prev_exercise'
  | 'start_rest_timer'
  | 'end_workout'
```

---

## Confidence levels

| Level | Criteria |
|---|---|
| `high` (≥ 0.9) | All required slots filled with exact matches |
| `medium` (0.7–0.9) | Minor ambiguity: implicit exercise, fuzzy exercise name match |
| `low` (< 0.7) | Significant ambiguity. Parser returns `null` — do not show chip |

---

## Confirmation rules

| Confidence | Intent type | Behaviour |
|---|---|---|
| `high` | Non-destructive (`log_set`, `same_again`, `start_rest_timer`, `next_exercise`) | Show chip, auto-commit after 1.5s. Haptic on commit. Tap-to-cancel available. |
| `medium` | Any | Show chip, wait for explicit tap. No auto-commit. |
| `low` | Any | No chip. Toast: "Tap to log instead." |
| Any | `end_workout` | Show chip, always wait for tap. Never auto-commits. |
| Any | `undo` | Auto-commits (undo is itself reversible by re-logging). |

**Stale-command guard:** at commit time, if `recognised_at` is > 60 seconds ago, reject the command and show "Tap to log instead."

---

## Undo rules

- The undo chip is always visible while the active exercise has ≥ 1 set in the current session.
- "Undo" via voice or the UI chip deletes the most recent non-deleted set via a `set_deleted` event.
- After undo, a "Restore" affordance is shown for 10 seconds (re-logs the same set with a new `client_set_id`).
- Voice "undo" issued > 30 seconds after the last logged set shows a confirmation chip before committing.

---

## Fallback behaviour

| Condition | Behaviour |
|---|---|
| ASR confidence < 0.5 (when real ASR is wired) | Never sent to parser. Toast: "Try again." |
| Parser returns `null` | Toast: "Tap to log instead." |
| Microphone permission denied | Mic button greyed. Tap for help message. |
| Recognition cuts out mid-utterance | Discard. No partial commit. |

---

## Test cases (must all pass before voice ships)

| Input string | Active exercise | Expected intent | Expected confidence |
|---|---|---|---|
| `"bench 80 for 5"` | — | `log_set(bench_press, 80, 5)` | high |
| `"80 for 5"` | bench press | `log_set(bench_press, 80, 5)` | high |
| `"squats 100 by 3"` | — | `log_set(squat, 100, 3)` | high |
| `"same again"` | bench press, last: 80×5 | `log_set(bench_press, 80, 5)` | high |
| `"add 2.5 kilos"` | bench press, last: 80×5 | `log_set(bench_press, 82.5, 5)` | high |
| `"minus 5 reps"` | bench press, last: 80×5 | `null` — reps would be 0 | — |
| `"rpe 8"` | — (within 30s of last set) | `set_rpe(last_set, 8.0)` | high |
| `"undo last set"` | — | `undo` | high |
| `"next exercise"` | — | `next_exercise` | high |
| `"rest 3 minutes"` | — | `start_rest_timer(180)` | high |
| `"end workout"` | — | `end_workout` (requires tap) | high |
| `"bnch ate for 5"` | — | `log_set(bench_press, 80, 5)` | medium |
| `"play music"` | — | `null` | — |
| `""` / whitespace | — | `null` | — |
| `"bench 0 for 5"` | — | `null` — weight = 0 invalid | — |

**Fuzz requirement:** 200 random strings fed to the parser. Parser never throws; returns `IntentResult` or `null` on every input.
