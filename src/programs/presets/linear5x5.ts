import type { ProgramPreset } from '../types';

export const LINEAR_5X5: ProgramPreset = {
  id: 'linear-5x5',
  name: '5x5 Linear Strength',
  shortDescription: 'Three full-body sessions a week, alternating A/B, adding weight each workout.',
  description:
    'A beginner full-body barbell programme built around three lifts per session, five sets of five reps. Alternate Workout A and Workout B across three training days per week (e.g. Mon/Wed/Fri). Add a small fixed increment to each lift every session you complete all reps; if you miss reps two or three sessions in a row, reduce the weight and work back up.',
  daysPerWeek: 3,
  experienceLevel: 'beginner',
  source: { label: 'Classic 5x5 linear-progression structure (StrongLifts-style)' },
  defaultUnit: 'kg',
  workouts: [
    {
      key: 'workout-a',
      name: 'Workout A',
      notes: 'Squat, Bench, Row. Alternate with Workout B.',
      exercises: [
        {
          match: { normalizedName: 'barbell back squat' },
          targetSets: 5,
          targetReps: 5,
          restSeconds: 180,
          progression: { rule: 'linear', incrementKg: 2.5, incrementLb: 5 },
        },
        {
          match: { normalizedName: 'barbell bench press' },
          targetSets: 5,
          targetReps: 5,
          restSeconds: 180,
          progression: { rule: 'linear', incrementKg: 2.5, incrementLb: 5 },
        },
        {
          match: { normalizedName: 'barbell row' },
          targetSets: 5,
          targetReps: 5,
          restSeconds: 180,
          progression: { rule: 'linear', incrementKg: 2.5, incrementLb: 5 },
        },
      ],
    },
    {
      key: 'workout-b',
      name: 'Workout B',
      notes: 'Squat, Overhead Press, Deadlift. Alternate with Workout A.',
      exercises: [
        {
          match: { normalizedName: 'barbell back squat' },
          targetSets: 5,
          targetReps: 5,
          restSeconds: 180,
          progression: { rule: 'linear', incrementKg: 2.5, incrementLb: 5 },
        },
        {
          match: { normalizedName: 'overhead press' },
          targetSets: 5,
          targetReps: 5,
          restSeconds: 180,
          progression: { rule: 'linear', incrementKg: 2.5, incrementLb: 5 },
        },
        {
          match: { normalizedName: 'barbell deadlift' },
          targetSets: 1,
          targetReps: 5,
          restSeconds: 240,
          progression: { rule: 'linear', incrementKg: 5, incrementLb: 10 },
          amrapLastSet: true,
          notes: 'One working set of 5. Treat as 5+ AMRAP. Larger weekly jump than upper-body lifts.',
        },
      ],
    },
  ],
};
