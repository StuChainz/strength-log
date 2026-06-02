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

interface CuratedSeedExercise extends Omit<SeedExercise, 'default_unit'> {
  default_unit?: Unit | null;
  movement_pattern: MovementPattern;
  force_type: ForceType;
  body_region: BodyRegion;
  primary_muscles: MuscleGroup[];
  secondary_muscles: MuscleGroup[];
  equipment?: Equipment[];
  mechanics: Mechanics;
  laterality: Laterality;
  difficulty: number;
  substitution_group: string;
}

const CURATED_SEED_EXERCISES: CuratedSeedExercise[] = [
  // Barbell
  e('Barbell Back Squat', 'barbell', 'quads', ['squat', 'back squat', 'barbell squat'], 'squat', 'legs', 'lower_body', ['quads', 'glutes'], ['hamstrings', 'abs'], ['barbell'], 'compound', 'bilateral', 3, 'squat_barbell'),
  e('Barbell Front Squat', 'barbell', 'quads', ['front squat'], 'squat', 'legs', 'lower_body', ['quads'], ['glutes', 'abs'], ['barbell'], 'compound', 'bilateral', 4, 'squat_barbell'),
  e('Barbell Pause Squat', 'barbell', 'quads', ['pause squat'], 'squat', 'legs', 'lower_body', ['quads', 'glutes'], ['hamstrings', 'abs'], ['barbell'], 'compound', 'bilateral', 4, 'squat_barbell'),
  e('Barbell Box Squat', 'barbell', 'quads', ['box squat'], 'squat', 'legs', 'lower_body', ['quads', 'glutes'], ['hamstrings', 'abs'], ['barbell'], 'compound', 'bilateral', 3, 'squat_barbell'),
  e('Zercher Squat', 'barbell', 'quads', ['zercher'], 'squat', 'legs', 'lower_body', ['quads', 'glutes'], ['hamstrings', 'abs', 'upper_back'], ['barbell'], 'compound', 'bilateral', 4, 'squat_barbell'),
  e('Barbell Deadlift', 'barbell', 'hamstrings', ['deadlift', 'dl'], 'hinge', 'hinge', 'full_body', ['hamstrings', 'glutes'], ['spinal_erectors', 'abs', 'forearms'], ['barbell'], 'compound', 'bilateral', 4, 'deadlift'),
  e('Sumo Deadlift', 'barbell', 'glutes', ['sumo dl'], 'hinge', 'hinge', 'full_body', ['glutes', 'hamstrings'], ['quads', 'spinal_erectors', 'abs'], ['barbell'], 'compound', 'bilateral', 4, 'deadlift'),
  e('Deficit Deadlift', 'barbell', 'hamstrings', ['deficit dl'], 'hinge', 'hinge', 'full_body', ['hamstrings', 'glutes'], ['spinal_erectors', 'quads', 'abs'], ['barbell'], 'compound', 'bilateral', 5, 'deadlift'),
  e('Rack Pull', 'barbell', 'spinal_erectors', ['rack deadlift'], 'hinge', 'hinge', 'full_body', ['spinal_erectors', 'glutes'], ['hamstrings', 'forearms', 'traps'], ['barbell'], 'compound', 'bilateral', 3, 'deadlift'),
  e('Romanian Deadlift', 'barbell', 'hamstrings', ['rdl', 'romanian deadlift'], 'hinge', 'hinge', 'lower_body', ['hamstrings', 'glutes'], ['spinal_erectors', 'abs'], ['barbell'], 'compound', 'bilateral', 3, 'romanian_deadlift'),
  e('Stiff-Leg Deadlift', 'barbell', 'hamstrings', ['sldl'], 'hinge', 'hinge', 'lower_body', ['hamstrings'], ['glutes', 'spinal_erectors'], ['barbell'], 'compound', 'bilateral', 3, 'romanian_deadlift'),
  e('Good Morning', 'barbell', 'hamstrings', ['good morning'], 'hinge', 'hinge', 'lower_body', ['hamstrings', 'glutes'], ['spinal_erectors', 'abs'], ['barbell'], 'compound', 'bilateral', 3, 'good_morning'),
  e('Barbell Hip Thrust', 'barbell', 'glutes', ['hip thrust', 'barbell hip thrust'], 'hip_extension', 'hinge', 'lower_body', ['glutes'], ['hamstrings', 'abs'], ['barbell', 'bench'], 'compound', 'bilateral', 2, 'hip_extension'),
  e('Barbell Glute Bridge', 'barbell', 'glutes', ['weighted glute bridge'], 'hip_extension', 'hinge', 'lower_body', ['glutes'], ['hamstrings', 'abs'], ['barbell'], 'compound', 'bilateral', 2, 'hip_extension'),
  e('Barbell Bench Press', 'barbell', 'chest', ['bench', 'bench press', 'flat bench'], 'horizontal_push', 'push', 'upper_body', ['chest'], ['triceps', 'front_delts'], ['barbell', 'bench'], 'compound', 'bilateral', 3, 'horizontal_press'),
  e('Paused Bench Press', 'barbell', 'chest', ['paused bench'], 'horizontal_push', 'push', 'upper_body', ['chest'], ['triceps', 'front_delts'], ['barbell', 'bench'], 'compound', 'bilateral', 3, 'horizontal_press'),
  e('Close-Grip Bench Press', 'barbell', 'triceps', ['cgbp', 'close grip bench'], 'horizontal_push', 'push', 'upper_body', ['triceps', 'chest'], ['front_delts'], ['barbell', 'bench'], 'compound', 'bilateral', 3, 'horizontal_press'),
  e('Incline Barbell Bench Press', 'barbell', 'chest', ['incline bench', 'incline press'], 'horizontal_push', 'push', 'upper_body', ['chest'], ['front_delts', 'triceps'], ['barbell', 'bench'], 'compound', 'bilateral', 3, 'incline_press'),
  e('Decline Barbell Bench Press', 'barbell', 'chest', ['decline bench'], 'horizontal_push', 'push', 'upper_body', ['chest'], ['triceps', 'front_delts'], ['barbell', 'bench'], 'compound', 'bilateral', 3, 'horizontal_press'),
  e('Overhead Press', 'barbell', 'front_delts', ['ohp', 'military press', 'press'], 'vertical_push', 'push', 'upper_body', ['front_delts'], ['triceps', 'abs'], ['barbell'], 'compound', 'bilateral', 3, 'vertical_press'),
  e('Push Press', 'barbell', 'front_delts', ['barbell push press'], 'vertical_push', 'push', 'full_body', ['front_delts'], ['triceps', 'quads', 'abs'], ['barbell'], 'compound', 'bilateral', 4, 'vertical_press'),
  e('Barbell Row', 'barbell', 'upper_back', ['bent over row', 'barbell bent over row'], 'horizontal_pull', 'pull', 'upper_body', ['upper_back'], ['biceps', 'hamstrings', 'abs'], ['barbell'], 'compound', 'bilateral', 3, 'horizontal_row'),
  e('Pendlay Row', 'barbell', 'upper_back', ['pendlay'], 'horizontal_pull', 'pull', 'upper_body', ['upper_back'], ['biceps', 'hamstrings'], ['barbell'], 'compound', 'bilateral', 3, 'horizontal_row'),
  e('Barbell Upright Row', 'barbell', 'side_delts', ['upright row barbell'], 'shoulder_abduction', 'pull', 'upper_body', ['side_delts'], ['traps', 'biceps'], ['barbell'], 'compound', 'bilateral', 2, 'shoulder_abduction'),
  e('Barbell Curl', 'barbell', 'biceps', ['bb curl'], 'elbow_flexion', 'pull', 'upper_body', ['biceps'], ['forearms'], ['barbell'], 'isolation', 'bilateral', 1, 'elbow_flexion'),
  e('EZ-Bar Curl', 'barbell', 'biceps', ['ez curl'], 'elbow_flexion', 'pull', 'upper_body', ['biceps'], ['forearms'], ['barbell'], 'isolation', 'bilateral', 1, 'elbow_flexion'),
  e('Skull Crusher', 'barbell', 'triceps', ['lying tricep extension'], 'elbow_extension', 'push', 'upper_body', ['triceps'], [], ['barbell', 'bench'], 'isolation', 'bilateral', 2, 'elbow_extension'),
  e('Barbell Calf Raise', 'barbell', 'calves', ['standing barbell calf raise'], 'other', 'legs', 'lower_body', ['calves'], [], ['barbell'], 'isolation', 'bilateral', 2, 'calf_raise'),

  // Dumbbell
  e('Dumbbell Bench Press', 'dumbbell', 'chest', ['db bench', 'dumbbell bench'], 'horizontal_push', 'push', 'upper_body', ['chest'], ['triceps', 'front_delts'], ['dumbbell', 'bench'], 'compound', 'bilateral', 2, 'horizontal_press'),
  e('Incline Dumbbell Bench Press', 'dumbbell', 'chest', ['incline db bench', 'incline dumbbell press'], 'horizontal_push', 'push', 'upper_body', ['chest'], ['front_delts', 'triceps'], ['dumbbell', 'bench'], 'compound', 'bilateral', 2, 'incline_press'),
  e('Decline Dumbbell Bench Press', 'dumbbell', 'chest', ['decline db bench'], 'horizontal_push', 'push', 'upper_body', ['chest'], ['triceps', 'front_delts'], ['dumbbell', 'bench'], 'compound', 'bilateral', 2, 'horizontal_press'),
  e('Dumbbell Floor Press', 'dumbbell', 'chest', ['db floor press'], 'horizontal_push', 'push', 'upper_body', ['chest', 'triceps'], ['front_delts'], ['dumbbell'], 'compound', 'bilateral', 2, 'horizontal_press'),
  e('Dumbbell Shoulder Press', 'dumbbell', 'front_delts', ['db shoulder press', 'db press', 'dumbbell press'], 'vertical_push', 'push', 'upper_body', ['front_delts'], ['triceps'], ['dumbbell'], 'compound', 'bilateral', 2, 'vertical_press'),
  e('Seated Dumbbell Shoulder Press', 'dumbbell', 'front_delts', ['seated db press'], 'vertical_push', 'push', 'upper_body', ['front_delts'], ['triceps'], ['dumbbell', 'bench'], 'compound', 'bilateral', 2, 'vertical_press'),
  e('Arnold Press', 'dumbbell', 'front_delts', ['arnold db press'], 'vertical_push', 'push', 'upper_body', ['front_delts'], ['triceps'], ['dumbbell'], 'compound', 'bilateral', 2, 'vertical_press'),
  e('Single-Arm Dumbbell Row', 'dumbbell', 'upper_back', ['db row', 'single arm row', 'dumbbell row'], 'horizontal_pull', 'pull', 'upper_body', ['upper_back'], ['biceps', 'abs'], ['dumbbell', 'bench'], 'compound', 'single_side', 2, 'horizontal_row'),
  e('Chest-Supported Dumbbell Row', 'dumbbell', 'upper_back', ['chest supported db row'], 'horizontal_pull', 'pull', 'upper_body', ['upper_back'], ['biceps'], ['dumbbell', 'bench'], 'compound', 'bilateral', 2, 'horizontal_row'),
  e('Renegade Row', 'dumbbell', 'upper_back', ['plank db row'], 'horizontal_pull', 'pull', 'full_body', ['upper_back', 'abs'], ['front_delts', 'triceps'], ['dumbbell'], 'compound', 'alternating', 3, 'horizontal_row'),
  e('Dumbbell Pullover', 'dumbbell', 'upper_back', ['db pullover'], 'vertical_pull', 'pull', 'upper_body', ['upper_back', 'chest'], ['triceps'], ['dumbbell', 'bench'], 'compound', 'bilateral', 2, 'pullover'),
  e('Dumbbell Fly', 'dumbbell', 'chest', ['db fly', 'dumbbell fly'], 'horizontal_push', 'push', 'upper_body', ['chest'], ['front_delts'], ['dumbbell', 'bench'], 'isolation', 'bilateral', 2, 'chest_fly'),
  e('Incline Dumbbell Fly', 'dumbbell', 'chest', ['incline db fly'], 'horizontal_push', 'push', 'upper_body', ['chest'], ['front_delts'], ['dumbbell', 'bench'], 'isolation', 'bilateral', 2, 'chest_fly'),
  e('Reverse Dumbbell Fly', 'dumbbell', 'rear_delts', ['reverse db fly'], 'horizontal_pull', 'pull', 'upper_body', ['rear_delts'], ['upper_back'], ['dumbbell', 'bench'], 'isolation', 'bilateral', 2, 'rear_delt_fly'),
  e('Dumbbell Lateral Raise', 'dumbbell', 'side_delts', ['lat raise', 'laterals', 'db lateral raise'], 'shoulder_abduction', 'push', 'upper_body', ['side_delts'], [], ['dumbbell'], 'isolation', 'bilateral', 1, 'shoulder_abduction'),
  e('Dumbbell Front Raise', 'dumbbell', 'front_delts', ['db front raise'], 'shoulder_abduction', 'push', 'upper_body', ['front_delts'], [], ['dumbbell'], 'isolation', 'bilateral', 1, 'shoulder_abduction'),
  e('Dumbbell Bicep Curl', 'dumbbell', 'biceps', ['db curl', 'bicep curl', 'dumbbell curl'], 'elbow_flexion', 'pull', 'upper_body', ['biceps'], ['forearms'], ['dumbbell'], 'isolation', 'bilateral', 1, 'elbow_flexion'),
  e('Hammer Curl', 'dumbbell', 'biceps', ['db hammer curl'], 'elbow_flexion', 'pull', 'upper_body', ['biceps', 'forearms'], [], ['dumbbell'], 'isolation', 'bilateral', 1, 'elbow_flexion'),
  e('Incline Dumbbell Curl', 'dumbbell', 'biceps', ['incline db curl'], 'elbow_flexion', 'pull', 'upper_body', ['biceps'], ['forearms'], ['dumbbell', 'bench'], 'isolation', 'bilateral', 2, 'elbow_flexion'),
  e('Concentration Curl', 'dumbbell', 'biceps', ['concentration db curl'], 'elbow_flexion', 'pull', 'upper_body', ['biceps'], ['forearms'], ['dumbbell'], 'isolation', 'single_side', 1, 'elbow_flexion'),
  e('Zottman Curl', 'dumbbell', 'biceps', ['zottman db curl'], 'elbow_flexion', 'pull', 'upper_body', ['biceps', 'forearms'], [], ['dumbbell'], 'isolation', 'bilateral', 2, 'elbow_flexion'),
  e('Dumbbell Tricep Extension', 'dumbbell', 'triceps', ['db tricep extension', 'dumbbell tricep extension'], 'elbow_extension', 'push', 'upper_body', ['triceps'], [], ['dumbbell'], 'isolation', 'bilateral', 1, 'elbow_extension'),
  e('Dumbbell Skull Crusher', 'dumbbell', 'triceps', ['db skull crusher'], 'elbow_extension', 'push', 'upper_body', ['triceps'], [], ['dumbbell', 'bench'], 'isolation', 'bilateral', 2, 'elbow_extension'),
  e('Dumbbell Tricep Kickback', 'dumbbell', 'triceps', ['db kickback'], 'elbow_extension', 'push', 'upper_body', ['triceps'], [], ['dumbbell'], 'isolation', 'single_side', 1, 'elbow_extension'),
  e('Dumbbell Romanian Deadlift', 'dumbbell', 'hamstrings', ['db rdl', 'dumbbell rdl'], 'hinge', 'hinge', 'lower_body', ['hamstrings', 'glutes'], ['spinal_erectors', 'abs'], ['dumbbell'], 'compound', 'bilateral', 2, 'romanian_deadlift'),
  e('Single-Leg Dumbbell Romanian Deadlift', 'dumbbell', 'hamstrings', ['single leg db rdl'], 'hinge', 'hinge', 'lower_body', ['hamstrings', 'glutes'], ['abs'], ['dumbbell'], 'compound', 'single_side', 3, 'single_leg_hinge'),
  e('Dumbbell Lunge', 'dumbbell', 'quads', ['db lunge', 'dumbbell lunge'], 'lunge', 'legs', 'lower_body', ['quads', 'glutes'], ['hamstrings', 'abs'], ['dumbbell'], 'compound', 'alternating', 2, 'lunge'),
  e('Dumbbell Reverse Lunge', 'dumbbell', 'quads', ['db reverse lunge'], 'lunge', 'legs', 'lower_body', ['quads', 'glutes'], ['hamstrings', 'abs'], ['dumbbell'], 'compound', 'alternating', 2, 'lunge'),
  e('Dumbbell Walking Lunge', 'dumbbell', 'quads', ['db walking lunge'], 'lunge', 'legs', 'lower_body', ['quads', 'glutes'], ['hamstrings', 'abs'], ['dumbbell'], 'compound', 'alternating', 2, 'lunge'),
  e('Dumbbell Bulgarian Split Squat', 'dumbbell', 'quads', ['db bulgarian split squat'], 'lunge', 'legs', 'lower_body', ['quads', 'glutes'], ['hamstrings', 'abs'], ['dumbbell', 'bench'], 'compound', 'single_side', 3, 'split_squat'),
  e('Dumbbell Split Squat', 'dumbbell', 'quads', ['db split squat'], 'lunge', 'legs', 'lower_body', ['quads', 'glutes'], ['hamstrings', 'abs'], ['dumbbell'], 'compound', 'single_side', 2, 'split_squat'),
  e('Dumbbell Step Up', 'dumbbell', 'quads', ['db step up'], 'lunge', 'legs', 'lower_body', ['quads', 'glutes'], ['hamstrings', 'abs'], ['dumbbell', 'bench'], 'compound', 'alternating', 2, 'step_up'),
  e('Goblet Squat', 'dumbbell', 'quads', ['db goblet squat'], 'squat', 'legs', 'lower_body', ['quads', 'glutes'], ['hamstrings', 'abs'], ['dumbbell'], 'compound', 'bilateral', 1, 'squat_dumbbell'),
  e('Dumbbell Sumo Squat', 'dumbbell', 'glutes', ['db sumo squat'], 'squat', 'legs', 'lower_body', ['glutes', 'quads'], ['hamstrings'], ['dumbbell'], 'compound', 'bilateral', 1, 'squat_dumbbell'),
  e('Dumbbell Hip Thrust', 'dumbbell', 'glutes', ['db hip thrust'], 'hip_extension', 'hinge', 'lower_body', ['glutes'], ['hamstrings', 'abs'], ['dumbbell', 'bench'], 'compound', 'bilateral', 1, 'hip_extension'),
  e('Dumbbell Calf Raise', 'dumbbell', 'calves', ['db calf raise'], 'other', 'legs', 'lower_body', ['calves'], [], ['dumbbell'], 'isolation', 'bilateral', 1, 'calf_raise'),
  e('Dumbbell Shrug', 'dumbbell', 'traps', ['db shrug'], 'other', 'pull', 'upper_body', ['traps'], ['forearms'], ['dumbbell'], 'isolation', 'bilateral', 1, 'shrug'),

  // Cable
  e('Cable Fly', 'cable', 'chest', ['standing cable fly'], 'horizontal_push', 'push', 'upper_body', ['chest'], ['front_delts'], ['cable'], 'isolation', 'bilateral', 1, 'chest_fly'),
  e('Low-to-High Cable Fly', 'cable', 'chest', ['low high cable fly'], 'horizontal_push', 'push', 'upper_body', ['chest'], ['front_delts'], ['cable'], 'isolation', 'bilateral', 2, 'chest_fly'),
  e('High-to-Low Cable Fly', 'cable', 'chest', ['high low cable fly'], 'horizontal_push', 'push', 'upper_body', ['chest'], ['front_delts'], ['cable'], 'isolation', 'bilateral', 2, 'chest_fly'),
  e('Cable Crossover', 'cable', 'chest', ['cable crossover'], 'horizontal_push', 'push', 'upper_body', ['chest'], ['front_delts'], ['cable'], 'isolation', 'bilateral', 1, 'chest_fly'),
  e('Seated Cable Row', 'cable', 'upper_back', ['cable row', 'low cable row'], 'horizontal_pull', 'pull', 'upper_body', ['upper_back'], ['biceps'], ['cable'], 'compound', 'bilateral', 1, 'horizontal_row'),
  e('Single-Arm Cable Row', 'cable', 'upper_back', ['one arm cable row'], 'horizontal_pull', 'pull', 'upper_body', ['upper_back'], ['biceps', 'abs'], ['cable'], 'compound', 'single_side', 2, 'horizontal_row'),
  e('Rope Cable Row', 'cable', 'upper_back', ['rope row'], 'horizontal_pull', 'pull', 'upper_body', ['upper_back'], ['biceps'], ['cable'], 'compound', 'bilateral', 1, 'horizontal_row'),
  e('Cable Lat Pulldown', 'cable', 'lats', ['cable pulldown'], 'vertical_pull', 'pull', 'upper_body', ['lats'], ['biceps', 'upper_back'], ['cable'], 'compound', 'bilateral', 1, 'vertical_pull'),
  e('Single-Arm Lat Pulldown', 'cable', 'lats', ['one arm pulldown'], 'vertical_pull', 'pull', 'upper_body', ['lats'], ['biceps', 'upper_back'], ['cable'], 'compound', 'single_side', 2, 'vertical_pull'),
  e('Straight-Arm Pulldown', 'cable', 'lats', ['straight arm pulldown'], 'vertical_pull', 'pull', 'upper_body', ['lats'], ['triceps'], ['cable'], 'isolation', 'bilateral', 1, 'vertical_pull'),
  e('Cable Face Pull', 'cable', 'rear_delts', ['face pull'], 'horizontal_pull', 'pull', 'upper_body', ['rear_delts', 'upper_back'], ['traps', 'biceps'], ['cable'], 'compound', 'bilateral', 1, 'rear_delt_fly'),
  e('Cable Rear Delt Fly', 'cable', 'rear_delts', ['rear delt cable fly'], 'horizontal_pull', 'pull', 'upper_body', ['rear_delts'], ['upper_back'], ['cable'], 'isolation', 'bilateral', 1, 'rear_delt_fly'),
  e('Cable Lateral Raise', 'cable', 'side_delts', ['cable lateral', 'cable lateral raise'], 'shoulder_abduction', 'push', 'upper_body', ['side_delts'], [], ['cable'], 'isolation', 'bilateral', 1, 'shoulder_abduction'),
  e('Single-Arm Cable Lateral Raise', 'cable', 'side_delts', ['one arm cable lateral raise'], 'shoulder_abduction', 'push', 'upper_body', ['side_delts'], [], ['cable'], 'isolation', 'single_side', 1, 'shoulder_abduction'),
  e('Cable Front Raise', 'cable', 'front_delts', ['front cable raise'], 'shoulder_abduction', 'push', 'upper_body', ['front_delts'], [], ['cable'], 'isolation', 'bilateral', 1, 'shoulder_abduction'),
  e('Cable Tricep Pushdown', 'cable', 'triceps', ['tricep pushdown', 'cable pushdown', 'pushdown'], 'elbow_extension', 'push', 'upper_body', ['triceps'], [], ['cable'], 'isolation', 'bilateral', 1, 'elbow_extension'),
  e('Rope Tricep Pushdown', 'cable', 'triceps', ['rope pushdown'], 'elbow_extension', 'push', 'upper_body', ['triceps'], [], ['cable'], 'isolation', 'bilateral', 1, 'elbow_extension'),
  e('Reverse-Grip Cable Pushdown', 'cable', 'triceps', ['reverse grip pushdown'], 'elbow_extension', 'push', 'upper_body', ['triceps'], [], ['cable'], 'isolation', 'bilateral', 1, 'elbow_extension'),
  e('Overhead Cable Tricep Extension', 'cable', 'triceps', ['cable overhead tricep extension'], 'elbow_extension', 'push', 'upper_body', ['triceps'], [], ['cable'], 'isolation', 'bilateral', 1, 'elbow_extension'),
  e('Single-Arm Cable Tricep Extension', 'cable', 'triceps', ['one arm cable tricep extension'], 'elbow_extension', 'push', 'upper_body', ['triceps'], [], ['cable'], 'isolation', 'single_side', 1, 'elbow_extension'),
  e('Cable Bicep Curl', 'cable', 'biceps', ['cable curl'], 'elbow_flexion', 'pull', 'upper_body', ['biceps'], ['forearms'], ['cable'], 'isolation', 'bilateral', 1, 'elbow_flexion'),
  e('Rope Hammer Curl', 'cable', 'biceps', ['cable hammer curl'], 'elbow_flexion', 'pull', 'upper_body', ['biceps', 'forearms'], [], ['cable'], 'isolation', 'bilateral', 1, 'elbow_flexion'),
  e('Cable Crunch', 'cable', 'abs', ['rope crunch'], 'core', 'core', 'core', ['abs'], [], ['cable'], 'isolation', 'bilateral', 1, 'core_flexion'),
  e('Kneeling Cable Crunch', 'cable', 'abs', ['kneeling crunch cable'], 'core', 'core', 'core', ['abs'], [], ['cable'], 'isolation', 'bilateral', 1, 'core_flexion'),
  e('Pallof Press', 'cable', 'obliques', ['pallof'], 'core', 'core', 'core', ['obliques', 'abs'], ['front_delts'], ['cable'], 'isolation', 'bilateral', 2, 'core_anti_rotation'),
  e('Cable Woodchop', 'cable', 'obliques', ['wood chop cable'], 'core', 'core', 'core', ['obliques', 'abs'], ['front_delts'], ['cable'], 'compound', 'bilateral', 2, 'core_rotation'),
  e('Cable Reverse Woodchop', 'cable', 'obliques', ['reverse wood chop'], 'core', 'core', 'core', ['obliques', 'abs'], ['front_delts'], ['cable'], 'compound', 'bilateral', 2, 'core_rotation'),
  e('Cable Pull Through', 'cable', 'glutes', ['pull through'], 'hinge', 'hinge', 'lower_body', ['glutes', 'hamstrings'], ['abs'], ['cable'], 'compound', 'bilateral', 1, 'hip_extension'),
  e('Cable Upright Row', 'cable', 'side_delts', ['upright cable row'], 'shoulder_abduction', 'pull', 'upper_body', ['side_delts'], ['traps', 'biceps'], ['cable'], 'compound', 'bilateral', 2, 'shoulder_abduction'),

  // Machine
  e('Leg Press', 'machine', 'quads', ['leg press'], 'squat', 'legs', 'lower_body', ['quads', 'glutes'], ['hamstrings'], ['machine'], 'compound', 'bilateral', 1, 'leg_press'),
  e('Hack Squat', 'machine', 'quads', ['hack squat'], 'squat', 'legs', 'lower_body', ['quads', 'glutes'], ['hamstrings'], ['machine'], 'compound', 'bilateral', 2, 'squat_machine'),
  e('Belt Squat Machine', 'machine', 'quads', ['belt squat'], 'squat', 'legs', 'lower_body', ['quads', 'glutes'], ['hamstrings'], ['machine'], 'compound', 'bilateral', 2, 'squat_machine'),
  e('Smith Machine Squat', 'machine', 'quads', ['smith squat'], 'squat', 'legs', 'lower_body', ['quads', 'glutes'], ['hamstrings'], ['machine'], 'compound', 'bilateral', 2, 'squat_machine'),
  e('Smith Machine Bench Press', 'machine', 'chest', ['smith bench'], 'horizontal_push', 'push', 'upper_body', ['chest'], ['triceps', 'front_delts'], ['machine', 'bench'], 'compound', 'bilateral', 2, 'horizontal_press_machine'),
  e('Smith Machine Romanian Deadlift', 'machine', 'hamstrings', ['smith rdl'], 'hinge', 'hinge', 'lower_body', ['hamstrings', 'glutes'], ['spinal_erectors'], ['machine'], 'compound', 'bilateral', 2, 'romanian_deadlift'),
  e('Chest Press Machine', 'machine', 'chest', ['machine chest press'], 'horizontal_push', 'push', 'upper_body', ['chest'], ['triceps', 'front_delts'], ['machine'], 'compound', 'bilateral', 1, 'horizontal_press_machine'),
  e('Incline Chest Press Machine', 'machine', 'chest', ['machine incline press'], 'horizontal_push', 'push', 'upper_body', ['chest'], ['front_delts', 'triceps'], ['machine'], 'compound', 'bilateral', 1, 'incline_press_machine'),
  e('Shoulder Press Machine', 'machine', 'front_delts', ['machine shoulder press'], 'vertical_push', 'push', 'upper_body', ['front_delts'], ['triceps'], ['machine'], 'compound', 'bilateral', 1, 'vertical_press_machine'),
  e('Seated Row Machine', 'machine', 'upper_back', ['machine row', 'seated row machine'], 'horizontal_pull', 'pull', 'upper_body', ['upper_back'], ['biceps'], ['machine'], 'compound', 'bilateral', 1, 'horizontal_row_machine'),
  e('Chest-Supported Row Machine', 'machine', 'upper_back', ['machine chest supported row'], 'horizontal_pull', 'pull', 'upper_body', ['upper_back'], ['biceps'], ['machine'], 'compound', 'bilateral', 1, 'horizontal_row_machine'),
  e('Lat Pulldown', 'machine', 'lats', ['lat pulldown', 'pulldown'], 'vertical_pull', 'pull', 'upper_body', ['lats'], ['biceps', 'upper_back'], ['machine'], 'compound', 'bilateral', 1, 'vertical_pull'),
  e('Assisted Pull Up Machine', 'machine', 'lats', ['assisted pull up'], 'vertical_pull', 'pull', 'upper_body', ['lats'], ['biceps', 'upper_back'], ['machine', 'pull_up_bar'], 'compound', 'bilateral', 1, 'vertical_pull'),
  e('Pec Deck', 'machine', 'chest', ['pec fly machine'], 'horizontal_push', 'push', 'upper_body', ['chest'], ['front_delts'], ['machine'], 'isolation', 'bilateral', 1, 'chest_fly_machine'),
  e('Reverse Pec Deck', 'machine', 'rear_delts', ['reverse pec fly'], 'horizontal_pull', 'pull', 'upper_body', ['rear_delts'], ['upper_back'], ['machine'], 'isolation', 'bilateral', 1, 'rear_delt_fly'),
  e('Leg Extension', 'machine', 'quads', ['leg extension', 'quad extension'], 'other', 'legs', 'lower_body', ['quads'], [], ['machine'], 'isolation', 'bilateral', 1, 'leg_extension'),
  e('Leg Curl', 'machine', 'hamstrings', ['leg curl', 'hamstring curl'], 'other', 'hinge', 'lower_body', ['hamstrings'], [], ['machine'], 'isolation', 'bilateral', 1, 'leg_curl'),
  e('Seated Leg Curl', 'machine', 'hamstrings', ['seated hamstring curl'], 'other', 'hinge', 'lower_body', ['hamstrings'], [], ['machine'], 'isolation', 'bilateral', 1, 'leg_curl'),
  e('Lying Leg Curl', 'machine', 'hamstrings', ['lying hamstring curl'], 'other', 'hinge', 'lower_body', ['hamstrings'], [], ['machine'], 'isolation', 'bilateral', 1, 'leg_curl'),
  e('Standing Leg Curl', 'machine', 'hamstrings', ['standing hamstring curl'], 'other', 'hinge', 'lower_body', ['hamstrings'], [], ['machine'], 'isolation', 'single_side', 1, 'leg_curl'),
  e('Hip Abduction Machine', 'machine', 'glutes', ['hip abductor'], 'other', 'legs', 'lower_body', ['glutes'], [], ['machine'], 'isolation', 'bilateral', 1, 'hip_abduction'),
  e('Hip Adduction Machine', 'machine', 'adductors', ['hip adductor'], 'other', 'legs', 'lower_body', ['adductors'], [], ['machine'], 'isolation', 'bilateral', 1, 'hip_adduction'),
  e('Glute Kickback Machine', 'machine', 'glutes', ['machine glute kickback'], 'hip_extension', 'hinge', 'lower_body', ['glutes'], ['hamstrings'], ['machine'], 'isolation', 'single_side', 1, 'hip_extension'),
  e('Calf Raise Machine', 'machine', 'calves', ['machine calf raise'], 'other', 'legs', 'lower_body', ['calves'], [], ['machine'], 'isolation', 'bilateral', 1, 'calf_raise'),
  e('Seated Calf Raise Machine', 'machine', 'calves', ['seated calf raise'], 'other', 'legs', 'lower_body', ['calves'], [], ['machine'], 'isolation', 'bilateral', 1, 'calf_raise'),
  e('Standing Calf Raise Machine', 'machine', 'calves', ['standing calf raise'], 'other', 'legs', 'lower_body', ['calves'], [], ['machine'], 'isolation', 'bilateral', 1, 'calf_raise'),
  e('Machine Bicep Curl', 'machine', 'biceps', ['machine curl'], 'elbow_flexion', 'pull', 'upper_body', ['biceps'], ['forearms'], ['machine'], 'isolation', 'bilateral', 1, 'elbow_flexion_machine'),
  e('Machine Tricep Extension', 'machine', 'triceps', ['machine tricep'], 'elbow_extension', 'push', 'upper_body', ['triceps'], [], ['machine'], 'isolation', 'bilateral', 1, 'elbow_extension_machine'),
  e('Machine Dip', 'machine', 'triceps', ['dip machine'], 'horizontal_push', 'push', 'upper_body', ['triceps', 'chest'], ['front_delts'], ['machine'], 'compound', 'bilateral', 1, 'dip'),
  e('Back Extension Machine', 'machine', 'hamstrings', ['machine back extension'], 'hinge', 'hinge', 'lower_body', ['hamstrings', 'glutes'], ['spinal_erectors'], ['machine'], 'compound', 'bilateral', 1, 'back_extension'),
  e('Glute Ham Raise', 'machine', 'hamstrings', ['ghr'], 'hinge', 'hinge', 'lower_body', ['hamstrings', 'glutes'], ['calves'], ['machine'], 'compound', 'bilateral', 3, 'back_extension'),

  // Bodyweight and core
  e('Pull Up', 'bodyweight', 'lats', ['pull up', 'pullup'], 'vertical_pull', 'pull', 'upper_body', ['lats'], ['biceps', 'upper_back'], ['bodyweight', 'pull_up_bar'], 'compound', 'bilateral', 3, 'vertical_pull', null),
  e('Wide-Grip Pull Up', 'bodyweight', 'lats', ['wide pull up'], 'vertical_pull', 'pull', 'upper_body', ['lats'], ['biceps', 'upper_back'], ['bodyweight', 'pull_up_bar'], 'compound', 'bilateral', 3, 'vertical_pull', null),
  e('Neutral-Grip Pull Up', 'bodyweight', 'lats', ['neutral pull up'], 'vertical_pull', 'pull', 'upper_body', ['lats'], ['biceps', 'upper_back'], ['bodyweight', 'pull_up_bar'], 'compound', 'bilateral', 3, 'vertical_pull', null),
  e('Chin Up', 'bodyweight', 'biceps', ['chin up', 'chinup'], 'vertical_pull', 'pull', 'upper_body', ['biceps', 'lats'], ['upper_back'], ['bodyweight', 'pull_up_bar'], 'compound', 'bilateral', 3, 'vertical_pull', null),
  e('Negative Pull Up', 'bodyweight', 'lats', ['eccentric pull up'], 'vertical_pull', 'pull', 'upper_body', ['lats'], ['biceps', 'upper_back'], ['bodyweight', 'pull_up_bar'], 'compound', 'bilateral', 2, 'vertical_pull', null),
  e('Push Up', 'bodyweight', 'chest', ['push up', 'pushup'], 'horizontal_push', 'push', 'upper_body', ['chest'], ['triceps', 'front_delts', 'abs'], ['bodyweight'], 'compound', 'bilateral', 1, 'horizontal_press', null),
  e('Incline Push Up', 'bodyweight', 'chest', ['incline pushup'], 'horizontal_push', 'push', 'upper_body', ['chest'], ['triceps', 'front_delts'], ['bodyweight', 'bench'], 'compound', 'bilateral', 1, 'horizontal_press', null),
  e('Decline Push Up', 'bodyweight', 'chest', ['decline pushup'], 'horizontal_push', 'push', 'upper_body', ['chest'], ['triceps', 'front_delts', 'abs'], ['bodyweight', 'bench'], 'compound', 'bilateral', 2, 'horizontal_press', null),
  e('Diamond Push Up', 'bodyweight', 'triceps', ['diamond pushup'], 'horizontal_push', 'push', 'upper_body', ['triceps', 'chest'], ['front_delts', 'abs'], ['bodyweight'], 'compound', 'bilateral', 2, 'horizontal_press', null),
  e('Pike Push Up', 'bodyweight', 'front_delts', ['pike pushup'], 'vertical_push', 'push', 'upper_body', ['front_delts'], ['triceps', 'abs'], ['bodyweight'], 'compound', 'bilateral', 2, 'vertical_press', null),
  e('Dip', 'bodyweight', 'triceps', ['dip', 'dips'], 'horizontal_push', 'push', 'upper_body', ['triceps', 'chest'], ['front_delts'], ['bodyweight'], 'compound', 'bilateral', 3, 'dip', null),
  e('Bench Dip', 'bodyweight', 'triceps', ['chair dip'], 'horizontal_push', 'push', 'upper_body', ['triceps'], ['chest', 'front_delts'], ['bodyweight', 'bench'], 'compound', 'bilateral', 1, 'dip', null),
  e('Inverted Row', 'bodyweight', 'upper_back', ['bodyweight row'], 'horizontal_pull', 'pull', 'upper_body', ['upper_back'], ['biceps', 'abs'], ['bodyweight', 'other'], 'compound', 'bilateral', 2, 'horizontal_row', null),
  e('Bodyweight Squat', 'bodyweight', 'quads', ['air squat', 'bw squat'], 'squat', 'legs', 'lower_body', ['quads', 'glutes'], ['hamstrings', 'abs'], ['bodyweight'], 'compound', 'bilateral', 1, 'squat_bodyweight', null),
  e('Jump Squat', 'bodyweight', 'quads', ['squat jump'], 'squat', 'legs', 'lower_body', ['quads', 'glutes'], ['hamstrings', 'calves'], ['bodyweight'], 'compound', 'bilateral', 2, 'squat_bodyweight', null),
  e('Split Squat', 'bodyweight', 'quads', ['bodyweight split squat'], 'lunge', 'legs', 'lower_body', ['quads', 'glutes'], ['hamstrings', 'abs'], ['bodyweight'], 'compound', 'single_side', 1, 'split_squat', null),
  e('Reverse Lunge', 'bodyweight', 'quads', ['bodyweight reverse lunge'], 'lunge', 'legs', 'lower_body', ['quads', 'glutes'], ['hamstrings', 'abs'], ['bodyweight'], 'compound', 'alternating', 1, 'lunge', null),
  e('Walking Lunge', 'bodyweight', 'quads', ['bodyweight walking lunge'], 'lunge', 'legs', 'lower_body', ['quads', 'glutes'], ['hamstrings', 'abs'], ['bodyweight'], 'compound', 'alternating', 1, 'lunge', null),
  e('Step Up', 'bodyweight', 'quads', ['bodyweight step up'], 'lunge', 'legs', 'lower_body', ['quads', 'glutes'], ['hamstrings'], ['bodyweight', 'bench'], 'compound', 'alternating', 1, 'step_up', null),
  e('Bulgarian Split Squat', 'bodyweight', 'quads', ['rear foot elevated split squat'], 'lunge', 'legs', 'lower_body', ['quads', 'glutes'], ['hamstrings', 'abs'], ['bodyweight', 'bench'], 'compound', 'single_side', 2, 'split_squat', null),
  e('Glute Bridge', 'bodyweight', 'glutes', ['glute bridge'], 'hip_extension', 'hinge', 'lower_body', ['glutes'], ['hamstrings', 'abs'], ['bodyweight'], 'compound', 'bilateral', 1, 'hip_extension', null),
  e('Single-Leg Glute Bridge', 'bodyweight', 'glutes', ['single leg glute bridge'], 'hip_extension', 'hinge', 'lower_body', ['glutes'], ['hamstrings', 'abs'], ['bodyweight'], 'compound', 'single_side', 2, 'hip_extension', null),
  e('Bodyweight Hip Thrust', 'bodyweight', 'glutes', ['bw hip thrust'], 'hip_extension', 'hinge', 'lower_body', ['glutes'], ['hamstrings', 'abs'], ['bodyweight', 'bench'], 'compound', 'bilateral', 1, 'hip_extension', null),
  e('Bodyweight Calf Raise', 'bodyweight', 'calves', ['standing calf raise bodyweight'], 'other', 'legs', 'lower_body', ['calves'], [], ['bodyweight'], 'isolation', 'bilateral', 1, 'calf_raise', null),
  e('Plank', 'bodyweight', 'abs', ['plank'], 'core', 'core', 'core', ['abs'], ['front_delts', 'glutes'], ['bodyweight'], 'isolation', 'bilateral', 1, 'core_anti_extension', null),
  e('Side Plank', 'bodyweight', 'obliques', ['side plank'], 'core', 'core', 'core', ['obliques', 'abs'], ['front_delts', 'glutes'], ['bodyweight'], 'isolation', 'single_side', 2, 'core_anti_lateral_flexion', null),
  e('Reverse Plank', 'bodyweight', 'abs', ['reverse plank'], 'core', 'core', 'core', ['abs', 'glutes'], ['hamstrings', 'front_delts'], ['bodyweight'], 'isolation', 'bilateral', 2, 'core_anti_extension', null),
  e('Dead Bug', 'bodyweight', 'abs', ['deadbug'], 'core', 'core', 'core', ['abs'], [], ['bodyweight'], 'isolation', 'alternating', 1, 'core_anti_extension', null),
  e('Bird Dog', 'bodyweight', 'abs', ['birddog'], 'core', 'core', 'core', ['abs'], ['glutes', 'front_delts'], ['bodyweight'], 'isolation', 'alternating', 1, 'core_anti_rotation', null),
  e('Crunch', 'bodyweight', 'abs', ['ab crunch'], 'core', 'core', 'core', ['abs'], [], ['bodyweight'], 'isolation', 'bilateral', 1, 'core_flexion', null),
  e('Reverse Crunch', 'bodyweight', 'abs', ['reverse ab crunch'], 'core', 'core', 'core', ['abs'], [], ['bodyweight'], 'isolation', 'bilateral', 1, 'core_flexion', null),
  e('Bicycle Crunch', 'bodyweight', 'obliques', ['bicycle'], 'core', 'core', 'core', ['obliques', 'abs'], [], ['bodyweight'], 'isolation', 'alternating', 1, 'core_rotation', null),
  e('Mountain Climber', 'bodyweight', 'abs', ['mountain climbers'], 'core', 'core', 'full_body', ['abs'], ['front_delts', 'quads'], ['bodyweight'], 'compound', 'alternating', 2, 'core_dynamic', null),
  e('Hanging Leg Raise', 'bodyweight', 'abs', ['leg raise', 'hanging leg raise'], 'core', 'core', 'core', ['abs'], ['forearms'], ['bodyweight', 'pull_up_bar'], 'compound', 'bilateral', 3, 'core_flexion', null),
  e('Hanging Knee Raise', 'bodyweight', 'abs', ['hanging knee raise'], 'core', 'core', 'core', ['abs'], ['forearms'], ['bodyweight', 'pull_up_bar'], 'compound', 'bilateral', 2, 'core_flexion', null),
  e('Lying Leg Raise', 'bodyweight', 'abs', ['lying leg raise'], 'core', 'core', 'core', ['abs'], [], ['bodyweight'], 'isolation', 'bilateral', 1, 'core_flexion', null),
  e('Ab Wheel Rollout', 'other', 'abs', ['ab wheel'], 'core', 'core', 'core', ['abs'], ['front_delts'], ['other'], 'compound', 'bilateral', 3, 'core_anti_extension', null),
  e('Superman', 'bodyweight', 'spinal_erectors', ['superman hold'], 'hinge', 'hinge', 'lower_body', ['spinal_erectors', 'glutes'], ['hamstrings'], ['bodyweight'], 'isolation', 'bilateral', 1, 'back_extension', null),
  e('Back Extension', 'bodyweight', 'hamstrings', ['hyperextension'], 'hinge', 'hinge', 'lower_body', ['hamstrings', 'glutes'], ['spinal_erectors'], ['bodyweight', 'other'], 'compound', 'bilateral', 1, 'back_extension', null),
];

