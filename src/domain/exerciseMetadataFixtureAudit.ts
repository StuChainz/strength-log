import { z } from 'zod';
import { normalizeName } from '@/domain/ids';
import { ExerciseMetadataInputSchema } from '@/domain/validation';
import type { ForceType, MovementPattern } from '@/domain/types';

export interface ExerciseMetadataFixtureExercise {
  name: string;
  category?: string;
  primary_muscle?: string | null;
}

export interface ExerciseMetadataFixtureAuditOptions {
  requiredMovementPatterns?: readonly MovementPattern[];
  requiredForceTypes?: readonly ForceType[];
  requirePrimaryMuscle?: boolean;
  requireEquipment?: boolean;
  requireSourceId?: boolean;
}

export type ExerciseMetadataFixtureIssueCode =
  | 'duplicate_exercise_name'
  | 'duplicate_metadata_exercise'
  | 'duplicate_source_id'
  | 'invalid_metadata'
  | 'metadata_without_exercise'
  | 'missing_equipment'
  | 'missing_primary_muscle'
  | 'missing_required_force_type'
  | 'missing_required_movement_pattern'
  | 'missing_source_id';

export interface ExerciseMetadataFixtureIssue {
  code: ExerciseMetadataFixtureIssueCode;
  message: string;
  exerciseName?: string;
  source?: string;
  sourceId?: string;
  value?: string;
}

export interface ExerciseMetadataFixtureAuditResult {
  ok: boolean;
  issues: ExerciseMetadataFixtureIssue[];
  counts: {
    exercises: number;
    metadata: number;
    movementPatterns: number;
    forceTypes: number;
    sources: number;
  };
}

export interface ExerciseMetadataCoverageItem {
  name: string;
  category?: string;
  primary_muscle?: string | null;
}

export interface ExerciseMetadataCoverageSummary {
  totalExercises: number;
  annotatedExercises: number;
  unannotatedExercises: number;
  coverageRatio: number;
  unannotated: ExerciseMetadataCoverageItem[];
}

const FixtureEntrySchema = ExerciseMetadataInputSchema.extend({
  exerciseName: z.string().min(1),
});

const DEFAULT_OPTIONS: Required<ExerciseMetadataFixtureAuditOptions> = {
  requiredMovementPatterns: [],
  requiredForceTypes: [],
  requirePrimaryMuscle: true,
  requireEquipment: true,
  requireSourceId: true,
};

