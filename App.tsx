import { Component, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer, DarkTheme, useNavigationContainerRef } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { openDb } from '@/db/client';
import { RootNavigator } from '@/navigation/RootNavigator';
import { registerRestTimerNotificationNavigation } from '@/notifications/restTimerNotifications';
import { T } from '@/theme/tokens';
import type { RootStackParamList } from '@/navigation/types';

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
  const [bootState, setBootState] = useState<'booting' | 'ready' | 'error'>('booting');
  const [bootError, setBootError] = useState<Error | null>(null);
  const bootAttemptRef = useRef(0);
  const navigationRef = useNavigationContainerRef<RootStackParamList>();

  const boot = useCallback(() => {
    const bootAttempt = bootAttemptRef.current + 1;
    bootAttemptRef.current = bootAttempt;

    setBootState('booting');
    setBootError(null);

    openDb()
      .then(() => {
        if (bootAttemptRef.current === bootAttempt) setBootState('ready');
      })
      .catch((error) => {
        // eslint-disable-next-line no-console
        console.error('[db] startup failed', error);
        if (bootAttemptRef.current === bootAttempt) {
          setBootError(error instanceof Error ? error : new Error(String(error)));
          setBootState('error');
        }
      });
  }, []);

  useEffect(() => {
    boot();
    return () => {
      bootAttemptRef.current += 1;
    };
  }, [boot]);

  useEffect(() => {
    if (bootState !== 'ready') return;
    return registerRestTimerNotificationNavigation(navigationRef);
  }, [bootState, navigationRef]);

  return (
    <StartupBoundary>
      <SafeAreaProvider>
        {bootState === 'ready' ? (
          <NavigationContainer ref={navigationRef} theme={AppTheme}>
            <RootNavigator />
          </NavigationContainer>
        ) : bootState === 'error' ? (
          <StartupError error={bootError} onRetry={boot} />
        ) : (
          <StartupLoading />
        )}
        <StatusBar style="light" />
      </SafeAreaProvider>
    </StartupBoundary>
  );
}

function StartupLoading() {
  return (
    <View style={styles.startupFallback}>
      <Text style={styles.startupTitle}>Starting Set</Text>
      <Text style={styles.startupBody}>Preparing your workout log.</Text>
    </View>
  );
}

function StartupError({ error, onRetry }: { error: Error | null; onRetry: () => void }) {
  return (
    <View style={styles.startupFallback}>
      <Text style={styles.startupTitle}>Set could not start</Text>
      <Text style={styles.startupBody}>
        {error?.message ? 'Database setup failed. Try again.' : 'Try again to reopen your log.'}
      </Text>
      <Pressable style={styles.retryButton} onPress={onRetry}>
        <Text style={styles.retryButtonText}>Try Again</Text>
      </Pressable>
    </View>
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
  retryButton: {
    marginTop: 18,
    minHeight: 44,
    minWidth: 112,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: T.accent,
    paddingHorizontal: 18,
  },
  retryButtonText: {
    color: '#0a0a0a',
    fontSize: 14,
    fontWeight: '700',
  },
});
