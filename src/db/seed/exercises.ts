import { type SQLiteDatabase } from 'expo-sqlite';
import { serializeExerciseMetadataInput } from '@/domain/exerciseMetadataInput';
import { newId, normalizeName } from '@/domain/ids';
import {
  type BodyRegion,
  type Equipment,
  type ExerciseCategory,
  type ForceType,
  type Laterality,
  type Mechanics,
  type MovementPattern,
  type MuscleGroup,
  type Unit,
} from '@/domain/types';

interface SeedExercise {
  name: string;
  category: ExerciseCategory;
  primary_muscle: string | null;
  default_unit: Unit | null;
  aliases: string[];
}

interface SeedExerciseMetadata {
  exerciseName: string;
  movement_pattern: MovementPattern;
  force_type: ForceType;
  body_region: BodyRegion;
  primary_muscles: MuscleGroup[];
  secondary_muscles: MuscleGroup[];
  equipment: Equipment[];
  mechanics: Mechanics;
  laterality: Laterality;
  difficulty: number;
  substitution_group: string;
  source_id: string;
}

// 35 seed exercises: 10 barbell, 9 dumbbell, 8 bodyweight, 5 machine, 3 cable.
// Aliases are stored normalised (see normalizeName). They must be globally unique.
export const SEED_EXERCISES: SeedExercise[] = [
  // ── Barbell ──────────────────────────────────────────────────────────────
  {
    name: 'Barbell Back Squat',
    category: 'barbell',
    primary_muscle: 'quadriceps',
    default_unit: 'kg',
    aliases: ['squat', 'back squat', 'barbell squat'],
  },
  {
    name: 'Barbell Front Squat',
    category: 'barbell',
    primary_muscle: 'quadriceps',
    default_unit: 'kg',
    aliases: ['front squat'],
  },
  {
    name: 'Barbell Deadlift',
    category: 'barbell',
    primary_muscle: 'hamstrings',
    default_unit: 'kg',
    aliases: ['deadlift', 'dl'],
  },
  {
    name: 'Romanian Deadlift',
    category: 'barbell',
    primary_muscle: 'hamstrings',
    default_unit: 'kg',
    aliases: ['rdl', 'romanian deadlift'],
  },
  {
    name: 'Barbell Bench Press',
    category: 'barbell',
    primary_muscle: 'chest',
    default_unit: 'kg',
    aliases: ['bench', 'bench press', 'flat bench'],
  },
  {
    name: 'Incline Barbell Bench Press',
    category: 'barbell',
    primary_muscle: 'chest',
    default_unit: 'kg',
    aliases: ['incline bench', 'incline press'],
  },
  {
    name: 'Overhead Press',
    category: 'barbell',
    primary_muscle: 'shoulders',
    default_unit: 'kg',
    aliases: ['ohp', 'military press', 'press'],
  },
  {
    name: 'Barbell Row',
    category: 'barbell',
    primary_muscle: 'back',
    default_unit: 'kg',
    aliases: ['bent over row', 'barbell bent over row'],
  },
  {
    name: 'Barbell Hip Thrust',
    category: 'barbell',
    primary_muscle: 'glutes',
    default_unit: 'kg',
    aliases: ['hip thrust', 'barbell hip thrust'],
  },
  {
    name: 'Good Morning',
    category: 'barbell',
    primary_muscle: 'hamstrings',
    default_unit: 'kg',
    aliases: ['good morning'],
  },

  // ── Dumbbell ──────────────────────────────────────────────────────────────
  {
    name: 'Dumbbell Bench Press',
    category: 'dumbbell',
    primary_muscle: 'chest',
    default_unit: 'kg',
    aliases: ['db bench', 'dumbbell bench'],
  },
  {
    name: 'Dumbbell Shoulder Press',
    category: 'dumbbell',
    primary_muscle: 'shoulders',
    default_unit: 'kg',
    aliases: ['db shoulder press', 'db press', 'dumbbell press'],
  },
  {
    name: 'Single-Arm Dumbbell Row',
    category: 'dumbbell',
    primary_muscle: 'back',
    default_unit: 'kg',
    aliases: ['db row', 'single arm row', 'dumbbell row'],
  },
  {
    name: 'Dumbbell Bicep Curl',
    category: 'dumbbell',
    primary_muscle: 'biceps',
    default_unit: 'kg',
    aliases: ['curl', 'db curl', 'bicep curl', 'dumbbell curl'],
  },
  {
    name: 'Dumbbell Lateral Raise',
    category: 'dumbbell',
    primary_muscle: 'shoulders',
    default_unit: 'kg',
    aliases: ['lateral raise', 'laterals', 'db lateral raise'],
  },
  {
    name: 'Dumbbell Romanian Deadlift',
    category: 'dumbbell',
    primary_muscle: 'hamstrings',
    default_unit: 'kg',
    aliases: ['db rdl', 'dumbbell rdl'],
  },
  {
    name: 'Dumbbell Lunge',
    category: 'dumbbell',
    primary_muscle: 'quadriceps',
    default_unit: 'kg',
    aliases: ['db lunge', 'dumbbell lunge'],
  },
  {
    name: 'Dumbbell Fly',
    category: 'dumbbell',
    primary_muscle: 'chest',
    default_unit: 'kg',
    aliases: ['db fly', 'dumbbell fly'],
  },
  {
    name: 'Dumbbell Tricep Extension',
    category: 'dumbbell',
    primary_muscle: 'triceps',
    default_unit: 'kg',
    aliases: ['tricep extension', 'db tricep extension', 'overhead tricep extension'],
  },

  // ── Bodyweight ────────────────────────────────────────────────────────────
  {
    name: 'Pull Up',
    category: 'bodyweight',
    primary_muscle: 'back',
    default_unit: null,
    aliases: ['pull up', 'pullup'],
  },
  {
    name: 'Chin Up',
    category: 'bodyweight',
    primary_muscle: 'biceps',
    default_unit: null,
    aliases: ['chin up', 'chinup'],
  },
  {
    name: 'Push Up',
    category: 'bodyweight',
    primary_muscle: 'chest',
    default_unit: null,
    aliases: ['push up', 'pushup'],
  },
  {
    name: 'Dip',
    category: 'bodyweight',
    primary_muscle: 'triceps',
    default_unit: null,
    aliases: ['dip', 'dips'],
  },
  {
    name: 'Plank',
    category: 'bodyweight',
    primary_muscle: 'core',
    default_unit: null,
    aliases: ['plank'],
  },
  {
    name: 'Bodyweight Squat',
    category: 'bodyweight',
    primary_muscle: 'quadriceps',
    default_unit: null,
    aliases: ['air squat', 'bw squat'],
  },
  {
    name: 'Glute Bridge',
    category: 'bodyweight',
    primary_muscle: 'glutes',
    default_unit: null,
    aliases: ['glute bridge'],
  },
  {
    name: 'Hanging Leg Raise',
    category: 'bodyweight',
    primary_muscle: 'core',
    default_unit: null,
    aliases: ['leg raise', 'hanging leg raise'],
  },

  // ── Machine ───────────────────────────────────────────────────────────────
  {
    name: 'Leg Press',
    category: 'machine',
    primary_muscle: 'quadriceps',
    default_unit: 'kg',
    aliases: ['leg press'],
  },
  {
    name: 'Leg Curl',
    category: 'machine',
    primary_muscle: 'hamstrings',
    default_unit: 'kg',
    aliases: ['leg curl', 'hamstring curl'],
  },
  {
    name: 'Leg Extension',
    category: 'machine',
    primary_muscle: 'quadriceps',
    default_unit: 'kg',
    aliases: ['leg extension', 'quad extension'],
  },
  {
    name: 'Lat Pulldown',
    category: 'machine',
    primary_muscle: 'back',
    default_unit: 'kg',
    aliases: ['lat pulldown', 'pulldown'],
  },
  {
    name: 'Seated Row Machine',
    category: 'machine',
    primary_muscle: 'back',
    default_unit: 'kg',
    aliases: ['seated row', 'seated cable row', 'cable row'],
  },

  // ── Cable ─────────────────────────────────────────────────────────────────
  {
    name: 'Cable Tricep Pushdown',
    category: 'cable',
    primary_muscle: 'triceps',
    default_unit: 'kg',
    aliases: ['tricep pushdown', 'cable pushdown', 'pushdown'],
  },
  {
    name: 'Cable Lateral Raise',
    category: 'cable',
    primary_muscle: 'shoulders',
    default_unit: 'kg',
    aliases: ['cable lateral', 'cable lateral raise'],
  },
  {
    name: 'Cable Fly',
    category: 'cable',
    primary_muscle: 'chest',
    default_unit: 'kg',
    aliases: ['cable fly', 'cable crossover'],
  },
];

