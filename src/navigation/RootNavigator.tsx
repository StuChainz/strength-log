import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Home from '@/screens/Home';
import ExerciseLibrary from '@/screens/ExerciseLibrary';
import ExerciseEdit from '@/screens/ExerciseEdit';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

const HEADER_STYLE = {
  headerStyle: { backgroundColor: '#111111' },
  headerTintColor: '#f5f5f5',
  headerTitleStyle: { fontWeight: '600' as const },
};

export function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={HEADER_STYLE}>
      <Stack.Screen name="Home" component={Home} options={{ title: 'Strength Log' }} />
      <Stack.Screen
        name="ExerciseLibrary"
        component={ExerciseLibrary}
        options={{ title: 'Exercises' }}
      />
      <Stack.Screen
        name="ExerciseEdit"
        component={ExerciseEdit}
        options={({ route }) => ({
          title: route.params?.exerciseId ? 'Edit Exercise' : 'New Exercise',
        })}
      />
    </Stack.Navigator>
  );
}
