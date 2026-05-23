import { z } from 'zod';

export const UnitSchema = z.enum(['kg', 'lb']);

export const ExerciseCategorySchema = z.enum([
  'barbell',
  'dumbbell',
  'machine',
  'bodyweight',
  'cable',
  'other',
]);

export const CreateExerciseSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  category: ExerciseCategorySchema,
  primary_muscle: z.string().max(60).nullable().optional(),
  default_unit: UnitSchema.nullable().optional(),
});

export const UpdateExerciseSchema = CreateExerciseSchema.partial();

export const POST_SESSION_TAGS = [
  'sleep_short',
  'sleep_long',
  'stressed',
  'sore',
  'fasted',
  'caffeinated',
  'ill',
  'traveled',
  'alcohol_prev_night',
  'evening_session',
  'morning_session',
  'felt_strong',
  'felt_weak',
] as const;

export const PostSessionTagSchema = z.enum(POST_SESSION_TAGS);

export const SessionNoteSchema = z.object({
  energy_rating: z.number().int().min(1).max(10).nullable().optional(),
  note: z.string().max(280).nullable().optional(),
});

export type CreateExerciseInput = z.infer<typeof CreateExerciseSchema>;
export type UpdateExerciseInput = z.infer<typeof UpdateExerciseSchema>;
export type PostSessionTagValue = z.infer<typeof PostSessionTagSchema>;
export type SessionNoteInput = z.infer<typeof SessionNoteSchema>;