// Curated beta seed library: common, searchable movements without media or instructions.
// Aliases are stored normalised (see normalizeName) and must be globally unique.
export const SEED_EXERCISES: SeedExercise[] = CURATED_SEED_EXERCISES.map((exercise) => ({
  name: exercise.name,
  category: exercise.category,
  primary_muscle: exercise.primary_muscle,
  default_unit: exercise.default_unit === undefined ? 'kg' : exercise.default_unit,
  aliases: exercise.aliases,
}));

export const SEED_EXERCISE_METADATA: SeedExerciseMetadata[] = CURATED_SEED_EXERCISES.map(
  (exercise) => ({
    exerciseName: exercise.name,
    movement_pattern: exercise.movement_pattern,
    force_type: exercise.force_type,
    body_region: exercise.body_region,
    primary_muscles: exercise.primary_muscles,
    secondary_muscles: exercise.secondary_muscles,
    equipment: exercise.equipment ?? [exercise.category],
    mechanics: exercise.mechanics,
    laterality: exercise.laterality,
    difficulty: exercise.difficulty,
    substitution_group: exercise.substitution_group,
    source_id: `curated_seed:${normalizeName(exercise.name).replace(/\s+/g, '_')}`,
  }),
);

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

function e(
  name: string,
  category: ExerciseCategory,
  primaryMuscle: MuscleGroup,
  aliases: string[],
  movementPattern: MovementPattern,
  forceType: ForceType,
  bodyRegion: BodyRegion,
  primaryMuscles: MuscleGroup[],
  secondaryMuscles: MuscleGroup[],
  equipment: Equipment[],
  mechanics: Mechanics,
  laterality: Laterality,
  difficulty: number,
  substitutionGroup: string,
  defaultUnit?: Unit | null,
): CuratedSeedExercise {
  return {
    name,
    category,
    primary_muscle: primaryMuscle,
    default_unit: defaultUnit,
    aliases,
    movement_pattern: movementPattern,
    force_type: forceType,
    body_region: bodyRegion,
    primary_muscles: primaryMuscles,
    secondary_muscles: secondaryMuscles,
    equipment,
    mechanics,
    laterality,
    difficulty,
    substitution_group: substitutionGroup,
  };
}
