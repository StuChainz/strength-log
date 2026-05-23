import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { openDb } from '@/db/client';
import { getExerciseCount } from '@/db/repositories/exercises.repo';
import type { HomeNavigationProp } from '@/navigation/types';

export default function Home() {
  const navigation = useNavigation<HomeNavigationProp>();
  const [exerciseCount, setExerciseCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    openDb()
      .then((db) => getExerciseCount(db))
      .then((count) => {
        if (!cancelled) setExerciseCount(count);
      })
      .catch(() => {});
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

      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('ExerciseLibrary')}
        testID="nav-exercise-library"
      >
        <Text style={styles.buttonText}>Exercise Library</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#f5f5f5',
    letterSpacing: 0.5,
  },
  debug: {
    fontSize: 13,
    color: '#555',
  },
  button: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#7c5cfc',
    borderRadius: 10,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
});
