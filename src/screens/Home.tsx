import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { openDb } from '@/db/client';
import { getExerciseCount } from '@/db/repositories/exercises.repo';

export default function Home() {
  const [exerciseCount, setExerciseCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    openDb()
      .then((db) => getExerciseCount(db))
      .then((count) => {
        if (!cancelled) setExerciseCount(count);
      })
      .catch(() => {
        // Silently ignore — native SQLite unavailable in some environments.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Strength Log</Text>
      {exerciseCount !== null && (
        <Text style={styles.debug} testID="exercise-count">
          {exerciseCount} exercises loaded
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#f5f5f5',
    letterSpacing: 0.5,
  },
  debug: {
    marginTop: 12,
    fontSize: 13,
    color: '#555',
  },
});
