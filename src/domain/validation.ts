import { z } from 'zod';
import {
  BODY_REGIONS,
  EQUIPMENT,
  EXERCISE_CATEGORIES,
  FORCE_TYPES,
  LATERALITY_TYPES,
  MECHANICS_TYPES,
  MOVEMENT_PATTERNS,
  MUSCLE_GROUPS,
  UNITS,
} from '@/domain/types';

export const UnitSchema = z.enum(UNITS);

export const ExerciseCategorySchema = z.enum(EXERCISE_CATEGORIES);
export const ForceTypeSchema = z.enum(FORCE_TYPES);
export const MovementPatternSchema = z.enum(MOVEMENT_PATTERNS);
export const MuscleGroupSchema = z.enum(MUSCLE_GROUPS);
export const BodyRegionSchema = z.enum(BODY_REGIONS);
export const EquipmentSchema = z.enum(EQUIPMENT);
export const MechanicsSchema = z.enum(MECHANICS_TYPES);
export const LateralitySchema = z.enum(LATERALITY_TYPES);

export const CreateExerciseSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  category: ExerciseCategorySchema,
  primary_muscle: z.string().max(60).nullable().optional(),
  default_unit: UnitSchema.nullable().optional(),
});

export const UpdateExerciseSchema = CreateExerciseSchema.partial();

export const ExerciseMetadataInputSchema = z.object({
  movement_pattern: MovementPatternSchema,
  force_type: ForceTypeSchema,
  body_region: BodyRegionSchema,
  primary_muscles: z.array(MuscleGroupSchema),
  secondary_muscles: z.array(MuscleGroupSchema),
  equipment: z.array(EquipmentSchema),
  mechanics: MechanicsSchema,
  laterality: LateralitySchema,
  difficulty: z.number().int().min(1).max(5).nullable(),
  substitution_group: z.string().min(1).max(100),
  source: z.string().min(1).max(80).default('curated_seed'),
  source_id: z.string().min(1).max(120).nullable(),
});

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
export type ExerciseMetadataInput = z.infer<typeof ExerciseMetadataInputSchema>;
export type PostSessionTagValue = z.infer<typeof PostSessionTagSchema>;
export type SessionNoteInput = z.infer<typeof SessionNoteSchema>;
