import { useCallback, useEffect, useRef, useState } from 'react';
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
import { calculateEstimated1RM } from '@/domain/prs';
import type { NextTimePreview } from '@/domain/nextTimePreview';
import { formatWorkoutVolumeKg } from '@/domain/volume';
import { T } from '@/theme/tokens';
import type {
  EndWorkoutSummaryNavigationProp,
  EndWorkoutSummaryRouteProp,
} from '@/navigation/types';
import type { ExercisePRWithExercise } from '@/db/repositories/prs.repo';

export interface BestLift {
  exerciseName: string;
  weight: number;
  reps: number;
  unit: string;
  estimated1RM: number;
}

export interface GroupedPRRow {
  key: string;
  label: string;
  detail: string | null;
}

export interface GroupedExercisePRs {
  exerciseId: string;
  exerciseName: string;
  rows: GroupedPRRow[];
}

function formatCompactVolume(volume: number): string {
  if (volume >= 1000) {
    const compact = Math.round((volume / 1000) * 10) / 10;
    return compact % 1 === 0 ? `${compact.toFixed(0)}k` : `${compact.toFixed(1)}k`;
  }
  return String(Math.round(volume));
}

function formatLoad(value: number, unit: string): string {
  const rounded = Math.round(value * 10) / 10;
  const formatted = rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1);
  return `${formatted}${unit}`;
}

function formatPRDetail(pr: ExercisePRWithExercise): string | null {
  if (pr.record_type === 'rep_max') {
    return pr.weight !== null && pr.reps !== null
      ? `${formatLoad(pr.weight, pr.unit)} x ${pr.reps}`
      : null;
  }
  if (pr.record_type === 'estimated_1rm') return formatLoad(pr.value, pr.unit);
  return formatWorkoutVolumeKg(pr.value);
}

function getPRLabel(pr: ExercisePRWithExercise): string {
  if (pr.record_type === 'rep_max') return pr.reps === 1 ? 'Weight PR' : 'Rep PR';
  if (pr.record_type === 'estimated_1rm') return 'Estimated 1RM PR';
  return 'Volume PR';
}

function isEligibleBestLiftSet(
  set: WorkoutSummarySet,
): set is WorkoutSummarySet & { weight: number; reps: number } {
  return (
    (set.deleted_at ?? null) === null &&
    (set.set_type ?? 'working') !== 'warmup' &&
    (set.is_warmup ?? 0) === 0 &&
    set.weight !== null &&
    set.reps !== null &&
    set.reps > 0 &&
    set.reps <= 10
  );
}

export function getBestLift(summary: WorkoutSummary): BestLift | null {
  let best:
    | (BestLift & {
        loggedAt: number;
        position: number;
      })
    | null = null;

  for (const exercise of summary.exercises) {
    for (const set of exercise.sets) {
      if (!isEligibleBestLiftSet(set)) continue;
      const estimated1RM = calculateEstimated1RM(set.weight, set.reps);
      if (estimated1RM === null) continue;

      const candidate = {
        exerciseName: exercise.name,
        weight: set.weight,
        reps: set.reps,
        unit: set.unit,
        estimated1RM,
        loggedAt: set.logged_at,
        position: set.position,
      };

      if (
        !best ||
        candidate.estimated1RM > best.estimated1RM ||
        (candidate.estimated1RM === best.estimated1RM && candidate.weight > best.weight) ||
        (candidate.estimated1RM === best.estimated1RM &&
          candidate.weight === best.weight &&
          candidate.reps > best.reps) ||
        (candidate.estimated1RM === best.estimated1RM &&
          candidate.weight === best.weight &&
          candidate.reps === best.reps &&
          (candidate.loggedAt > best.loggedAt ||
            (candidate.loggedAt === best.loggedAt && candidate.position > best.position)))
      ) {
        best = candidate;
      }
    }
  }

  if (!best) return null;
  return {
    exerciseName: best.exerciseName,
    weight: best.weight,
    reps: best.reps,
    unit: best.unit,
    estimated1RM: best.estimated1RM,
  };
}

export function groupPRsByExercise(prs: ExercisePRWithExercise[]): GroupedExercisePRs[] {
  const grouped = new Map<string, GroupedExercisePRs>();

  for (const pr of prs) {
    let exerciseGroup = grouped.get(pr.exercise_id);
    if (!exerciseGroup) {
      exerciseGroup = { exerciseId: pr.exercise_id, exerciseName: pr.exercise_name, rows: [] };
      grouped.set(pr.exercise_id, exerciseGroup);
    }

    const rowKey = pr.record_type;
    const existingRow = exerciseGroup.rows.find((row) => row.key === rowKey);
    const detail = formatPRDetail(pr);
    if (!existingRow) {
      exerciseGroup.rows.push({
        key: rowKey,
        label: getPRLabel(pr),
        detail,
      });
    } else if (detail) {
      existingRow.detail = existingRow.detail ? `${existingRow.detail}, ${detail}` : detail;
    }
  }

  return [...grouped.values()];
}

