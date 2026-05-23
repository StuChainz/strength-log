import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import Home from '@/screens/Home';
import ExerciseLibrary from '@/screens/ExerciseLibrary';
import ExerciseEdit from '@/screens/ExerciseEdit';
import TemplateList from '@/screens/TemplateList';
import TemplateBuilder from '@/screens/TemplateBuilder';
import LiveWorkout from '@/screens/LiveWorkout';
import EndWorkoutSummary from '@/screens/EndWorkoutSummary';
import PostSessionTags from '@/screens/PostSessionTags';
import Settings from '@/screens/Settings';
import Insights from '@/screens/Insights';
import { T } from '@/theme/tokens';
import type { RootStackParamList, MainTabParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: 'rgba(10,10,10,0.96)',
          borderTopColor: T.border,
          borderTopWidth: 1,
          paddingBottom: 0,
          height: 60,
        },
        tabBarActiveTintColor: T.text,
        tabBarInactiveTintColor: T.muted,
        tabBarLabelStyle: {
          fontFamily: 'Courier New',
          fontSize: 10,
          letterSpacing: 0.3,
          fontWeight: '500',
          marginBottom: 6,
        },
        tabBarIconStyle: { marginTop: 4 },
      }}
    >
      <Tab.Screen
        name="Home"
        component={Home}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Templates"
        component={TemplateList}
        options={{
          tabBarLabel: 'Programmes',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="list-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Library"
        component={ExerciseLibrary}
        options={{
          tabBarLabel: 'Library',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="library-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Insights"
        component={Insights}
        options={{
          tabBarLabel: 'Insights',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="sparkles-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={MainTabs} />
      <Stack.Screen name="LiveWorkout" component={LiveWorkout} />
      <Stack.Screen name="EndWorkoutSummary" component={EndWorkoutSummary} />
      <Stack.Screen name="PostSessionTags" component={PostSessionTags} />
      <Stack.Screen name="Settings" component={Settings} />
      <Stack.Screen
        name="TemplateBuilder"
        component={TemplateBuilder}
        options={({ route }) => ({
          headerShown: true,
          title: route.params?.templateId ? 'Edit Template' : 'New Template',
          headerStyle: { backgroundColor: T.surface },
          headerTintColor: T.text,
          headerTitleStyle: { fontWeight: '600' },
        })}
      />
      <Stack.Screen
        name="ExerciseEdit"
        component={ExerciseEdit}
        options={({ route }) => ({
          headerShown: true,
          title: route.params?.exerciseId ? 'Edit Exercise' : 'New Exercise',
          headerStyle: { backgroundColor: T.surface },
          headerTintColor: T.text,
          headerTitleStyle: { fontWeight: '600' },
        })}
      />
    </Stack.Navigator>
  );
}
