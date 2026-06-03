import {
  ExerciseMetadataInputSchema,
  type ExerciseMetadataInput,
} from '@/domain/validation';

export interface SerializedExerciseMetadataInput {
  movement_pattern: ExerciseMetadataInput['movement_pattern'];
  force_type: ExerciseMetadataInput['force_type'];
  body_region: ExerciseMetadataInput['body_region'];
  primary_muscles_json: string;
  secondary_muscles_json: string;
  tertiary_muscles_json: string;
  equipment_json: string;
  mechanics: ExerciseMetadataInput['mechanics'];
  laterality: ExerciseMetadataInput['laterality'];
  difficulty: ExerciseMetadataInput['difficulty'];
  substitution_group: string;
  source: string;
  source_id: string | null;
}

export function serializeExerciseMetadataInput(input: unknown): SerializedExerciseMetadataInput {
  const metadata = ExerciseMetadataInputSchema.parse(input);

  return {
    movement_pattern: metadata.movement_pattern,
    force_type: metadata.force_type,
    body_region: metadata.body_region,
    primary_muscles_json: JSON.stringify(metadata.primary_muscles),
    secondary_muscles_json: JSON.stringify(metadata.secondary_muscles),
    tertiary_muscles_json: JSON.stringify(metadata.tertiary_muscles),
    equipment_json: JSON.stringify(metadata.equipment),
    mechanics: metadata.mechanics,
    laterality: metadata.laterality,
    difficulty: metadata.difficulty,
    substitution_group: metadata.substitution_group,
    source: metadata.source,
    source_id: metadata.source_id,
  };
}