export function auditExerciseMetadataFixture(
  exercises: readonly ExerciseMetadataFixtureExercise[],
  metadataEntries: readonly unknown[],
  options: ExerciseMetadataFixtureAuditOptions = {},
): ExerciseMetadataFixtureAuditResult {
  const auditOptions = { ...DEFAULT_OPTIONS, ...options };
  const issues: ExerciseMetadataFixtureIssue[] = [];
  const exerciseNames = new Set<string>();
  const duplicatedExerciseNames = new Set<string>();
  const metadataExerciseNames = new Set<string>();
  const movementPatterns = new Set<MovementPattern>();
  const forceTypes = new Set<ForceType>();
  const sources = new Set<string>();
  const sourceKeys = new Set<string>();

  exercises.forEach((exercise) => {
    const normalizedName = normalizeName(exercise.name);
    if (exerciseNames.has(normalizedName) && !duplicatedExerciseNames.has(normalizedName)) {
      duplicatedExerciseNames.add(normalizedName);
      issues.push({
        code: 'duplicate_exercise_name',
        message: `Duplicate seed exercise name after normalization: ${exercise.name}`,
        exerciseName: exercise.name,
      });
    }
    exerciseNames.add(normalizedName);
  });

  metadataEntries.forEach((entry) => {
    const parsed = FixtureEntrySchema.safeParse(entry);
    const rawExerciseName = readStringField(entry, 'exerciseName');

    if (!parsed.success) {
      issues.push({
        code: 'invalid_metadata',
        message: parsed.error.issues.map((issue) => issue.message).join('; '),
        exerciseName: rawExerciseName,
      });
      return;
    }

    const metadata = parsed.data;
    const normalizedExerciseName = normalizeName(metadata.exerciseName);
    movementPatterns.add(metadata.movement_pattern);
    forceTypes.add(metadata.force_type);
    sources.add(metadata.source);

    if (!exerciseNames.has(normalizedExerciseName)) {
      issues.push({
        code: 'metadata_without_exercise',
        message: `Metadata references a missing seed exercise: ${metadata.exerciseName}`,
        exerciseName: metadata.exerciseName,
      });
    }

    if (metadataExerciseNames.has(normalizedExerciseName)) {
      issues.push({
        code: 'duplicate_metadata_exercise',
        message: `Duplicate metadata entry for exercise: ${metadata.exerciseName}`,
        exerciseName: metadata.exerciseName,
      });
    }
    metadataExerciseNames.add(normalizedExerciseName);

    if (auditOptions.requirePrimaryMuscle && metadata.primary_muscles.length === 0) {
      issues.push({
        code: 'missing_primary_muscle',
        message: `Metadata has no primary muscle: ${metadata.exerciseName}`,
        exerciseName: metadata.exerciseName,
      });
    }

    if (auditOptions.requireEquipment && metadata.equipment.length === 0) {
      issues.push({
        code: 'missing_equipment',
        message: `Metadata has no equipment: ${metadata.exerciseName}`,
        exerciseName: metadata.exerciseName,
      });
    }

    if (auditOptions.requireSourceId && !metadata.source_id) {
      issues.push({
        code: 'missing_source_id',
        message: `Metadata has no source_id: ${metadata.exerciseName}`,
        exerciseName: metadata.exerciseName,
        source: metadata.source,
      });
    }

    if (metadata.source_id) {
      const sourceKey = `${metadata.source}:${metadata.source_id}`;
      if (sourceKeys.has(sourceKey)) {
        issues.push({
          code: 'duplicate_source_id',
          message: `Duplicate metadata source_id: ${sourceKey}`,
          exerciseName: metadata.exerciseName,
          source: metadata.source,
          sourceId: metadata.source_id,
        });
      }
      sourceKeys.add(sourceKey);
    }
  });

  auditOptions.requiredMovementPatterns.forEach((pattern) => {
    if (!movementPatterns.has(pattern)) {
      issues.push({
        code: 'missing_required_movement_pattern',
        message: `Missing required movement pattern: ${pattern}`,
        value: pattern,
      });
    }
  });

  auditOptions.requiredForceTypes.forEach((forceType) => {
    if (!forceTypes.has(forceType)) {
      issues.push({
        code: 'missing_required_force_type',
        message: `Missing required force type: ${forceType}`,
        value: forceType,
      });
    }
  });

  return {
    ok: issues.length === 0,
    issues,
    counts: {
      exercises: exercises.length,
      metadata: metadataEntries.length,
      movementPatterns: movementPatterns.size,
      forceTypes: forceTypes.size,
      sources: sources.size,
    },
  };
}

export function summarizeExerciseMetadataCoverage(
  exercises: readonly ExerciseMetadataFixtureExercise[],
  metadataEntries: readonly unknown[],
): ExerciseMetadataCoverageSummary {
  const annotatedNames = new Set<string>();

  metadataEntries.forEach((entry) => {
    const exerciseName = readStringField(entry, 'exerciseName');
    if (exerciseName) {
      annotatedNames.add(normalizeName(exerciseName));
    }
  });

  const unannotated = exercises
    .filter((exercise) => !annotatedNames.has(normalizeName(exercise.name)))
    .map((exercise) => ({
      name: exercise.name,
      category: exercise.category,
      primary_muscle: exercise.primary_muscle,
    }));

  const annotatedExercises = exercises.length - unannotated.length;

  return {
    totalExercises: exercises.length,
    annotatedExercises,
    unannotatedExercises: unannotated.length,
    coverageRatio: exercises.length === 0 ? 0 : annotatedExercises / exercises.length,
    unannotated,
  };
}

function readStringField(value: unknown, field: string): string | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const fieldValue = (value as Record<string, unknown>)[field];
  return typeof fieldValue === 'string' ? fieldValue : undefined;
}
