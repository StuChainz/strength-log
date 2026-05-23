import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

export type RootStackParamList = {
  Home: undefined;
  ExerciseLibrary: undefined;
  /** exerciseId = edit mode; omitted = create mode */
  ExerciseEdit: { exerciseId?: string };
};

export type HomeNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;
export type ExerciseLibraryNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'ExerciseLibrary'
>;
export type ExerciseEditNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'ExerciseEdit'
>;
export type ExerciseEditRouteProp = RouteProp<RootStackParamList, 'ExerciseEdit'>;
