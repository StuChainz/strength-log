import type { ProgramPreset } from '../types';

/**
 * GZCLP — four-day tier-based linear progression.
 *
 * The real programme uses a rep-scheme ladder (5x3+, 6x2+, 10x1+) on T1 and
 * (3x10 → 3x8 → 3x6) on T2, plus AMRAP last sets. The existing progression
 * engine only models linear / double / rpe_gated, so this preset encodes the
 * *starting* set/rep scheme and explains the cycling in notes. The user adds
 * weight via the linear progression rule and manages tier rotations manually.
 */
export const GZCLP: ProgramPreset = {
  id: 'gzclp',
  name: 'GZCLP',
  shortDescription: 'Four-day tier-based linear progression with main, secondary and accessory lifts.',
  description:
    'A four-day-per-week linear progression with three tiers. T1 is a heavy main lift for 5 sets of 3, T2 is a secondary compound for 3 sets of 10, T3 is an accessory for 3 sets of 15. Add weight to T1 and T2 each session you complete all reps; treat the final set as an AMRAP if you have it in you. When you stall, the original programme rotates rep schemes (5x3 → 6x2 → 10x1 for T1, 3x10 → 3x8 → 3x6 for T2) — this preset only encodes the starting scheme, so manage rotations manually.',
  daysPerWeek: 4,
  experienceLevel: 'beginner',
  source: { label: 'Inspired by Cody Lefever’s GZCLP framework' },
  defaultUnit: 'kg',
  workouts: [
    {
      key: 'day-a',
      name: 'Day A — Squat / Bench / Lat Pulldown',
      notes: 'T1 Squat, T2 Bench, T3 Lat Pulldown.',
      exercises: [
        {
          match: { normalizedName: 'barbell back squat' },
          targetSets: 5,
          targetReps: 3,
          restSeconds: 180,
          progression: { rule: 'linear', incrementKg: 5, incrementLb: 10 },
          amrapLastSet: true,
          notes: 'T1: 5x3, last set AMRAP. Add 5 kg / 10 lb each session.',
        },
        {
          match: { normalizedName: 'barbell bench press' },
          targetSets: 3,
          targetReps: 10,
          restSeconds: 120,
          progression: { rule: 'linear', incrementKg: 2.5, incrementLb: 5 },
          notes: 'T2: 3x10. Add 2.5 kg / 5 lb each session.',
        },
        {
          match: { normalizedName: 'lat pulldown' },
          targetSets: 3,
          targetReps: 15,
          restSeconds: 90,
          progression: { rule: 'none' },
          notes: 'T3: 3x15, last set AMRAP. Add weight after hitting 25+ on the AMRAP set.',
        },
      ],
    },
    {
      key: 'day-b',
      name: 'Day B — OHP / Deadlift / Row',
      notes: 'T1 Overhead Press, T2 Deadlift, T3 Dumbbell Row.',
      exercises: [
        {
          match: { normalizedName: 'overhead press' },
          targetSets: 5,
          targetReps: 3,
          restSeconds: 180,
          progression: { rule: 'linear', incrementKg: 2.5, incrementLb: 5 },
          amrapLastSet: true,
          notes: 'T1: 5x3, last set AMRAP. Smaller jump on upper-body T1.',
        },
        {
          match: { normalizedName: 'barbell deadlift' },
          targetSets: 3,
          targetReps: 10,
          restSeconds: 180,
          progression: { rule: 'linear', incrementKg: 5, incrementLb: 10 },
          notes: 'T2: 3x10.',
        },
        {
          match: { normalizedName: 'single arm dumbbell row' },
          targetSets: 3,
          targetReps: 15,
          restSeconds: 90,
          progression: { rule: 'none' },
          notes: 'T3: 3x15 per side, last set AMRAP.',
        },
      ],
    },
    {
      key: 'day-c',
      name: 'Day C — Bench / Squat / Lat Pulldown',
      notes: 'T1 Bench, T2 Squat, T3 Lat Pulldown.',
      exercises: [
        {
          match: { normalizedName: 'barbell bench press' },
          targetSets: 5,
          targetReps: 3,
          restSeconds: 180,
          progression: { rule: 'linear', incrementKg: 2.5, incrementLb: 5 },
          amrapLastSet: true,
          notes: 'T1: 5x3, last set AMRAP.',
        },
        {
          match: { normalizedName: 'barbell back squat' },
          targetSets: 3,
          targetReps: 10,
          restSeconds: 150,
          progression: { rule: 'linear', incrementKg: 5, incrementLb: 10 },
          notes: 'T2: 3x10.',
        },
        {
          match: { normalizedName: 'lat pulldown' },
          targetSets: 3,
          targetReps: 15,
          restSeconds: 90,
          progression: { rule: 'none' },
          notes: 'T3: 3x15, last set AMRAP.',
        },
      ],
    },
    {
      key: 'day-d',
      name: 'Day D — Deadlift / OHP / Row',
      notes: 'T1 Deadlift, T2 Overhead Press, T3 Dumbbell Row.',
      exercises: [
        {
          match: { normalizedName: 'barbell deadlift' },
          targetSets: 5,
          targetReps: 3,
          restSeconds: 240,
          progression: { rule: 'linear', incrementKg: 5, incrementLb: 10 },
          amrapLastSet: true,
          notes: 'T1: 5x3, last set AMRAP.',
        },
        {
          match: { normalizedName: 'overhead press' },
          targetSets: 3,
          targetReps: 10,
          restSeconds: 120,
          progression: { rule: 'linear', incrementKg: 2.5, incrementLb: 5 },
          notes: 'T2: 3x10.',
        },
        {
          match: { normalizedName: 'single arm dumbbell row' },
          targetSets: 3,
          targetReps: 15,
          restSeconds: 90,
          progression: { rule: 'none' },
          notes: 'T3: 3x15 per side, last set AMRAP.',
        },
      ],
    },
  ],
};
