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
  e('Barbell Back Squat', 'barbell', 'quadriceps', ['squat', 'back squat', 'barbell squat'], 'squat', 'legs', 'lower_body', ['quadriceps', 'glutes'], ['hamstrings', 'core'], ['barbell'], 'compound', 'bilateral', 3, 'squat_barbell'),
  e('Barbell Front Squat', 'barbell', 'quadriceps', ['front squat'], 'squat', 'legs', 'lower_body', ['quadriceps'], ['glutes', 'core'], ['barbell'], 'compound', 'bilateral', 4, 'squat_barbell'),
  e('Barbell Pause Squat', 'barbell', 'quadriceps', ['pause squat'], 'squat', 'legs', 'lower_body', ['quadriceps', 'glutes'], ['hamstrings', 'core'], ['barbell'], 'compound', 'bilateral', 4, 'squat_barbell'),
  e('Barbell Box Squat', 'barbell', 'quadriceps', ['box squat'], 'squat', 'legs', 'lower_body', ['quadriceps', 'glutes'], ['hamstrings', 'core'], ['barbell'], 'compound', 'bilateral', 3, 'squat_barbell'),
  e('Zercher Squat', 'barbell', 'quadriceps', ['zercher'], 'squat', 'legs', 'lower_body', ['quadriceps', 'glutes'], ['hamstrings', 'core', 'back'], ['barbell'], 'compound', 'bilateral', 4, 'squat_barbell'),
  e('Barbell Deadlift', 'barbell', 'hamstrings', ['deadlift', 'dl'], 'hinge', 'hinge', 'full_body', ['hamstrings', 'glutes'], ['back', 'core', 'forearms'], ['barbell'], 'compound', 'bilateral', 4, 'deadlift'),
  e('Sumo Deadlift', 'barbell', 'glutes', ['sumo dl'], 'hinge', 'hinge', 'full_body', ['glutes', 'hamstrings'], ['quadriceps', 'back', 'core'], ['barbell'], 'compound', 'bilateral', 4, 'deadlift'),
  e('Deficit Deadlift', 'barbell', 'hamstrings', ['deficit dl'], 'hinge', 'hinge', 'full_body', ['hamstrings', 'glutes'], ['back', 'quadriceps', 'core'], ['barbell'], 'compound', 'bilateral', 5, 'deadlift'),
  e('Rack Pull', 'barbell', 'back', ['rack deadlift'], 'hinge', 'hinge', 'full_body', ['back', 'glutes'], ['hamstrings', 'forearms', 'core'], ['barbell'], 'compound', 'bilateral', 3, 'deadlift'),
  e('Romanian Deadlift', 'barbell', 'hamstrings', ['rdl', 'romanian deadlift'], 'hinge', 'hinge', 'lower_body', ['hamstrings', 'glutes'], ['back', 'core'], ['barbell'], 'compound', 'bilateral', 3, 'romanian_deadlift'),
  e('Stiff-Leg Deadlift', 'barbell', 'hamstrings', ['sldl'], 'hinge', 'hinge', 'lower_body', ['hamstrings'], ['glutes', 'back'], ['barbell'], 'compound', 'bilateral', 3, 'romanian_deadlift'),
  e('Good Morning', 'barbell', 'hamstrings', ['good morning'], 'hinge', 'hinge', 'lower_body', ['hamstrings', 'glutes'], ['back', 'core'], ['barbell'], 'compound', 'bilateral', 3, 'good_morning'),
  e('Barbell Hip Thrust', 'barbell', 'glutes', ['hip thrust', 'barbell hip thrust'], 'hip_extension', 'hinge', 'lower_body', ['glutes'], ['hamstrings', 'core'], ['barbell', 'bench'], 'compound', 'bilateral', 2, 'hip_extension'),
  e('Barbell Glute Bridge', 'barbell', 'glutes', ['weighted glute bridge'], 'hip_extension', 'hinge', 'lower_body', ['glutes'], ['hamstrings', 'core'], ['barbell'], 'compound', 'bilateral', 2, 'hip_extension'),
  e('Barbell Bench Press', 'barbell', 'chest', ['bench', 'bench press', 'flat bench'], 'horizontal_push', 'push', 'upper_body', ['chest'], ['triceps', 'shoulders'], ['barbell', 'bench'], 'compound', 'bilateral', 3, 'horizontal_press'),
  e('Paused Bench Press', 'barbell', 'chest', ['paused bench'], 'horizontal_push', 'push', 'upper_body', ['chest'], ['triceps', 'shoulders'], ['barbell', 'bench'], 'compound', 'bilateral', 3, 'horizontal_press'),
  e('Close-Grip Bench Press', 'barbell', 'triceps', ['cgbp', 'close grip bench'], 'horizontal_push', 'push', 'upper_body', ['triceps', 'chest'], ['shoulders'], ['barbell', 'bench'], 'compound', 'bilateral', 3, 'horizontal_press'),
  e('Incline Barbell Bench Press', 'barbell', 'chest', ['incline bench', 'incline press'], 'horizontal_push', 'push', 'upper_body', ['chest'], ['shoulders', 'triceps'], ['barbell', 'bench'], 'compound', 'bilateral', 3, 'incline_press'),
  e('Decline Barbell Bench Press', 'barbell', 'chest', ['decline bench'], 'horizontal_push', 'push', 'upper_body', ['chest'], ['triceps', 'shoulders'], ['barbell', 'bench'], 'compound', 'bilateral', 3, 'horizontal_press'),
  e('Overhead Press', 'barbell', 'shoulders', ['ohp', 'military press', 'press'], 'vertical_push', 'push', 'upper_body', ['shoulders'], ['triceps', 'core'], ['barbell'], 'compound', 'bilateral', 3, 'vertical_press'),
  e('Push Press', 'barbell', 'shoulders', ['barbell push press'], 'vertical_push', 'push', 'full_body', ['shoulders'], ['triceps', 'quadriceps', 'core'], ['barbell'], 'compound', 'bilateral', 4, 'vertical_press'),
  e('Barbell Row', 'barbell', 'back', ['bent over row', 'barbell bent over row'], 'horizontal_pull', 'pull', 'upper_body', ['back'], ['biceps', 'hamstrings', 'core'], ['barbell'], 'compound', 'bilateral', 3, 'horizontal_row'),
  e('Pendlay Row', 'barbell', 'back', ['pendlay'], 'horizontal_pull', 'pull', 'upper_body', ['back'], ['biceps', 'hamstrings'], ['barbell'], 'compound', 'bilateral', 3, 'horizontal_row'),
  e('Barbell Upright Row', 'barbell', 'shoulders', ['upright row barbell'], 'shoulder_abduction', 'pull', 'upper_body', ['shoulders'], ['biceps'], ['barbell'], 'compound', 'bilateral', 2, 'shoulder_abduction'),
  e('Barbell Curl', 'barbell', 'biceps', ['bb curl'], 'elbow_flexion', 'pull', 'upper_body', ['biceps'], ['forearms'], ['barbell'], 'isolation', 'bilateral', 1, 'elbow_flexion'),
  e('EZ-Bar Curl', 'barbell', 'biceps', ['ez curl'], 'elbow_flexion', 'pull', 'upper_body', ['biceps'], ['forearms'], ['barbell'], 'isolation', 'bilateral', 1, 'elbow_flexion'),
  e('Skull Crusher', 'barbell', 'triceps', ['lying tricep extension'], 'elbow_extension', 'push', 'upper_body', ['triceps'], [], ['barbell', 'bench'], 'isolation', 'bilateral', 2, 'elbow_extension'),
  e('Barbell Calf Raise', 'barbell', 'calves', ['standing barbell calf raise'], 'other', 'legs', 'lower_body', ['calves'], [], ['barbell'], 'isolation', 'bilateral', 2, 'calf_raise'),

  // Dumbbell
  e('Dumbbell Bench Press', 'dumbbell', 'chest', ['db bench', 'dumbbell bench'], 'horizontal_push', 'push', 'upper_body', ['chest'], ['triceps', 'shoulders'], ['dumbbell', 'bench'], 'compound', 'bilateral', 2, 'horizontal_press'),
  e('Incline Dumbbell Bench Press', 'dumbbell', 'chest', ['incline db bench', 'incline dumbbell press'], 'horizontal_push', 'push', 'upper_body', ['chest'], ['shoulders', 'triceps'], ['dumbbell', 'bench'], 'compound', 'bilateral', 2, 'incline_press'),
  e('Decline Dumbbell Bench Press', 'dumbbell', 'chest', ['decline db bench'], 'horizontal_push', 'push', 'upper_body', ['chest'], ['triceps', 'shoulders'], ['dumbbell', 'bench'], 'compound', 'bilateral', 2, 'horizontal_press'),
  e('Dumbbell Floor Press', 'dumbbell', 'chest', ['db floor press'], 'horizontal_push', 'push', 'upper_body', ['chest', 'triceps'], ['shoulders'], ['dumbbell'], 'compound', 'bilateral', 2, 'horizontal_press'),
  e('Dumbbell Shoulder Press', 'dumbbell', 'shoulders', ['db shoulder press', 'db press', 'dumbbell press'], 'vertical_push', 'push', 'upper_body', ['shoulders'], ['triceps'], ['dumbbell'], 'compound', 'bilateral', 2, 'vertical_press'),
  e('Seated Dumbbell Shoulder Press', 'dumbbell', 'shoulders', ['seated db press'], 'vertical_push', 'push', 'upper_body', ['shoulders'], ['triceps'], ['dumbbell', 'bench'], 'compound', 'bilateral', 2, 'vertical_press'),
  e('Arnold Press', 'dumbbell', 'shoulders', ['arnold db press'], 'vertical_push', 'push', 'upper_body', ['shoulders'], ['triceps'], ['dumbbell'], 'compound', 'bilateral', 2, 'vertical_press'),
  e('Single-Arm Dumbbell Row', 'dumbbell', 'back', ['db row', 'single arm row', 'dumbbell row'], 'horizontal_pull', 'pull', 'upper_body', ['back'], ['biceps', 'core'], ['dumbbell', 'bench'], 'compound', 'single_side', 2, 'horizontal_row'),
  e('Chest-Supported Dumbbell Row', 'dumbbell', 'back', ['chest supported db row'], 'horizontal_pull', 'pull', 'upper_body', ['back'], ['biceps'], ['dumbbell', 'bench'], 'compound', 'bilateral', 2, 'horizontal_row'),
  e('Renegade Row', 'dumbbell', 'back', ['plank db row'], 'horizontal_pull', 'pull', 'full_body', ['back', 'core'], ['shoulders', 'triceps'], ['dumbbell'], 'compound', 'alternating', 3, 'horizontal_row'),
  e('Dumbbell Pullover', 'dumbbell', 'back', ['db pullover'], 'vertical_pull', 'pull', 'upper_body', ['back', 'chest'], ['triceps'], ['dumbbell', 'bench'], 'compound', 'bilateral', 2, 'pullover'),
  e('Dumbbell Fly', 'dumbbell', 'chest', ['db fly', 'dumbbell fly'], 'horizontal_push', 'push', 'upper_body', ['chest'], ['shoulders'], ['dumbbell', 'bench'], 'isolation', 'bilateral', 2, 'chest_fly'),
  e('Incline Dumbbell Fly', 'dumbbell', 'chest', ['incline db fly'], 'horizontal_push', 'push', 'upper_body', ['chest'], ['shoulders'], ['dumbbell', 'bench'], 'isolation', 'bilateral', 2, 'chest_fly'),
  e('Reverse Dumbbell Fly', 'dumbbell', 'shoulders', ['reverse db fly'], 'horizontal_pull', 'pull', 'upper_body', ['shoulders'], ['back'], ['dumbbell', 'bench'], 'isolation', 'bilateral', 2, 'rear_delt_fly'),
  e('Dumbbell Lateral Raise', 'dumbbell', 'shoulders', ['lat raise', 'laterals', 'db lateral raise'], 'shoulder_abduction', 'push', 'upper_body', ['shoulders'], [], ['dumbbell'], 'isolation', 'bilateral', 1, 'shoulder_abduction'),
  e('Dumbbell Front Raise', 'dumbbell', 'shoulders', ['db front raise'], 'shoulder_abduction', 'push', 'upper_body', ['shoulders'], [], ['dumbbell'], 'isolation', 'bilateral', 1, 'shoulder_abduction'),
  e('Dumbbell Bicep Curl', 'dumbbell', 'biceps', ['db curl', 'bicep curl', 'dumbbell curl'], 'elbow_flexion', 'pull', 'upper_body', ['biceps'], ['forearms'], ['dumbbell'], 'isolation', 'bilateral', 1, 'elbow_flexion'),
  e('Hammer Curl', 'dumbbell', 'biceps', ['db hammer curl'], 'elbow_flexion', 'pull', 'upper_body', ['biceps', 'forearms'], [], ['dumbbell'], 'isolation', 'bilateral', 1, 'elbow_flexion'),
  e('Incline Dumbbell Curl', 'dumbbell', 'biceps', ['incline db curl'], 'elbow_flexion', 'pull', 'upper_body', ['biceps'], ['forearms'], ['dumbbell', 'bench'], 'isolation', 'bilateral', 2, 'elbow_flexion'),
  e('Concentration Curl', 'dumbbell', 'biceps', ['concentration db curl'], 'elbow_flexion', 'pull', 'upper_body', ['biceps'], ['forearms'], ['dumbbell'], 'isolation', 'single_side', 1, 'elbow_flexion'),
  e('Zottman Curl', 'dumbbell', 'biceps', ['zottman db curl'], 'elbow_flexion', 'pull', 'upper_body', ['biceps', 'forearms'], [], ['dumbbell'], 'isolation', 'bilateral', 2, 'elbow_flexion'),
  e('Dumbbell Tricep Extension', 'dumbbell', 'triceps', ['db tricep extension', 'dumbbell tricep extension'], 'elbow_extension', 'push', 'upper_body', ['triceps'], [], ['dumbbell'], 'isolation', 'bilateral', 1, 'elbow_extension'),
  e('Dumbbell Skull Crusher', 'dumbbell', 'triceps', ['db skull crusher'], 'elbow_extension', 'push', 'upper_body', ['triceps'], [], ['dumbbell', 'bench'], 'isolation', 'bilateral', 2, 'elbow_extension'),
  e('Dumbbell Tricep Kickback', 'dumbbell', 'triceps', ['db kickback'], 'elbow_extension', 'push', 'upper_body', ['triceps'], [], ['dumbbell'], 'isolation', 'single_side', 1, 'elbow_extension'),
  e('Dumbbell Romanian Deadlift', 'dumbbell', 'hamstrings', ['db rdl', 'dumbbell rdl'], 'hinge', 'hinge', 'lower_body', ['hamstrings', 'glutes'], ['back', 'core'], ['dumbbell'], 'compound', 'bilateral', 2, 'romanian_deadlift'),
  e('Single-Leg Dumbbell Romanian Deadlift', 'dumbbell', 'hamstrings', ['single leg db rdl'], 'hinge', 'hinge', 'lower_body', ['hamstrings', 'glutes'], ['core'], ['dumbbell'], 'compound', 'single_side', 3, 'single_leg_hinge'),
  e('Dumbbell Lunge', 'dumbbell', 'quadriceps', ['db lunge', 'dumbbell lunge'], 'lunge', 'legs', 'lower_body', ['quadriceps', 'glutes'], ['hamstrings', 'core'], ['dumbbell'], 'compound', 'alternating', 2, 'lunge'),
  e('Dumbbell Reverse Lunge', 'dumbbell', 'quadriceps', ['db reverse lunge'], 'lunge', 'legs', 'lower_body', ['quadriceps', 'glutes'], ['hamstrings', 'core'], ['dumbbell'], 'compound', 'alternating', 2, 'lunge'),
  e('Dumbbell Walking Lunge', 'dumbbell', 'quadriceps', ['db walking lunge'], 'lunge', 'legs', 'lower_body', ['quadriceps', 'glutes'], ['hamstrings', 'core'], ['dumbbell'], 'compound', 'alternating', 2, 'lunge'),
  e('Dumbbell Bulgarian Split Squat', 'dumbbell', 'quadriceps', ['db bulgarian split squat'], 'lunge', 'legs', 'lower_body', ['quadriceps', 'glutes'], ['hamstrings', 'core'], ['dumbbell', 'bench'], 'compound', 'single_side', 3, 'split_squat'),
  e('Dumbbell Split Squat', 'dumbbell', 'quadriceps', ['db split squat'], 'lunge', 'legs', 'lower_body', ['quadriceps', 'glutes'], ['hamstrings', 'core'], ['dumbbell'], 'compound', 'single_side', 2, 'split_squat'),
  e('Dumbbell Step Up', 'dumbbell', 'quadriceps', ['db step up'], 'lunge', 'legs', 'lower_body', ['quadriceps', 'glutes'], ['hamstrings', 'core'], ['dumbbell', 'bench'], 'compound', 'alternating', 2, 'step_up'),
  e('Goblet Squat', 'dumbbell', 'quadriceps', ['db goblet squat'], 'squat', 'legs', 'lower_body', ['quadriceps', 'glutes'], ['hamstrings', 'core'], ['dumbbell'], 'compound', 'bilateral', 1, 'squat_dumbbell'),
  e('Dumbbell Sumo Squat', 'dumbbell', 'glutes', ['db sumo squat'], 'squat', 'legs', 'lower_body', ['glutes', 'quadriceps'], ['hamstrings'], ['dumbbell'], 'compound', 'bilateral', 1, 'squat_dumbbell'),
  e('Dumbbell Hip Thrust', 'dumbbell', 'glutes', ['db hip thrust'], 'hip_extension', 'hinge', 'lower_body', ['glutes'], ['hamstrings', 'core'], ['dumbbell', 'bench'], 'compound', 'bilateral', 1, 'hip_extension'),
  e('Dumbbell Calf Raise', 'dumbbell', 'calves', ['db calf raise'], 'other', 'legs', 'lower_body', ['calves'], [], ['dumbbell'], 'isolation', 'bilateral', 1, 'calf_raise'),
  e('Dumbbell Shrug', 'dumbbell', 'back', ['db shrug'], 'other', 'pull', 'upper_body', ['back'], ['forearms'], ['dumbbell'], 'isolation', 'bilateral', 1, 'shrug'),

  // Cable
  e('Cable Fly', 'cable', 'chest', ['standing cable fly'], 'horizontal_push', 'push', 'upper_body', ['chest'], ['shoulders'], ['cable'], 'isolation', 'bilateral', 1, 'chest_fly'),
  e('Low-to-High Cable Fly', 'cable', 'chest', ['low high cable fly'], 'horizontal_push', 'push', 'upper_body', ['chest'], ['shoulders'], ['cable'], 'isolation', 'bilateral', 2, 'chest_fly'),
  e('High-to-Low Cable Fly', 'cable', 'chest', ['high low cable fly'], 'horizontal_push', 'push', 'upper_body', ['chest'], ['shoulders'], ['cable'], 'isolation', 'bilateral', 2, 'chest_fly'),
  e('Cable Crossover', 'cable', 'chest', ['cable crossover'], 'horizontal_push', 'push', 'upper_body', ['chest'], ['shoulders'], ['cable'], 'isolation', 'bilateral', 1, 'chest_fly'),
  e('Seated Cable Row', 'cable', 'back', ['cable row', 'low cable row'], 'horizontal_pull', 'pull', 'upper_body', ['back'], ['biceps'], ['cable'], 'compound', 'bilateral', 1, 'horizontal_row'),
  e('Single-Arm Cable Row', 'cable', 'back', ['one arm cable row'], 'horizontal_pull', 'pull', 'upper_body', ['back'], ['biceps', 'core'], ['cable'], 'compound', 'single_side', 2, 'horizontal_row'),
  e('Rope Cable Row', 'cable', 'back', ['rope row'], 'horizontal_pull', 'pull', 'upper_body', ['back'], ['biceps'], ['cable'], 'compound', 'bilateral', 1, 'horizontal_row'),
  e('Cable Lat Pulldown', 'cable', 'back', ['cable pulldown'], 'vertical_pull', 'pull', 'upper_body', ['back'], ['biceps'], ['cable'], 'compound', 'bilateral', 1, 'vertical_pull'),
  e('Single-Arm Lat Pulldown', 'cable', 'back', ['one arm pulldown'], 'vertical_pull', 'pull', 'upper_body', ['back'], ['biceps'], ['cable'], 'compound', 'single_side', 2, 'vertical_pull'),
  e('Straight-Arm Pulldown', 'cable', 'back', ['straight arm pulldown'], 'vertical_pull', 'pull', 'upper_body', ['back'], ['triceps'], ['cable'], 'isolation', 'bilateral', 1, 'vertical_pull'),
  e('Cable Face Pull', 'cable', 'shoulders', ['face pull'], 'horizontal_pull', 'pull', 'upper_body', ['shoulders', 'back'], ['biceps'], ['cable'], 'compound', 'bilateral', 1, 'rear_delt_fly'),
  e('Cable Rear Delt Fly', 'cable', 'shoulders', ['rear delt cable fly'], 'horizontal_pull', 'pull', 'upper_body', ['shoulders'], ['back'], ['cable'], 'isolation', 'bilateral', 1, 'rear_delt_fly'),
  e('Cable Lateral Raise', 'cable', 'shoulders', ['cable lateral', 'cable lateral raise'], 'shoulder_abduction', 'push', 'upper_body', ['shoulders'], [], ['cable'], 'isolation', 'bilateral', 1, 'shoulder_abduction'),
  e('Single-Arm Cable Lateral Raise', 'cable', 'shoulders', ['one arm cable lateral raise'], 'shoulder_abduction', 'push', 'upper_body', ['shoulders'], [], ['cable'], 'isolation', 'single_side', 1, 'shoulder_abduction'),
  e('Cable Front Raise', 'cable', 'shoulders', ['front cable raise'], 'shoulder_abduction', 'push', 'upper_body', ['shoulders'], [], ['cable'], 'isolation', 'bilateral', 1, 'shoulder_abduction'),
  e('Cable Tricep Pushdown', 'cable', 'triceps', ['tricep pushdown', 'cable pushdown', 'pushdown'], 'elbow_extension', 'push', 'upper_body', ['triceps'], [], ['cable'], 'isolation', 'bilateral', 1, 'elbow_extension'),
  e('Rope Tricep Pushdown', 'cable', 'triceps', ['rope pushdown'], 'elbow_extension', 'push', 'upper_body', ['triceps'], [], ['cable'], 'isolation', 'bilateral', 1, 'elbow_extension'),
  e('Reverse-Grip Cable Pushdown', 'cable', 'triceps', ['reverse grip pushdown'], 'elbow_extension', 'push', 'upper_body', ['triceps'], [], ['cable'], 'isolation', 'bilateral', 1, 'elbow_extension'),
  e('Overhead Cable Tricep Extension', 'cable', 'triceps', ['cable overhead tricep extension'], 'elbow_extension', 'push', 'upper_body', ['triceps'], [], ['cable'], 'isolation', 'bilateral', 1, 'elbow_extension'),
  e('Single-Arm Cable Tricep Extension', 'cable', 'triceps', ['one arm cable tricep extension'], 'elbow_extension', 'push', 'upper_body', ['triceps'], [], ['cable'], 'isolation', 'single_side', 1, 'elbow_extension'),
  e('Cable Bicep Curl', 'cable', 'biceps', ['cable curl'], 'elbow_flexion', 'pull', 'upper_body', ['biceps'], ['forearms'], ['cable'], 'isolation', 'bilateral', 1, 'elbow_flexion'),
  e('Rope Hammer Curl', 'cable', 'biceps', ['cable hammer curl'], 'elbow_flexion', 'pull', 'upper_body', ['biceps', 'forearms'], [], ['cable'], 'isolation', 'bilateral', 1, 'elbow_flexion'),
  e('Cable Crunch', 'cable', 'core', ['rope crunch'], 'core', 'core', 'core', ['core'], [], ['cable'], 'isolation', 'bilateral', 1, 'core_flexion'),
  e('Kneeling Cable Crunch', 'cable', 'core', ['kneeling crunch cable'], 'core', 'core', 'core', ['core'], [], ['cable'], 'isolation', 'bilateral', 1, 'core_flexion'),
  e('Pallof Press', 'cable', 'core', ['pallof'], 'core', 'core', 'core', ['core'], ['shoulders'], ['cable'], 'isolation', 'bilateral', 2, 'core_anti_rotation'),
  e('Cable Woodchop', 'cable', 'core', ['wood chop cable'], 'core', 'core', 'core', ['core'], ['shoulders'], ['cable'], 'compound', 'bilateral', 2, 'core_rotation'),
  e('Cable Reverse Woodchop', 'cable', 'core', ['reverse wood chop'], 'core', 'core', 'core', ['core'], ['shoulders'], ['cable'], 'compound', 'bilateral', 2, 'core_rotation'),
  e('Cable Pull Through', 'cable', 'glutes', ['pull through'], 'hinge', 'hinge', 'lower_body', ['glutes', 'hamstrings'], ['core'], ['cable'], 'compound', 'bilateral', 1, 'hip_extension'),
  e('Cable Upright Row', 'cable', 'shoulders', ['upright cable row'], 'shoulder_abduction', 'pull', 'upper_body', ['shoulders'], ['biceps'], ['cable'], 'compound', 'bilateral', 2, 'shoulder_abduction'),

  // Machine
  e('Leg Press', 'machine', 'quadriceps', ['leg press'], 'squat', 'legs', 'lower_body', ['quadriceps', 'glutes'], ['hamstrings'], ['machine'], 'compound', 'bilateral', 1, 'leg_press'),
  e('Hack Squat', 'machine', 'quadriceps', ['hack squat'], 'squat', 'legs', 'lower_body', ['quadriceps', 'glutes'], ['hamstrings'], ['machine'], 'compound', 'bilateral', 2, 'squat_machine'),
  e('Belt Squat Machine', 'machine', 'quadriceps', ['belt squat'], 'squat', 'legs', 'lower_body', ['quadriceps', 'glutes'], ['hamstrings'], ['machine'], 'compound', 'bilateral', 2, 'squat_machine'),
  e('Smith Machine Squat', 'machine', 'quadriceps', ['smith squat'], 'squat', 'legs', 'lower_body', ['quadriceps', 'glutes'], ['hamstrings'], ['machine'], 'compound', 'bilateral', 2, 'squat_machine'),
  e('Smith Machine Bench Press', 'machine', 'chest', ['smith bench'], 'horizontal_push', 'push', 'upper_body', ['chest'], ['triceps', 'shoulders'], ['machine', 'bench'], 'compound', 'bilateral', 2, 'horizontal_press_machine'),
  e('Smith Machine Romanian Deadlift', 'machine', 'hamstrings', ['smith rdl'], 'hinge', 'hinge', 'lower_body', ['hamstrings', 'glutes'], ['back'], ['machine'], 'compound', 'bilateral', 2, 'romanian_deadlift'),
  e('Chest Press Machine', 'machine', 'chest', ['machine chest press'], 'horizontal_push', 'push', 'upper_body', ['chest'], ['triceps', 'shoulders'], ['machine'], 'compound', 'bilateral', 1, 'horizontal_press_machine'),
  e('Incline Chest Press Machine', 'machine', 'chest', ['machine incline press'], 'horizontal_push', 'push', 'upper_body', ['chest'], ['shoulders', 'triceps'], ['machine'], 'compound', 'bilateral', 1, 'incline_press_machine'),
  e('Shoulder Press Machine', 'machine', 'shoulders', ['machine shoulder press'], 'vertical_push', 'push', 'upper_body', ['shoulders'], ['triceps'], ['machine'], 'compound', 'bilateral', 1, 'vertical_press_machine'),
  e('Seated Row Machine', 'machine', 'back', ['machine row', 'seated row machine'], 'horizontal_pull', 'pull', 'upper_body', ['back'], ['biceps'], ['machine'], 'compound', 'bilateral', 1, 'horizontal_row_machine'),
  e('Chest-Supported Row Machine', 'machine', 'back', ['machine chest supported row'], 'horizontal_pull', 'pull', 'upper_body', ['back'], ['biceps'], ['machine'], 'compound', 'bilateral', 1, 'horizontal_row_machine'),
  e('Lat Pulldown', 'machine', 'back', ['lat pulldown', 'pulldown'], 'vertical_pull', 'pull', 'upper_body', ['back'], ['biceps'], ['machine'], 'compound', 'bilateral', 1, 'vertical_pull'),
  e('Assisted Pull Up Machine', 'machine', 'back', ['assisted pull up'], 'vertical_pull', 'pull', 'upper_body', ['back'], ['biceps'], ['machine', 'pull_up_bar'], 'compound', 'bilateral', 1, 'vertical_pull'),
  e('Pec Deck', 'machine', 'chest', ['pec fly machine'], 'horizontal_push', 'push', 'upper_body', ['chest'], ['shoulders'], ['machine'], 'isolation', 'bilateral', 1, 'chest_fly_machine'),
  e('Reverse Pec Deck', 'machine', 'shoulders', ['reverse pec fly'], 'horizontal_pull', 'pull', 'upper_body', ['shoulders'], ['back'], ['machine'], 'isolation', 'bilateral', 1, 'rear_delt_fly'),
  e('Leg Extension', 'machine', 'quadriceps', ['leg extension', 'quad extension'], 'other', 'legs', 'lower_body', ['quadriceps'], [], ['machine'], 'isolation', 'bilateral', 1, 'leg_extension'),
  e('Leg Curl', 'machine', 'hamstrings', ['leg curl', 'hamstring curl'], 'other', 'hinge', 'lower_body', ['hamstrings'], [], ['machine'], 'isolation', 'bilateral', 1, 'leg_curl'),
  e('Seated Leg Curl', 'machine', 'hamstrings', ['seated hamstring curl'], 'other', 'hinge', 'lower_body', ['hamstrings'], [], ['machine'], 'isolation', 'bilateral', 1, 'leg_curl'),
  e('Lying Leg Curl', 'machine', 'hamstrings', ['lying hamstring curl'], 'other', 'hinge', 'lower_body', ['hamstrings'], [], ['machine'], 'isolation', 'bilateral', 1, 'leg_curl'),
  e('Standing Leg Curl', 'machine', 'hamstrings', ['standing hamstring curl'], 'other', 'hinge', 'lower_body', ['hamstrings'], [], ['machine'], 'isolation', 'single_side', 1, 'leg_curl'),
  e('Hip Abduction Machine', 'machine', 'glutes', ['hip abductor'], 'other', 'legs', 'lower_body', ['glutes'], [], ['machine'], 'isolation', 'bilateral', 1, 'hip_abduction'),
  e('Hip Adduction Machine', 'machine', 'quadriceps', ['hip adductor'], 'other', 'legs', 'lower_body', ['quadriceps'], [], ['machine'], 'isolation', 'bilateral', 1, 'hip_adduction'),
  e('Glute Kickback Machine', 'machine', 'glutes', ['machine glute kickback'], 'hip_extension', 'hinge', 'lower_body', ['glutes'], ['hamstrings'], ['machine'], 'isolation', 'single_side', 1, 'hip_extension'),
  e('Calf Raise Machine', 'machine', 'calves', ['machine calf raise'], 'other', 'legs', 'lower_body', ['calves'], [], ['machine'], 'isolation', 'bilateral', 1, 'calf_raise'),
  e('Seated Calf Raise Machine', 'machine', 'calves', ['seated calf raise'], 'other', 'legs', 'lower_body', ['calves'], [], ['machine'], 'isolation', 'bilateral', 1, 'calf_raise'),
  e('Standing Calf Raise Machine', 'machine', 'calves', ['standing calf raise'], 'other', 'legs', 'lower_body', ['calves'], [], ['machine'], 'isolation', 'bilateral', 1, 'calf_raise'),
  e('Machine Bicep Curl', 'machine', 'biceps', ['machine curl'], 'elbow_flexion', 'pull', 'upper_body', ['biceps'], ['forearms'], ['machine'], 'isolation', 'bilateral', 1, 'elbow_flexion_machine'),
  e('Machine Tricep Extension', 'machine', 'triceps', ['machine tricep'], 'elbow_extension', 'push', 'upper_body', ['triceps'], [], ['machine'], 'isolation', 'bilateral', 1, 'elbow_extension_machine'),
  e('Machine Dip', 'machine', 'triceps', ['dip machine'], 'horizontal_push', 'push', 'upper_body', ['triceps', 'chest'], ['shoulders'], ['machine'], 'compound', 'bilateral', 1, 'dip'),
  e('Back Extension Machine', 'machine', 'hamstrings', ['machine back extension'], 'hinge', 'hinge', 'lower_body', ['hamstrings', 'glutes'], ['back'], ['machine'], 'compound', 'bilateral', 1, 'back_extension'),
  e('Glute Ham Raise', 'machine', 'hamstrings', ['ghr'], 'hinge', 'hinge', 'lower_body', ['hamstrings', 'glutes'], ['calves'], ['machine'], 'compound', 'bilateral', 3, 'back_extension'),

  // Bodyweight and core
  e('Pull Up', 'bodyweight', 'back', ['pull up', 'pullup'], 'vertical_pull', 'pull', 'upper_body', ['back'], ['biceps', 'core'], ['bodyweight', 'pull_up_bar'], 'compound', 'bilateral', 3, 'vertical_pull', null),
  e('Wide-Grip Pull Up', 'bodyweight', 'back', ['wide pull up'], 'vertical_pull', 'pull', 'upper_body', ['back'], ['biceps'], ['bodyweight', 'pull_up_bar'], 'compound', 'bilateral', 3, 'vertical_pull', null),
  e('Neutral-Grip Pull Up', 'bodyweight', 'back', ['neutral pull up'], 'vertical_pull', 'pull', 'upper_body', ['back'], ['biceps'], ['bodyweight', 'pull_up_bar'], 'compound', 'bilateral', 3, 'vertical_pull', null),
  e('Chin Up', 'bodyweight', 'biceps', ['chin up', 'chinup'], 'vertical_pull', 'pull', 'upper_body', ['biceps', 'back'], ['core'], ['bodyweight', 'pull_up_bar'], 'compound', 'bilateral', 3, 'vertical_pull', null),
  e('Negative Pull Up', 'bodyweight', 'back', ['eccentric pull up'], 'vertical_pull', 'pull', 'upper_body', ['back'], ['biceps'], ['bodyweight', 'pull_up_bar'], 'compound', 'bilateral', 2, 'vertical_pull', null),
  e('Push Up', 'bodyweight', 'chest', ['push up', 'pushup'], 'horizontal_push', 'push', 'upper_body', ['chest'], ['triceps', 'shoulders', 'core'], ['bodyweight'], 'compound', 'bilateral', 1, 'horizontal_press', null),
  e('Incline Push Up', 'bodyweight', 'chest', ['incline pushup'], 'horizontal_push', 'push', 'upper_body', ['chest'], ['triceps', 'shoulders'], ['bodyweight', 'bench'], 'compound', 'bilateral', 1, 'horizontal_press', null),
  e('Decline Push Up', 'bodyweight', 'chest', ['decline pushup'], 'horizontal_push', 'push', 'upper_body', ['chest'], ['triceps', 'shoulders', 'core'], ['bodyweight', 'bench'], 'compound', 'bilateral', 2, 'horizontal_press', null),
  e('Diamond Push Up', 'bodyweight', 'triceps', ['diamond pushup'], 'horizontal_push', 'push', 'upper_body', ['triceps', 'chest'], ['shoulders', 'core'], ['bodyweight'], 'compound', 'bilateral', 2, 'horizontal_press', null),
  e('Pike Push Up', 'bodyweight', 'shoulders', ['pike pushup'], 'vertical_push', 'push', 'upper_body', ['shoulders'], ['triceps', 'core'], ['bodyweight'], 'compound', 'bilateral', 2, 'vertical_press', null),
  e('Dip', 'bodyweight', 'triceps', ['dip', 'dips'], 'horizontal_push', 'push', 'upper_body', ['triceps', 'chest'], ['shoulders'], ['bodyweight'], 'compound', 'bilateral', 3, 'dip', null),
  e('Bench Dip', 'bodyweight', 'triceps', ['chair dip'], 'horizontal_push', 'push', 'upper_body', ['triceps'], ['chest', 'shoulders'], ['bodyweight', 'bench'], 'compound', 'bilateral', 1, 'dip', null),
  e('Inverted Row', 'bodyweight', 'back', ['bodyweight row'], 'horizontal_pull', 'pull', 'upper_body', ['back'], ['biceps', 'core'], ['bodyweight', 'other'], 'compound', 'bilateral', 2, 'horizontal_row', null),
  e('Bodyweight Squat', 'bodyweight', 'quadriceps', ['air squat', 'bw squat'], 'squat', 'legs', 'lower_body', ['quadriceps', 'glutes'], ['hamstrings', 'core'], ['bodyweight'], 'compound', 'bilateral', 1, 'squat_bodyweight', null),
  e('Jump Squat', 'bodyweight', 'quadriceps', ['squat jump'], 'squat', 'legs', 'lower_body', ['quadriceps', 'glutes'], ['hamstrings', 'calves'], ['bodyweight'], 'compound', 'bilateral', 2, 'squat_bodyweight', null),
  e('Split Squat', 'bodyweight', 'quadriceps', ['bodyweight split squat'], 'lunge', 'legs', 'lower_body', ['quadriceps', 'glutes'], ['hamstrings', 'core'], ['bodyweight'], 'compound', 'single_side', 1, 'split_squat', null),
  e('Reverse Lunge', 'bodyweight', 'quadriceps', ['bodyweight reverse lunge'], 'lunge', 'legs', 'lower_body', ['quadriceps', 'glutes'], ['hamstrings', 'core'], ['bodyweight'], 'compound', 'alternating', 1, 'lunge', null),
  e('Walking Lunge', 'bodyweight', 'quadriceps', ['bodyweight walking lunge'], 'lunge', 'legs', 'lower_body', ['quadriceps', 'glutes'], ['hamstrings', 'core'], ['bodyweight'], 'compound', 'alternating', 1, 'lunge', null),
  e('Step Up', 'bodyweight', 'quadriceps', ['bodyweight step up'], 'lunge', 'legs', 'lower_body', ['quadriceps', 'glutes'], ['hamstrings'], ['bodyweight', 'bench'], 'compound', 'alternating', 1, 'step_up', null),
  e('Bulgarian Split Squat', 'bodyweight', 'quadriceps', ['rear foot elevated split squat'], 'lunge', 'legs', 'lower_body', ['quadriceps', 'glutes'], ['hamstrings', 'core'], ['bodyweight', 'bench'], 'compound', 'single_side', 2, 'split_squat', null),
  e('Glute Bridge', 'bodyweight', 'glutes', ['glute bridge'], 'hip_extension', 'hinge', 'lower_body', ['glutes'], ['hamstrings', 'core'], ['bodyweight'], 'compound', 'bilateral', 1, 'hip_extension', null),
  e('Single-Leg Glute Bridge', 'bodyweight', 'glutes', ['single leg glute bridge'], 'hip_extension', 'hinge', 'lower_body', ['glutes'], ['hamstrings', 'core'], ['bodyweight'], 'compound', 'single_side', 2, 'hip_extension', null),
  e('Bodyweight Hip Thrust', 'bodyweight', 'glutes', ['bw hip thrust'], 'hip_extension', 'hinge', 'lower_body', ['glutes'], ['hamstrings', 'core'], ['bodyweight', 'bench'], 'compound', 'bilateral', 1, 'hip_extension', null),
  e('Bodyweight Calf Raise', 'bodyweight', 'calves', ['standing calf raise bodyweight'], 'other', 'legs', 'lower_body', ['calves'], [], ['bodyweight'], 'isolation', 'bilateral', 1, 'calf_raise', null),
  e('Plank', 'bodyweight', 'core', ['plank'], 'core', 'core', 'core', ['core'], ['shoulders', 'glutes'], ['bodyweight'], 'isolation', 'bilateral', 1, 'core_anti_extension', null),
  e('Side Plank', 'bodyweight', 'core', ['side plank'], 'core', 'core', 'core', ['core'], ['shoulders', 'glutes'], ['bodyweight'], 'isolation', 'single_side', 2, 'core_anti_lateral_flexion', null),
  e('Reverse Plank', 'bodyweight', 'core', ['reverse plank'], 'core', 'core', 'core', ['core', 'glutes'], ['hamstrings', 'shoulders'], ['bodyweight'], 'isolation', 'bilateral', 2, 'core_anti_extension', null),
  e('Dead Bug', 'bodyweight', 'core', ['deadbug'], 'core', 'core', 'core', ['core'], [], ['bodyweight'], 'isolation', 'alternating', 1, 'core_anti_extension', null),
  e('Bird Dog', 'bodyweight', 'core', ['birddog'], 'core', 'core', 'core', ['core'], ['glutes', 'shoulders'], ['bodyweight'], 'isolation', 'alternating', 1, 'core_anti_rotation', null),
  e('Crunch', 'bodyweight', 'core', ['ab crunch'], 'core', 'core', 'core', ['core'], [], ['bodyweight'], 'isolation', 'bilateral', 1, 'core_flexion', null),
  e('Reverse Crunch', 'bodyweight', 'core', ['reverse ab crunch'], 'core', 'core', 'core', ['core'], [], ['bodyweight'], 'isolation', 'bilateral', 1, 'core_flexion', null),
  e('Bicycle Crunch', 'bodyweight', 'core', ['bicycle'], 'core', 'core', 'core', ['core'], [], ['bodyweight'], 'isolation', 'alternating', 1, 'core_rotation', null),
  e('Mountain Climber', 'bodyweight', 'core', ['mountain climbers'], 'core', 'core', 'full_body', ['core'], ['shoulders', 'quadriceps'], ['bodyweight'], 'compound', 'alternating', 2, 'core_dynamic', null),
  e('Hanging Leg Raise', 'bodyweight', 'core', ['leg raise', 'hanging leg raise'], 'core', 'core', 'core', ['core'], ['forearms'], ['bodyweight', 'pull_up_bar'], 'compound', 'bilateral', 3, 'core_flexion', null),
  e('Hanging Knee Raise', 'bodyweight', 'core', ['hanging knee raise'], 'core', 'core', 'core', ['core'], ['forearms'], ['bodyweight', 'pull_up_bar'], 'compound', 'bilateral', 2, 'core_flexion', null),
  e('Lying Leg Raise', 'bodyweight', 'core', ['lying leg raise'], 'core', 'core', 'core', ['core'], [], ['bodyweight'], 'isolation', 'bilateral', 1, 'core_flexion', null),
  e('Ab Wheel Rollout', 'other', 'core', ['ab wheel'], 'core', 'core', 'core', ['core'], ['shoulders'], ['other'], 'compound', 'bilateral', 3, 'core_anti_extension', null),
  e('Superman', 'bodyweight', 'back', ['superman hold'], 'hinge', 'hinge', 'lower_body', ['back', 'glutes'], ['hamstrings'], ['bodyweight'], 'isolation', 'bilateral', 1, 'back_extension', null),
  e('Back Extension', 'bodyweight', 'hamstrings', ['hyperextension'], 'hinge', 'hinge', 'lower_body', ['hamstrings', 'glutes'], ['back'], ['bodyweight', 'other'], 'compound', 'bilateral', 1, 'back_extension', null),
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
