import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { openDb } from '@/db/client';
import { getTrainingDashboardData } from '@/db/repositories/trainingDashboard.repo';
import {
  buildHeatmapWeeks,
  buildRecentWorkoutDisplayModels,
  calculateConsistencySummary,
  calculateWeeklySnapshot,
  getLocalDateKey,
  getSessionsForDate,
  parseLocalDateKey,
  type TrainingDashboardSession,
} from '@/domain/trainingDashboard';
import { formatWorkoutVolumeKg } from '@/domain/volume';
import { T } from '@/theme/tokens';
import type { TrainingDashboardNavigationProp } from '@/navigation/types';

function pluralize(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? '' : 's'}`;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });
}

function formatDateLong(dateKey: string): string {
  return parseLocalDateKey(dateKey).toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatDuration(durationMin: number | null): string {
  return durationMin === null ? '—' : `${durationMin}m`;
}

function formatEnergy(value: number | null): string {
  return value === null ? '—' : `${Math.round(value * 10) / 10}/10`;
}

function formatAverageEnergy(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(1)}/10`;
}

function workoutTitle(session: TrainingDashboardSession): string {
  return session.name ?? session.templateName ?? 'Workout';
}

function heatColor(intensity: number, selected: boolean): string {
  if (selected) return T.accent;
  if (intensity <= 0) return T.surface3;
  const alpha = 0.22 + intensity * 0.58;
  return `rgba(15, 199, 118, ${alpha.toFixed(2)})`;
}

function MetricCard({ label, value, subtext }: { label: string; value: string; subtext?: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.metricLabel}>{label}</Text>
      {subtext ? <Text style={styles.metricSubtext}>{subtext}</Text> : null}
    </View>
  );
}

