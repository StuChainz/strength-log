import { Component, type ReactNode, useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { openDb } from '@/db/client';
import { RootNavigator } from '@/navigation/RootNavigator';
import { T } from '@/theme/tokens';

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

interface StartupBoundaryState {
  error: Error | null;
}

class StartupBoundary extends Component<{ children: ReactNode }, StartupBoundaryState> {
  state: StartupBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): StartupBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error('[startup] render failed', error);
  }

  render() {
    if (this.state.error) {
      return (
        <View style={styles.startupFallback}>
          <Text style={styles.startupTitle}>Set could not start</Text>
          <Text style={styles.startupBody}>
            Close and reopen the app. If this keeps happening, send beta feedback from
            TestFlight.
          </Text>
        </View>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  useEffect(() => {
    openDb().catch((error) => {
      // eslint-disable-next-line no-console
      console.error('[db] openDb startup failed', error);
    });
  }, []);

  return (
    <StartupBoundary>
      <SafeAreaProvider>
        <NavigationContainer theme={AppTheme}>
          <RootNavigator />
        </NavigationContainer>
        <StatusBar style="light" />
      </SafeAreaProvider>
    </StartupBoundary>
  );
}

const styles = StyleSheet.create({
  startupFallback: {
    flex: 1,
    backgroundColor: T.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  startupTitle: {
    color: T.text,
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
  },
  startupBody: {
    color: T.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
    textAlign: 'center',
  },
});
