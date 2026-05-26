import { useEffect } from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { openDb } from '@/db/client';
import { RootNavigator } from '@/navigation/RootNavigator';

const AppTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: '#7c5cfc',
    background: '#0a0a0a',
    card: '#111111',
    text: '#f5f5f5',
    border: '#2a2a2a',
  },
};

export default function App() {
  useEffect(() => {
    openDb().catch((error) => {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.error('[db] openDb startup failed', error);
      }
    });
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={AppTheme}>
        <RootNavigator />
      </NavigationContainer>
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}