export const SEED_EXERCISE_METADATA: SeedExerciseMetadata[] = [
  {
    exerciseName: 'Barbell Back Squat',
    movement_pattern: 'squat',
    force_type: 'legs',
    body_region: 'lower_body',
    primary_muscles: ['quadriceps', 'glutes'],
    secondary_muscles: ['hamstrings', 'core'],
    equipment: ['barbell'],
    mechanics: 'compound',
    laterality: 'bilateral',
    difficulty: 3,
    substitution_group: 'squat_barbell',
    source_id: 'curated_seed:barbell_back_squat',
  },
  {
    exerciseName: 'Barbell Front Squat',
    movement_pattern: 'squat',
    force_type: 'legs',
    body_region: 'lower_body',
    primary_muscles: ['quadriceps'],
    secondary_muscles: ['glutes', 'core'],
    equipment: ['barbell'],
    mechanics: 'compound',
    laterality: 'bilateral',
    difficulty: 4,
    substitution_group: 'squat_barbell',
    source_id: 'curated_seed:barbell_front_squat',
  },
  {
    exerciseName: 'Barbell Deadlift',
    movement_pattern: 'hinge',
    force_type: 'hinge',
    body_region: 'full_body',
    primary_muscles: ['hamstrings', 'glutes'],
    secondary_muscles: ['back', 'core'],
    equipment: ['barbell'],
    mechanics: 'compound',
    laterality: 'bilateral',
    difficulty: 4,
    substitution_group: 'deadlift',
    source_id: 'curated_seed:barbell_deadlift',
  },
  {
    exerciseName: 'Romanian Deadlift',
    movement_pattern: 'hinge',
    force_type: 'hinge',
    body_region: 'lower_body',
    primary_muscles: ['hamstrings', 'glutes'],
    secondary_muscles: ['back', 'core'],
    equipment: ['barbell'],
    mechanics: 'compound',
    laterality: 'bilateral',
    difficulty: 3,
    substitution_group: 'romanian_deadlift',
    source_id: 'curated_seed:romanian_deadlift',
  },
  {
    exerciseName: 'Barbell Bench Press',
    movement_pattern: 'horizontal_push',
    force_type: 'push',
    body_region: 'upper_body',
    primary_muscles: ['chest'],
    secondary_muscles: ['triceps', 'shoulders'],
    equipment: ['barbell', 'bench'],
    mechanics: 'compound',
    laterality: 'bilateral',
    difficulty: 3,
    substitution_group: 'horizontal_press',
    source_id: 'curated_seed:barbell_bench_press',
  },
  {
    exerciseName: 'Incline Barbell Bench Press',
    movement_pattern: 'horizontal_push',
    force_type: 'push',
    body_region: 'upper_body',
    primary_muscles: ['chest'],
    secondary_muscles: ['shoulders', 'triceps'],
    equipment: ['barbell', 'bench'],
    mechanics: 'compound',
    laterality: 'bilateral',
    difficulty: 3,
    substitution_group: 'incline_press',
    source_id: 'curated_seed:incline_barbell_bench_press',
  },
  {
    exerciseName: 'Overhead Press',
    movement_pattern: 'vertical_push',
    force_type: 'push',
    body_region: 'upper_body',
    primary_muscles: ['shoulders'],
    secondary_muscles: ['triceps', 'core'],
    equipment: ['barbell'],
    mechanics: 'compound',
    laterality: 'bilateral',
    difficulty: 3,
    substitution_group: 'vertical_press',
    source_id: 'curated_seed:overhead_press',
  },
  {
    exerciseName: 'Barbell Row',
    movement_pattern: 'horizontal_pull',
    force_type: 'pull',
    body_region: 'upper_body',
    primary_muscles: ['back'],
    secondary_muscles: ['biceps', 'hamstrings'],
    equipment: ['barbell'],
    mechanics: 'compound',
    laterality: 'bilateral',
    difficulty: 3,
    substitution_group: 'horizontal_row',
    source_id: 'curated_seed:barbell_row',
  },
  {
    exerciseName: 'Barbell Hip Thrust',
    movement_pattern: 'hip_extension',
    force_type: 'hinge',
    body_region: 'lower_body',
    primary_muscles: ['glutes'],
    secondary_muscles: ['hamstrings', 'core'],
    equipment: ['barbell', 'bench'],
    mechanics: 'compound',
    laterality: 'bilateral',
    difficulty: 2,
    substitution_group: 'hip_extension',
    source_id: 'curated_seed:barbell_hip_thrust',
  },
  {
    exerciseName: 'Dumbbell Bench Press',
    movement_pattern: 'horizontal_push',
    force_type: 'push',
    body_region: 'upper_body',
    primary_muscles: ['chest'],
    secondary_muscles: ['triceps', 'shoulders'],
    equipment: ['dumbbell', 'bench'],
    mechanics: 'compound',
    laterality: 'bilateral',
    difficulty: 2,
    substitution_group: 'horizontal_press',
    source_id: 'curated_seed:dumbbell_bench_press',
  },
  {
    exerciseName: 'Dumbbell Shoulder Press',
    movement_pattern: 'vertical_push',
    force_type: 'push',
    body_region: 'upper_body',
    primary_muscles: ['shoulders'],
    secondary_muscles: ['triceps'],
    equipment: ['dumbbell'],
    mechanics: 'compound',
    laterality: 'bilateral',
    difficulty: 2,
    substitution_group: 'vertical_press',
    source_id: 'curated_seed:dumbbell_shoulder_press',
  },
  {
    exerciseName: 'Single-Arm Dumbbell Row',
    movement_pattern: 'horizontal_pull',
    force_type: 'pull',
    body_region: 'upper_body',
    primary_muscles: ['back'],
    secondary_muscles: ['biceps', 'core'],
    equipment: ['dumbbell', 'bench'],
    mechanics: 'compound',
    laterality: 'single_side',
    difficulty: 2,
    substitution_group: 'horizontal_row',
    source_id: 'curated_seed:single_arm_dumbbell_row',
  },
  {
    exerciseName: 'Dumbbell Bicep Curl',
    movement_pattern: 'elbow_flexion',
    force_type: 'pull',
    body_region: 'upper_body',
    primary_muscles: ['biceps'],
    secondary_muscles: ['forearms'],
    equipment: ['dumbbell'],
    mechanics: 'isolation',
    laterality: 'bilateral',
    difficulty: 1,
    substitution_group: 'elbow_flexion',
    source_id: 'curated_seed:dumbbell_bicep_curl',
  },
  {
    exerciseName: 'Dumbbell Lateral Raise',
    movement_pattern: 'shoulder_abduction',
    force_type: 'push',
    body_region: 'upper_body',
    primary_muscles: ['shoulders'],
    secondary_muscles: [],
    equipment: ['dumbbell'],
    mechanics: 'isolation',
    laterality: 'bilateral',
    difficulty: 1,
    substitution_group: 'shoulder_abduction',
    source_id: 'curated_seed:dumbbell_lateral_raise',
  },
  {
    exerciseName: 'Dumbbell Lunge',
    movement_pattern: 'lunge',
    force_type: 'legs',
    body_region: 'lower_body',
    primary_muscles: ['quadriceps', 'glutes'],
    secondary_muscles: ['hamstrings', 'core'],
    equipment: ['dumbbell'],
    mechanics: 'compound',
    laterality: 'alternating',
    difficulty: 2,
    substitution_group: 'lunge',
    source_id: 'curated_seed:dumbbell_lunge',
  },
  {
    exerciseName: 'Dumbbell Tricep Extension',
    movement_pattern: 'elbow_extension',
    force_type: 'push',
    body_region: 'upper_body',
    primary_muscles: ['triceps'],
    secondary_muscles: [],
    equipment: ['dumbbell'],
    mechanics: 'isolation',
    laterality: 'bilateral',
    difficulty: 1,
    substitution_group: 'elbow_extension',
    source_id: 'curated_seed:dumbbell_tricep_extension',
  },
  {
    exerciseName: 'Pull Up',
    movement_pattern: 'vertical_pull',
    force_type: 'pull',
    body_region: 'upper_body',
    primary_muscles: ['back'],
    secondary_muscles: ['biceps', 'core'],
    equipment: ['bodyweight', 'pull_up_bar'],
    mechanics: 'compound',
    laterality: 'bilateral',
    difficulty: 3,
    substitution_group: 'vertical_pull',
    source_id: 'curated_seed:pull_up',
  },
  {
    exerciseName: 'Push Up',
    movement_pattern: 'horizontal_push',
    force_type: 'push',
    body_region: 'upper_body',
    primary_muscles: ['chest'],
    secondary_muscles: ['triceps', 'shoulders', 'core'],
    equipment: ['bodyweight'],
    mechanics: 'compound',
    laterality: 'bilateral',
    difficulty: 1,
    substitution_group: 'horizontal_press',
    source_id: 'curated_seed:push_up',
  },
  {
    exerciseName: 'Plank',
    movement_pattern: 'core',
    force_type: 'core',
    body_region: 'core',
    primary_muscles: ['core'],
    secondary_muscles: ['shoulders', 'glutes'],
    equipment: ['bodyweight'],
    mechanics: 'isolation',
    laterality: 'bilateral',
    difficulty: 1,
    substitution_group: 'core_anti_extension',
    source_id: 'curated_seed:plank',
  },
  {
    exerciseName: 'Lat Pulldown',
    movement_pattern: 'vertical_pull',
    force_type: 'pull',
    body_region: 'upper_body',
    primary_muscles: ['back'],
    secondary_muscles: ['biceps'],
    equipment: ['machine'],
    mechanics: 'compound',
    laterality: 'bilateral',
    difficulty: 1,
    substitution_group: 'vertical_pull',
    source_id: 'curated_seed:lat_pulldown',
  },
];

