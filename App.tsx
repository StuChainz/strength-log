import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
  const [startupError, setStartupError] = useState<string | null>(null);

  useEffect(() => {
    openDb().catch((error) => {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.error('[db] openDb startup failed', error);
        setStartupError(error instanceof Error ? error.message : String(error));
      }
    });
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={AppTheme}>
        <RootNavigator />
      </NavigationContainer>
      {__DEV__ && startupError ? (
        <View style={styles.devError} testID="app-startup-error">
          <Text style={styles.devErrorText}>Database startup failed: {startupError}</Text>
        </View>
      ) : null}
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  devError: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 18,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#7f1d1d',
    backgroundColor: '#2a0d0d',
  },
  devErrorText: {
    color: '#fecaca',
    fontSize: 12,
    fontFamily: 'Courier New',
  },
});