function WorkoutRow({
  session,
  onPress,
  testID,
}: {
  session: TrainingDashboardSession;
  onPress: () => void;
  testID: string;
}) {
  return (
    <TouchableOpacity
      style={styles.workoutRow}
      activeOpacity={0.84}
      onPress={onPress}
      testID={testID}
    >
      <View style={styles.workoutTop}>
        <View style={styles.workoutTitleWrap}>
          <Text style={styles.workoutName} numberOfLines={1}>
            {workoutTitle(session)}
          </Text>
          <Text style={styles.workoutDate}>{formatDate(session.completedAt)}</Text>
        </View>
        <Ionicons name="chevron-forward" size={17} color={T.muted} />
      </View>
      <View style={styles.workoutStats}>
        <Text style={styles.workoutStat}>{formatDuration(session.durationMin)}</Text>
        <Text style={styles.workoutStat}>{pluralize(session.setCount, 'set')}</Text>
        <Text style={styles.workoutStat}>{formatWorkoutVolumeKg(session.totalVolume)}</Text>
        <Text style={styles.workoutStat}>{pluralize(session.prCount, 'PR')}</Text>
        {session.energyRating !== null ? (
          <Text style={styles.workoutStat}>Energy {formatEnergy(session.energyRating)}</Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export default function TrainingDashboard() {
  const navigation = useNavigation<TrainingDashboardNavigationProp>();
  const [sessions, setSessions] = useState<TrainingDashboardSession[]>([]);
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(Date.now);

  const load = useCallback(async () => {
    setLoaded(false);
    const db = await openDb();
    const loadedAt = Date.now();
    const data = await getTrainingDashboardData(db);
    setSessions(data.sessions);
    setNow(loadedAt);
    setLoaded(true);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    if (selectedDateKey !== null || sessions.length === 0) return;
    setSelectedDateKey(getLocalDateKey(sessions[0]!.completedAt));
  }, [selectedDateKey, sessions]);

  const heatmapWeeks = useMemo(() => buildHeatmapWeeks(sessions, { now }), [sessions, now]);
  const selectedWorkouts = useMemo(
    () => (selectedDateKey ? getSessionsForDate(sessions, selectedDateKey) : []),
    [selectedDateKey, sessions],
  );
  const recentWorkouts = useMemo(() => buildRecentWorkoutDisplayModels(sessions, 8), [sessions]);
  const weeklySnapshot = useMemo(() => calculateWeeklySnapshot(sessions, now), [sessions, now]);
  const consistency = useMemo(() => calculateConsistencySummary(sessions, now), [sessions, now]);

  const openWorkout = (sessionId: string) => {
    navigation.navigate('WorkoutDetails', { sessionId });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <TouchableOpacity
          style={styles.backBtn}
          activeOpacity={0.82}
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
              return;
            }
            navigation.navigate('Main', { screen: 'Home' });
          }}
          testID="training-dashboard-back-btn"
        >
          <Ionicons name="arrow-back" size={17} color={T.text} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.eyebrow}>Training Log</Text>
        <Text style={styles.title}>Training Calendar</Text>

        {!loaded ? (
          <View style={styles.loading}>
            <ActivityIndicator color={T.accent} />
          </View>
        ) : sessions.length === 0 ? (
          <View style={styles.empty} testID="training-dashboard-empty">
            <Text style={styles.emptyText}>
              No completed workouts yet. Finish a workout and it’ll appear here.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Calendar</Text>
              <View style={styles.heatmap} testID="training-dashboard-heatmap">
                {heatmapWeeks.map((week, weekIndex) => (
                  <View key={`week-${weekIndex}`} style={styles.heatmapWeek}>
                    {week.map((day) => {
                      const selected = day.dateKey === selectedDateKey;
                      return (
                        <TouchableOpacity
                          key={day.dateKey}
                          activeOpacity={0.82}
                          style={[
                            styles.heatmapDay,
                            {
                              opacity: day.inRange ? 1 : 0.3,
                              backgroundColor: heatColor(day.intensity, selected),
                              borderColor: selected ? T.text : 'transparent',
                            },
                          ]}
                          onPress={() => setSelectedDateKey(day.dateKey)}
                          accessibilityLabel={`${formatDateLong(day.dateKey)}, ${pluralize(
                            day.sessionCount,
                            'workout',
                          )}`}
                          testID={`calendar-day-${day.dateKey}`}
                        />
                      );
                    })}
                  </View>
                ))}
              </View>

              {selectedDateKey && (
                <View style={styles.selectedDay} testID="training-dashboard-selected-day">
                  <Text style={styles.selectedDayTitle}>{formatDateLong(selectedDateKey)}</Text>
                  {selectedWorkouts.length === 0 ? (
                    <Text style={styles.selectedDayEmpty}>No completed workouts on this date.</Text>
                  ) : (
                    <View style={styles.selectedWorkoutList}>
                      {selectedWorkouts.map((session) => (
                        <TouchableOpacity
                          key={session.id}
                          style={styles.selectedWorkout}
                          activeOpacity={0.84}
                          onPress={() => openWorkout(session.id)}
                          testID={`selected-day-workout-${session.id}`}
                        >
                          <Text style={styles.selectedWorkoutName}>{workoutTitle(session)}</Text>
                          <Text style={styles.selectedWorkoutMeta}>
                            {formatDuration(session.durationMin)} ·{' '}
                            {pluralize(session.setCount, 'set')} ·{' '}
                            {formatWorkoutVolumeKg(session.totalVolume)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>This Week</Text>
              <View style={styles.metricGrid}>
                <MetricCard
                  label="Sessions"
                  value={String(weeklySnapshot.sessionsCompleted)}
                  subtext={
                    weeklySnapshot.previousWeek
                      ? `Prev ${weeklySnapshot.previousWeek.sessionsCompleted}`
                      : undefined
                  }
                />
                <MetricCard label="Sets" value={String(weeklySnapshot.totalSets)} />
                <MetricCard
                  label="Volume"
                  value={formatWorkoutVolumeKg(weeklySnapshot.totalVolume)}
                  subtext={
                    weeklySnapshot.previousWeek
                      ? `Prev ${formatWorkoutVolumeKg(weeklySnapshot.previousWeek.totalVolume)}`
                      : undefined
                  }
                />
                <MetricCard label="PRs" value={String(weeklySnapshot.prCount)} />
                <MetricCard
                  label="Avg Energy"
                  value={formatAverageEnergy(weeklySnapshot.averageEnergy)}
                />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Consistency</Text>
              <View style={styles.metricGrid}>
                <MetricCard
                  label="Current Streak"
                  value={pluralize(consistency.currentStreak, 'day')}
                />
                <MetricCard
                  label="Longest Streak"
                  value={pluralize(consistency.longestStreak, 'day')}
                />
                <MetricCard label="Last 7 Days" value={String(consistency.workoutsLast7Days)} />
                <MetricCard label="Last 30 Days" value={String(consistency.workoutsLast30Days)} />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Recent Workouts</Text>
              <View style={styles.recentList}>
                {recentWorkouts.map((session) => (
                  <WorkoutRow
                    key={session.id}
                    session={session}
                    onPress={() => openWorkout(session.id)}
                    testID={`training-dashboard-workout-${session.id}`}
                  />
                ))}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  container: { flex: 1, backgroundColor: T.bg },
  content: { padding: 22, paddingTop: 16, paddingBottom: 28 },
  loading: { paddingVertical: 38 },
  backBtn: {
    alignSelf: 'flex-start',
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: 18,
  },
  backText: { color: T.text, fontSize: 13, fontWeight: '600' },
  eyebrow: {
    fontFamily: 'Courier New',
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: T.muted,
    fontWeight: '500',
  },
  title: { color: T.text, fontSize: 28, fontWeight: '700', marginTop: 4 },
  section: { marginTop: 22 },
  sectionLabel: {
    color: T.muted,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  empty: {
    marginTop: 28,
    minHeight: 90,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.surface,
    padding: 18,
    justifyContent: 'center',
  },
  emptyText: { color: T.textDim, fontSize: 15, lineHeight: 21 },
  heatmap: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    gap: 5,
    paddingVertical: 4,
  },
  heatmapWeek: { gap: 5 },
  heatmapDay: {
    width: 19,
    height: 19,
    borderRadius: 4,
    borderWidth: 1,
  },
  selectedDay: {
    marginTop: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.surface,
    padding: 14,
  },
  selectedDayTitle: { color: T.text, fontSize: 15, fontWeight: '800' },
  selectedDayEmpty: { color: T.muted, fontSize: 13, marginTop: 8 },
  selectedWorkoutList: { marginTop: 10, gap: 8 },
  selectedWorkout: {
    borderRadius: 8,
    backgroundColor: T.surface2,
    paddingHorizontal: 11,
    paddingVertical: 10,
  },
  selectedWorkoutName: { color: T.text, fontSize: 14, fontWeight: '800' },
  selectedWorkoutMeta: { color: T.muted, fontSize: 12, marginTop: 4 },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    width: '48.4%',
    minHeight: 86,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.surface,
    paddingHorizontal: 13,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  metricValue: { color: T.text, fontSize: 22, fontWeight: '800' },
  metricLabel: { color: T.muted, fontSize: 11, fontWeight: '800', marginTop: 5 },
  metricSubtext: { color: T.mutedDeep, fontSize: 11, marginTop: 5 },
  recentList: { gap: 10 },
  workoutRow: {
    minHeight: 92,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  workoutTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  workoutTitleWrap: { flex: 1, minWidth: 0 },
  workoutName: { color: T.text, fontSize: 15, fontWeight: '800' },
  workoutDate: { color: T.muted, fontSize: 12, marginTop: 3 },
  workoutStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  workoutStat: {
    color: T.textDim,
    fontFamily: 'Courier New',
    fontSize: 11.5,
    backgroundColor: T.surface2,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
});
