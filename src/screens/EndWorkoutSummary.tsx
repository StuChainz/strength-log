import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import MusclesWorkedSection from '@/components/MusclesWorkedSection';
import { openDb } from '@/db/client';
import { getWorkoutSummary, type WorkoutSummary } from '@/db/repositories/sessionSummary.repo';
import { formatWorkoutVolumeKg } from '@/domain/volume';
import { T } from '@/theme/tokens';
import type {
  EndWorkoutSummaryNavigationProp,
  EndWorkoutSummaryRouteProp,
} from '@/navigation/types';
import type { ExercisePRWithExercise } from '@/db/repositories/prs.repo';

function formatPR(pr: ExercisePRWithExercise): string {
  if (pr.record_type === 'rep_max') {
    return `${pr.exercise_name}: ${pr.weight ?? pr.value}${pr.unit} × ${pr.reps ?? '—'} rep PR`;
  }
  if (pr.record_type === 'estimated_1rm') {
    return `${pr.exercise_name}: ${pr.value.toFixed(1)}${pr.unit} estimated 1RM`;
  }
  return `${pr.exercise_name}: ${formatWorkoutVolumeKg(pr.value)} session volume`;
}

export default function EndWorkoutSummary() {
  const navigation = useNavigation<EndWorkoutSummaryNavigationProp>();
  const route = useRoute<EndWorkoutSummaryRouteProp>();
  const { sessionId } = route.params;
  const [summary, setSummary] = useState<WorkoutSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    openDb()
      .then((db) => getWorkoutSummary(db, sessionId))
      .then((next) => {
        if (!cancelled) setSummary(next);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (!summary) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]} edges={['top']}>
        <ActivityIndicator color={T.accent} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>Complete</Text>
            <Text style={styles.title}>Workout Summary</Text>
          </View>
          <View style={styles.doneIcon}>
            <Ionicons name="checkmark" size={22} color={T.accentInk} />
          </View>
        </View>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          <View style={styles.grid}>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{summary.setCount}</Text>
              <Text style={styles.metricLabel}>sets</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{formatWorkoutVolumeKg(summary.volume)}</Text>
              <Text style={styles.metricLabel}>volume</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{summary.durationMin}</Text>
              <Text style={styles.metricLabel}>minutes</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{summary.prCount}</Text>
              <Text style={styles.metricLabel}>PRs</Text>
            </View>
          </View>

          <MusclesWorkedSection muscleSummary={summary.muscleSummary} />

          <View style={styles.prBlock}>
            <Text style={styles.sectionLabel}>NEW PRs</Text>
            {summary.prs.length === 0 ? (
              <Text style={styles.noPrText}>No new PRs</Text>
            ) : (
              summary.prs.map((pr) => (
                <View key={pr.id} style={styles.prRow}>
                  <Ionicons name="sparkles-outline" size={14} color={T.accent} />
                  <Text style={styles.prText}>{formatPR(pr)}</Text>
                </View>
              ))
            )}
          </View>
        </ScrollView>

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => navigation.replace('PostSessionTags', { sessionId })}
        >
          <Text style={styles.primaryText}>Continue</Text>
          <Ionicons name="arrow-forward" size={18} color={T.accentInk} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, paddingHorizontal: 22, paddingTop: 18, paddingBottom: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eyebrow: {
    fontFamily: 'Courier New',
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: T.muted,
  },
  title: { color: T.text, fontSize: 28, fontWeight: '700', marginTop: 4 },
  doneIcon: {
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: T.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1 },
  bodyContent: { paddingBottom: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 28 },
  metricCard: {
    width: '48%',
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 12,
    padding: 16,
  },
  metricValue: { color: T.text, fontFamily: 'Courier New', fontSize: 28 },
  metricLabel: {
    color: T.muted,
    fontFamily: 'Courier New',
    fontSize: 11,
    textTransform: 'uppercase',
    marginTop: 5,
  },
  prBlock: {
    marginTop: 22,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 12,
    backgroundColor: T.surface,
    padding: 14,
  },
  sectionLabel: {
    color: T.muted,
    fontFamily: 'Courier New',
    fontSize: 11,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  prRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 7 },
  prText: { flex: 1, color: T.text, fontSize: 13, lineHeight: 18 },
  noPrText: { color: T.textDim, fontSize: 13 },
  primaryBtn: {
    marginTop: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: T.accent,
    borderRadius: 16,
    paddingVertical: 16,
  },
  primaryText: { color: T.accentInk, fontSize: 16, fontWeight: '800' },
});
