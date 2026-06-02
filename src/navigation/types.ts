import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { CompositeNavigationProp, RouteProp } from '@react-navigation/native';

export type RootStackParamList = {
  Onboarding: { mode?: 'firstLaunch' | 'revisit' } | undefined;
  Main: undefined;
  LiveWorkout: { templateId?: string; sessionId?: string } | undefined;
  EndWorkoutSummary: { sessionId: string };
  PostSessionTags: { sessionId: string };
  WorkoutDetails: { sessionId: string };
  Settings: undefined;
  TemplateBuilder: { templateId?: string };
  ExerciseEdit: { exerciseId?: string };
  ProgramLibrary: undefined;
  ProgramPreview: { presetId: string };
  TrainingVolume: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Templates: undefined;
  Library: undefined;
  Insights: undefined;
};

export type HomeNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Home'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export type TemplateListNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Templates'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export type ExerciseLibraryNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Library'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export type InsightsNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Insights'>,
  NativeStackNavigationProp<RootStackParamList>
>;

export type ExerciseEditNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'ExerciseEdit'
>;
export type ExerciseEditRouteProp = RouteProp<RootStackParamList, 'ExerciseEdit'>;

export type TemplateBuilderNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'TemplateBuilder'
>;
export type TemplateBuilderRouteProp = RouteProp<RootStackParamList, 'TemplateBuilder'>;

export type LiveWorkoutNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'LiveWorkout'
>;
export type LiveWorkoutRouteProp = RouteProp<RootStackParamList, 'LiveWorkout'>;

export type EndWorkoutSummaryNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'EndWorkoutSummary'
>;
export type EndWorkoutSummaryRouteProp = RouteProp<RootStackParamList, 'EndWorkoutSummary'>;

export type PostSessionTagsNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'PostSessionTags'
>;
export type PostSessionTagsRouteProp = RouteProp<RootStackParamList, 'PostSessionTags'>;

export type WorkoutDetailsNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'WorkoutDetails'
>;
export type WorkoutDetailsRouteProp = RouteProp<RootStackParamList, 'WorkoutDetails'>;

export type SettingsNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Settings'>;

export type OnboardingNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Onboarding'>;

export type ProgramLibraryNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'ProgramLibrary'
>;

export type ProgramPreviewNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'ProgramPreview'
>;
export type ProgramPreviewRouteProp = RouteProp<RootStackParamList, 'ProgramPreview'>;

export type TrainingVolumeNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'TrainingVolume'
>;
