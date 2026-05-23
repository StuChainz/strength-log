import { type SQLiteDatabase } from 'expo-sqlite';
import { newId, normalizeName } from '@/domain/ids';
import { type ExerciseCategory, type Unit } from '@/domain/types';

interface SeedExercise {
  name: string;
  category: ExerciseCategory;
  primary_muscle: string | null;
  default_unit: Unit | null;
  aliases: string[];
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

/**
 * Seed the exercises table. Idempotent: skips entirely if any seed exercises
 * already exist (is_custom = 0). Safe to call on every app launch.
 */
export async function seedExercises(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM exercises WHERE is_custom = 0',
  );
  if (row && row.count > 0) return; // already seeded

  const now = Date.now();

  await db.withTransactionAsync(async () => {
    for (const seed of SEED_EXERCISES) {
      const exerciseId = newId();
      const normalised = normalizeName(seed.name);

      await db.runAsync(
        `INSERT INTO exercises
           (id, name, normalized_name, category, primary_muscle, default_unit,
            is_custom, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        [
          exerciseId,
          seed.name,
          normalised,
          seed.category,
          seed.primary_muscle,
          seed.default_unit,
          now,
          now,
        ],
      );

      for (const alias of seed.aliases) {
        await db.runAsync(
          `INSERT INTO exercise_aliases
             (id, exercise_id, alias, source, created_at)
           VALUES (?, ?, ?, 'seed', ?)`,
          [newId(), exerciseId, normalizeName(alias), now],
        );
      }
    }
  });
}