function NextTimeCard({ preview }: { preview: NextTimePreview }) {
  return (
    <View style={styles.nextTimeCard} testID={`next-time-card-${preview.exerciseId}`}>
      <Text style={styles.nextTimeExercise}>{preview.exerciseName}</Text>
      <View style={styles.nextTimeRow}>
        <Text style={styles.nextTimeLabel}>Best set</Text>
        <Text style={styles.nextTimeText}>{preview.bestSetLabel}</Text>
      </View>
      <View style={styles.nextTimeRow}>
        <Text style={styles.nextTimeLabel}>Status</Text>
        <Text style={styles.nextTimeText}>{preview.status}</Text>
      </View>
      <View style={styles.nextTimeHighlight}>
        <Text style={styles.nextTimeHighlightLabel}>Next time</Text>
        <Text style={styles.nextTimeTarget}>{preview.nextTargetLabel}</Text>
      </View>
      <View style={styles.nextTimeRow}>
        <Text style={styles.nextTimeLabel}>Reason</Text>
        <Text style={styles.nextTimeText}>{preview.reason}</Text>
      </View>
    </View>
  );
}

export default function EndWorkoutSummary() {
  const navigation = useNavigation<EndWorkoutSummaryNavigationProp>();
  const route = useRoute<EndWorkoutSummaryRouteProp>();
  const { sessionId } = route.params;
  const [summary, setSummary] = useState<WorkoutSummary | null>(null);
  const [nextTimeExpanded, setNextTimeExpanded] = useState(true);
  const [isFinishing, setFinishing] = useState(false);
  const finishRequestedRef = useRef(false);
  const finishWorkout = useCallback(() => {
    if (finishRequestedRef.current) return;
    finishRequestedRef.current = true;
    setFinishing(true);
    navigation.replace('PostSessionTags', { sessionId });
  }, [navigation, sessionId]);

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

  const bestLift = getBestLift(summary);
  const groupedPRs = groupPRsByExercise(summary.prs);
  const nextTimePreviews = summary.nextTimePreviews ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>COMPLETE</Text>
            <Text style={styles.title}>Workout Complete</Text>
          </View>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Finish workout"
            disabled={isFinishing}
            hitSlop={8}
            style={[styles.topFinishBtn, isFinishing && styles.disabledBtn]}
            testID="summary-done-btn"
            onPress={finishWorkout}
          >
            {isFinishing ? (
              <ActivityIndicator color={T.accentInk} size="small" />
            ) : (
              <Text style={styles.topFinishText}>Finish</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          <View style={styles.grid}>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{summary.durationMin}</Text>
              <Text style={styles.metricLabel}>MIN</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{formatCompactVolume(summary.volume)}</Text>
              <Text style={styles.metricLabel}>KG</Text>
            </View>
            <View style={styles.metricCard}>
              <Text style={styles.metricValue}>{summary.setCount}</Text>
              <Text style={styles.metricLabel}>SETS</Text>
            </View>
            <View style={[styles.metricCard, styles.prMetricCard]}>
              <Text style={styles.metricValue}>{summary.prCount}</Text>
              <Text style={[styles.metricLabel, styles.prMetricLabel]}>PRS</Text>
            </View>
          </View>

          {bestLift && (
            <View style={styles.bestLiftCard} testID="best-lift-card">
              <Text style={styles.cardEyebrow}>BEST LIFT</Text>
              <Text style={styles.bestLiftName}>{bestLift.exerciseName}</Text>
              <View style={styles.bestLiftLoadRow}>
                <Text style={styles.bestLiftWeight}>
                  {formatLoad(bestLift.weight, bestLift.unit)}
                </Text>
                <Text style={styles.bestLiftReps}> x {bestLift.reps}</Text>
              </View>
              <Text style={styles.bestLiftEstimate}>
                Estimated 1RM: {formatLoad(bestLift.estimated1RM, bestLift.unit)}
              </Text>
            </View>
          )}

          <View style={styles.sectionBlock}>
            <Text style={styles.sectionTitle}>Personal Records</Text>
            {groupedPRs.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.noPrText}>No new PRs today.</Text>
              </View>
            ) : (
              groupedPRs.map((exercise) => (
                <View key={exercise.exerciseId} style={styles.prCard}>
                  <View style={styles.prHeader}>
                    <Text style={styles.prExerciseName}>{exercise.exerciseName}</Text>
                    {exercise.rows.length > 1 && (
                      <Text style={styles.prCount}>{exercise.rows.length} PRs</Text>
                    )}
                  </View>
                  {exercise.rows.map((row) => (
                    <View key={row.key} style={styles.prRow}>
                      <Ionicons name="checkmark" size={18} color={T.accent} />
                      <Text style={styles.prLabel}>{row.label}</Text>
                      {row.detail && <Text style={styles.prDetail}>{row.detail}</Text>}
                    </View>
                  ))}
                </View>
              ))
            )}
          </View>

          {nextTimePreviews.length > 0 && (
            <View style={styles.nextTimeSection} testID="next-time-section">
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={
                  nextTimeExpanded ? 'Collapse Next Time' : 'Expand Next Time'
                }
                hitSlop={8}
                style={styles.nextTimeHeader}
                testID="next-time-toggle"
                onPress={() => setNextTimeExpanded((expanded) => !expanded)}
              >
                <Text style={[styles.sectionTitle, styles.nextTimeTitle]}>Next Time</Text>
                <Ionicons
                  name={nextTimeExpanded ? 'chevron-up' : 'chevron-down'}
                  size={24}
                  color={T.text}
                />
              </TouchableOpacity>
              {nextTimeExpanded &&
                nextTimePreviews.map((preview) => (
                  <NextTimeCard key={preview.exerciseId} preview={preview} />
                ))}
            </View>
          )}

          <MusclesWorkedSection
            muscleSummary={summary.muscleSummary}
            title="Muscles Trained"
            collapsibleMap
            mapInitiallyExpanded={false}
          />
        </ScrollView>

        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Finish workout"
          disabled={isFinishing}
          style={[styles.primaryBtn, isFinishing && styles.disabledBtn]}
          testID="summary-finish-workout-btn"
          onPress={finishWorkout}
        >
          {isFinishing ? (
            <ActivityIndicator color={T.accentInk} />
          ) : (
            <>
              <Text style={styles.primaryText}>Finish Workout</Text>
              <Ionicons name="arrow-forward" size={20} color={T.accentInk} />
            </>
          )}
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
    gap: 16,
  },
  eyebrow: {
    fontFamily: 'Courier New',
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: T.muted,
  },
  title: { color: T.text, fontSize: 28, fontWeight: '800', marginTop: 6 },
  topFinishBtn: {
    minWidth: 86,
    height: 48,
    borderRadius: 16,
    backgroundColor: T.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  topFinishText: { color: T.accentInk, fontSize: 15, fontWeight: '900' },
  body: { flex: 1 },
  bodyContent: { paddingBottom: 22 },
  grid: { flexDirection: 'row', gap: 8, marginTop: 28 },
  metricCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  prMetricCard: { borderColor: T.accent },
  metricValue: { color: T.text, fontSize: 27, fontWeight: '900' },
  metricLabel: {
    color: T.muted,
    fontFamily: 'Courier New',
    fontSize: 11,
    textTransform: 'uppercase',
    marginTop: 5,
    fontWeight: '700',
  },
  prMetricLabel: { color: T.accent },
  bestLiftCard: {
    marginTop: 22,
    borderWidth: 1,
    borderColor: T.accent,
    borderRadius: 18,
    backgroundColor: T.surface,
    padding: 18,
  },
  cardEyebrow: {
    color: T.muted,
    fontFamily: 'Courier New',
    fontSize: 12,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 20,
  },
  bestLiftName: { color: T.text, fontSize: 23, fontWeight: '900' },
  bestLiftLoadRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 24 },
  bestLiftWeight: { color: T.accent, fontSize: 44, fontWeight: '900', lineHeight: 50 },
  bestLiftReps: { color: T.textDim, fontSize: 28, fontWeight: '800', lineHeight: 42 },
  bestLiftEstimate: { color: T.muted, fontSize: 18, fontWeight: '700', marginTop: 8 },
  sectionBlock: { marginTop: 28 },
  sectionTitle: { color: T.text, fontSize: 23, fontWeight: '900', marginBottom: 12 },
  prCard: {
    borderWidth: 1,
    borderColor: T.accent,
    borderRadius: 14,
    backgroundColor: T.surface,
    padding: 16,
    marginBottom: 12,
  },
  prHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  prExerciseName: { flex: 1, color: T.text, fontSize: 20, fontWeight: '900' },
  prCount: { color: T.accent, fontSize: 12, fontWeight: '900', textTransform: 'uppercase' },
  prRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  prLabel: { color: T.textDim, fontSize: 17, fontWeight: '800' },
  prDetail: {
    flex: 1,
    color: T.muted,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
  },
  emptyCard: {
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 14,
    backgroundColor: T.surface,
    padding: 16,
  },
  noPrText: { color: T.textDim, fontSize: 13 },
  nextTimeSection: { marginTop: 28 },
  nextTimeTitle: { marginBottom: 0 },
  nextTimeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  nextTimeCard: {
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 14,
    backgroundColor: T.surface,
    padding: 16,
    marginBottom: 12,
  },
  nextTimeExercise: { color: T.text, fontSize: 21, fontWeight: '900', marginBottom: 14 },
  nextTimeRow: { marginTop: 10 },
  nextTimeLabel: {
    color: T.muted,
    fontFamily: 'Courier New',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  nextTimeText: { color: T.textDim, fontSize: 17, fontWeight: '700', lineHeight: 23 },
  nextTimeHighlight: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: T.border,
    paddingVertical: 12,
    marginTop: 14,
  },
  nextTimeHighlightLabel: {
    color: T.accent,
    fontFamily: 'Courier New',
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  nextTimeTarget: { color: T.text, fontSize: 24, fontWeight: '900', lineHeight: 30 },
  primaryBtn: {
    marginTop: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: T.accent,
    borderRadius: 16,
    paddingVertical: 16,
    minHeight: 58,
  },
  primaryText: { color: T.accentInk, fontSize: 16, fontWeight: '800' },
  disabledBtn: { opacity: 0.68 },
});
