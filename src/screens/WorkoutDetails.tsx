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
import {
  getWorkoutSummary,
  type WorkoutSummary,
  type WorkoutSummarySet,
} from '@/db/repositories/sessionSummary.repo';
import { formatWorkoutVolumeKg } from '@/domain/volume';
import { T } from '@/theme/tokens';
import type { WorkoutDetailsNavigationProp, WorkoutDetailsRouteProp } from '@/navigation/types';
import type { ExercisePRWithExercise } from '@/db/repositories/prs.repo';

function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatSet(set: WorkoutSummarySet): string {
  const load =
    set.weight !== null && set.reps !== null
      ? `${set.weight} ${set.unit} × ${set.reps}`
      : set.reps !== null
        ? `${set.reps} reps`
        : set.weight !== null
          ? `${set.weight} ${set.unit}`
          : 'Not logged';
  const rpe = set.rpe !== null ? ` · RPE ${set.rpe}` : '';
  const type = set.set_type === 'working' ? '' : ` · ${set.set_type}`;
  return `${load}${rpe}${type}`;
}

function formatPR(pr: ExercisePRWithExercise): string {
  if (pr.record_type === 'rep_max') {
    return `${pr.exercise_name}: ${pr.weight ?? pr.value}${pr.unit} × ${pr.reps ?? '—'} rep PR`;
  }
  if (pr.record_type === 'estimated_1rm') {
    return `${pr.exercise_name}: ${pr.value.toFixed(1)}${pr.unit} estimated 1RM`;
  }
  return `${pr.exercise_name}: ${formatWorkoutVolumeKg(pr.value)} session volume`;
}

function tagLabel(tag: string): string {
  return tag.replace(/_/g, ' ');
}

export default function WorkoutDetails() {
  const navigation = useNavigation<WorkoutDetailsNavigationProp>();
  const route = useRoute<WorkoutDetailsRouteProp>();
  const { sessionId } = route.params;
  const [summary, setSummary] = useState<WorkoutSummary | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    openDb()
      .then((db) => getWorkoutSummary(db, sessionId))
      .then((next) => {
        if (!cancelled) setSummary(next);
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (!loaded) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]} edges={['top']}>
        <ActivityIndicator color={T.accent} />
      </SafeAreaView>
    );
  }

  if (!summary) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]} edges={['top']}>
        <Text style={styles.emptyTitle}>Workout not found</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={16} color={T.accentInk} />
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const sessionName = summary.session.name ?? 'Workout';
  const hasNotes =
    summary.tags.length > 0 || Boolean(summary.note?.note) || summary.note?.energy_rating != null;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.goBack()} hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={T.textDim} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>Workout Details</Text>
          <Text style={styles.title} numberOfLines={2}>
            {sessionName}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <View style={styles.metaBlock}>
          <Text style={styles.metaText}>{formatDateTime(summary.session.started_at)}</Text>
          <Text style={styles.metaText}>{summary.durationMin} min</Text>
        </View>

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
            <Text style={styles.metricValue}>{summary.prCount}</Text>
            <Text style={styles.metricLabel}>PRs</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Exercises</Text>
          {summary.exercises.length === 0 ? (
            <View style={styles.emptyCard} testID="workout-details-empty-sets">
              <Text style={styles.emptyText}>No logged sets for this workout.</Text>
            </View>
          ) : (
            summary.exercises.map((exercise) => (
              <View key={exercise.exerciseId} style={styles.exerciseCard}>
                <View style={styles.exerciseHeader}>
                  <Text style={styles.exerciseName}>{exercise.name}</Text>
                  <Text style={styles.exerciseVolume}>
                    {formatWorkoutVolumeKg(exercise.volume)}
                  </Text>
                </View>
                {exercise.sets.map((set, index) => (
                  <View key={set.id} style={styles.setRow}>
                    <Text style={styles.setIndex}>{index + 1}</Text>
                    <Text style={styles.setText}>{formatSet(set)}</Text>
                  </View>
                ))}
              </View>
            ))
          )}
        </View>

        <MusclesWorkedSection muscleSummary={summary.muscleSummary} />

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>PRs</Text>
          {summary.prs.length === 0 ? (
            <Text style={styles.subtleText}>No PRs recorded.</Text>
          ) : (
            summary.prs.map((pr) => (
              <View key={pr.id} style={styles.prRow}>
                <Ionicons name="sparkles-outline" size={14} color={T.accent} />
                <Text style={styles.prText}>{formatPR(pr)}</Text>
              </View>
            ))
          )}
        </View>

        {hasNotes && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Notes</Text>
            {summary.note?.energy_rating !== null && summary.note?.energy_rating !== undefined && (
              <Text style={styles.noteText}>Energy {summary.note.energy_rating}/10</Text>
            )}
            {summary.tags.length > 0 && (
              <Text style={styles.noteText}>{summary.tags.map(tagLabel).join(' · ')}</Text>
            )}
            {summary.note?.note && <Text style={styles.noteText}>{summary.note.note}</Text>}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  center: { alignItems: 'center', justifyContent: 'center', padding: 22 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 12,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: T.surface2,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1, minWidth: 0 },
  eyebrow: {
    fontFamily: 'Courier New',
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: T.muted,
  },
  title: { color: T.text, fontSize: 26, fontWeight: '700', marginTop: 3 },
  body: { flex: 1 },
  bodyContent: { paddingHorizontal: 22, paddingBottom: 24 },
  metaBlock: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginTop: 4 },
  metaText: { color: T.muted, fontFamily: 'Courier New', fontSize: 12 },
  grid: { flexDirection: 'row', gap: 10, marginTop: 20 },
  metricCard: {
    flex: 1,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 12,
    padding: 13,
  },
  metricValue: { color: T.text, fontFamily: 'Courier New', fontSize: 22 },
  metricLabel: {
    color: T.muted,
    fontFamily: 'Courier New',
    fontSize: 10.5,
    textTransform: 'uppercase',
    marginTop: 5,
  },
  section: { marginTop: 22 },
  sectionLabel: {
    color: T.muted,
    fontFamily: 'Courier New',
    fontSize: 11,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  exerciseCard: {
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  exerciseName: { flex: 1, color: T.text, fontSize: 15, fontWeight: '700' },
  exerciseVolume: { color: T.textDim, fontFamily: 'Courier New', fontSize: 12 },
  setRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  setIndex: {
    width: 22,
    color: T.muted,
    fontFamily: 'Courier New',
    fontSize: 12,
  },
  setText: { flex: 1, color: T.text, fontFamily: 'Courier New', fontSize: 12 },
  emptyCard: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: T.border,
    borderRadius: 12,
    padding: 16,
  },
  emptyTitle: { color: T.text, fontSize: 18, fontWeight: '700', marginBottom: 14 },
  emptyText: { color: T.muted, fontSize: 13 },
  subtleText: { color: T.textDim, fontSize: 13 },
  prRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 7 },
  prText: { flex: 1, color: T.text, fontSize: 13, lineHeight: 18 },
  noteText: { color: T.text, fontSize: 13, lineHeight: 19, marginTop: 4 },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: T.accent,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtnText: { color: T.accentInk, fontSize: 14, fontWeight: '800' },
});