/**
 * Seed the exercises table. Idempotent and repair-friendly: missing curated
 * rows/aliases are added without duplicating existing seed exercises.
 */
export async function seedExercises(db: SQLiteDatabase): Promise<void> {
  const now = Date.now();

  await db.withTransactionAsync(async () => {
    for (const seed of SEED_EXERCISES) {
      const normalised = normalizeName(seed.name);
      let exercise = await db.getFirstAsync<{ id: string }>(
        'SELECT id FROM exercises WHERE normalized_name = ? AND is_custom = 0',
        [normalised],
      );

      if (!exercise) {
        exercise = { id: newId() };
        await db.runAsync(
          `INSERT INTO exercises
             (id, name, normalized_name, category, primary_muscle, default_unit,
              is_custom, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
          [
            exercise.id,
            seed.name,
            normalised,
            seed.category,
            seed.primary_muscle,
            seed.default_unit,
            now,
            now,
          ],
        );
      }

      for (const alias of seed.aliases) {
        await db.runAsync(
          `INSERT OR IGNORE INTO exercise_aliases
             (id, exercise_id, alias, source, created_at)
           VALUES (?, ?, ?, 'seed', ?)`,
          [newId(), exercise.id, normalizeName(alias), now],
        );
      }
    }
  });

  await seedExerciseMetadata(db);
}

async function seedExerciseMetadata(db: SQLiteDatabase): Promise<void> {
  const now = Date.now();

  await db.withTransactionAsync(async () => {
    for (const seed of SEED_EXERCISE_METADATA) {
      const { exerciseName, ...metadataInput } = seed;
      const metadata = serializeExerciseMetadataInput({
        ...metadataInput,
        source: 'curated_seed',
      });
      const exercise = await db.getFirstAsync<{ id: string }>(
        'SELECT id FROM exercises WHERE normalized_name = ? AND is_custom = 0',
        [normalizeName(exerciseName)],
      );
      if (!exercise) continue;

      await db.runAsync(
        `INSERT INTO exercise_metadata
           (exercise_id, movement_pattern, force_type, body_region,
            primary_muscles_json, secondary_muscles_json, equipment_json,
            mechanics, laterality, difficulty, substitution_group, source,
            source_id, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(exercise_id) DO UPDATE SET
           movement_pattern = excluded.movement_pattern,
           force_type = excluded.force_type,
           body_region = excluded.body_region,
           primary_muscles_json = excluded.primary_muscles_json,
           secondary_muscles_json = excluded.secondary_muscles_json,
           equipment_json = excluded.equipment_json,
           mechanics = excluded.mechanics,
           laterality = excluded.laterality,
           difficulty = excluded.difficulty,
           substitution_group = excluded.substitution_group,
           source = excluded.source,
           source_id = excluded.source_id,
           updated_at = excluded.updated_at
         WHERE exercise_metadata.source = excluded.source
           AND (
             exercise_metadata.movement_pattern IS NOT excluded.movement_pattern OR
             exercise_metadata.force_type IS NOT excluded.force_type OR
             exercise_metadata.body_region IS NOT excluded.body_region OR
             exercise_metadata.primary_muscles_json IS NOT excluded.primary_muscles_json OR
             exercise_metadata.secondary_muscles_json IS NOT excluded.secondary_muscles_json OR
             exercise_metadata.equipment_json IS NOT excluded.equipment_json OR
             exercise_metadata.mechanics IS NOT excluded.mechanics OR
             exercise_metadata.laterality IS NOT excluded.laterality OR
             exercise_metadata.difficulty IS NOT excluded.difficulty OR
             exercise_metadata.substitution_group IS NOT excluded.substitution_group OR
             exercise_metadata.source IS NOT excluded.source OR
             exercise_metadata.source_id IS NOT excluded.source_id
           )`,
        [
          exercise.id,
          metadata.movement_pattern,
          metadata.force_type,
          metadata.body_region,
          metadata.primary_muscles_json,
          metadata.secondary_muscles_json,
          metadata.equipment_json,
          metadata.mechanics,
          metadata.laterality,
          metadata.difficulty,
          metadata.substitution_group,
          metadata.source,
          metadata.source_id,
          now,
        ],
      );
    }
  });
}
