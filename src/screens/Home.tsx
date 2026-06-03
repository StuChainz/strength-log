import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { openDb } from '@/db/client';
import { getNormalTemplatesWithCount, type TemplateSummary } from '@/db/repositories/templates.repo';
import {
  discardSession,
  getSessionRecovery,
  type SessionRecovery,
} from '@/db/repositories/sessions.repo';
import { getUntaggedCompletedSession } from '@/db/repositories/tags.repo';
import {
  getTrainingVolumeReport,
  TRAINING_VOLUME_WINDOWS,
  type TrainingVolumeReport,
} from '@/db/repositories/trainingVolume.repo';
import { MUSCLE_LABELS } from '@/domain/muscleLabels';
import {
  calculateTrainingVolumeMuscleExposure,
  type TrainingVolumeExposureSet,
} from '@/domain/sessionMuscles';
import { formatWorkoutVolumeKg } from '@/domain/volume';
import { T } from '@/theme/tokens';
import type { MuscleGroup, SetType, WorkoutSession } from '@/domain/types';
import type { HomeNavigationProp } from '@/navigation/types';

const DAY_MS = 24 * 60 * 60 * 1000;
const MUSCLE_COLORS: Partial<Record<MuscleGroup, string>> = {
  chest: '#ff3b4d',
  upper_back: '#11bf63',
  lats: '#18b86a',
  traps: '#2dd07b',
  front_delts: '#2f80ed',
  side_delts: '#2f80ed',
  rear_delts: '#3b8cff',
  biceps: '#8f5ce6',
  triceps: '#9b57e8',
  quads: '#ff7a1a',
  hamstrings: '#c46a17',
  glutes: '#d9791f',
  calves: '#f08a24',
  abs: '#e2b33d',
  obliques: '#dba83d',
  spinal_erectors: '#16a375',
  forearms: '#9b7ad9',
  adductors: '#db8842',
};

interface RecentSession {
  id: string;
  name: string | null;
  started_at: number;
  ended_at: number | null;
  total_volume_cached: number | null;
  set_count: number;
  pr_count: number;
}

interface ActiveWorkoutSummary {
  currentExercise: string;
  exerciseNumber: number;
  exerciseCount: number;
  loggedSetCount: number;
  lastActivityAt: number;
}

interface ActiveExerciseRow {
  exercise_id: string;
  exercise_name: string;
  logged_sets: number;
  last_logged_at: number | null;
  first_position: number;
}

interface TemplateExerciseRow {
  exercise_id: string;
  exercise_name: string;
}

interface TemplateLastUsedRow {
  template_id: string;
  last_used_at: number;
}

interface TrainingTotalsRow {
  session_count: number;
  set_count: number;
  total_volume: number | null;
}

interface RecentMuscleRow {
  session_id: string;
  exercise_id: string;
  exercise_name: string;
  set_type: SetType;
  is_warmup: 0 | 1;
  deleted_at: number | null;
  primary_muscles_json: string | null;
  secondary_muscles_json: string | null;
  tertiary_muscles_json: string | null;
}

interface MuscleChip {
  muscle: MuscleGroup;
  label: string;
  value: number;
}

function pluralize(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? '' : 's'}`;
}

function formatWhen(ts: number, now: number): string {
  const diff = now - ts;
  const days = Math.floor(diff / DAY_MS);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function formatAgoShort(ts: number, now: number): string {
  const diff = Math.max(0, now - ts);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDuration(startedAt: number, endedAt: number | null): string {
  if (!endedAt) return '';
  const mins = Math.max(0, Math.round((endedAt - startedAt) / 60000));
  return `${mins}m`;
}

function formatDateHeader(date: Date): string {
  const weekday = date.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
  const month = date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  return `${weekday}, ${month} ${date.getDate()}`;
}

function parseMuscleArray(json: string | null): MuscleGroup[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is MuscleGroup => typeof value === 'string')
      : [];
  } catch {
    return [];
  }
}

function toExposureSet(row: RecentMuscleRow): TrainingVolumeExposureSet {
  return {
    exercise_id: row.exercise_id,
    exercise_name: row.exercise_name,
    set_type: row.set_type,
    is_warmup: row.is_warmup,
    deleted_at: row.deleted_at,
    primary_muscles: parseMuscleArray(row.primary_muscles_json),
    secondary_muscles: parseMuscleArray(row.secondary_muscles_json),
    tertiary_muscles: parseMuscleArray(row.tertiary_muscles_json),
  };
}

function formatChipValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function muscleColor(muscle: MuscleGroup): string {
  return MUSCLE_COLORS[muscle] ?? T.accent;
}

export default function Home() {
  const navigation = useNavigation<HomeNavigationProp>();
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [templateLastUsed, setTemplateLastUsed] = useState<Record<string, number>>({});
  const [recents, setRecents] = useState<RecentSession[]>([]);
  const [recentMuscles, setRecentMuscles] = useState<Record<string, MuscleChip[]>>({});
  const [inProgress, setInProgress] = useState<WorkoutSession | null>(null);
  const [activeSummary, setActiveSummary] = useState<ActiveWorkoutSummary | null>(null);
  const [sessionRecovery, setSessionRecovery] = useState<SessionRecovery | null>(null);
  const [unfinishedTagsSessionId, setUnfinishedTagsSessionId] = useState<string | null>(null);
  const [trainingReport, setTrainingReport] = useState<TrainingVolumeReport | null>(null);
  const [trainingTotals, setTrainingTotals] = useState<TrainingTotalsRow>({
    session_count: 0,
    set_count: 0,
    total_volume: 0,
  });
  const [now, setNow] = useState<number>(Date.now);

  const load = useCallback(async () => {
    try {
      const db = await openDb();
      const loadedAt = Date.now();
      const sevenDaysAgo = loadedAt - TRAINING_VOLUME_WINDOWS.last7Days.days * DAY_MS;
      const [tpls, sessions, active, unfinishedTags, volumeReport, lastUsedRows, totalsRows] =
        await Promise.all([
          getNormalTemplatesWithCount(db),
          db.getAllAsync<RecentSession>(
            `SELECT sess.id,
                    sess.name,
                    sess.started_at,
                    sess.ended_at,
                    sess.total_volume_cached,
                    COUNT(DISTINCT ws.id) AS set_count,
                    COUNT(DISTINCT prs.id) AS pr_count
               FROM workout_sessions sess
               LEFT JOIN workout_sets ws
                 ON ws.session_id = sess.id
                AND ws.deleted_at IS NULL
                AND ws.is_warmup = 0
                AND COALESCE(ws.set_type, 'working') != 'warmup'
               LEFT JOIN exercise_prs prs ON prs.session_id = sess.id
              WHERE sess.status = 'completed'
              GROUP BY sess.id
              ORDER BY sess.ended_at DESC
              LIMIT 5`,
          ),
          getSessionRecovery(db),
          getUntaggedCompletedSession(db),
          getTrainingVolumeReport(db, { window: TRAINING_VOLUME_WINDOWS.last7Days, now: loadedAt }),
          db.getAllAsync<TemplateLastUsedRow>(
            `SELECT template_id, MAX(ended_at) AS last_used_at
               FROM workout_sessions
              WHERE status = 'completed'
                AND template_id IS NOT NULL
                AND ended_at IS NOT NULL
              GROUP BY template_id`,
          ),
          db.getAllAsync<TrainingTotalsRow>(
            `SELECT COUNT(DISTINCT sess.id) AS session_count,
                    COUNT(ws.id) AS set_count,
                    COALESCE(SUM(COALESCE(ws.weight, 0) * COALESCE(ws.reps, 0)), 0) AS total_volume
               FROM workout_sessions sess
               LEFT JOIN workout_sets ws
                 ON ws.session_id = sess.id
                AND ws.deleted_at IS NULL
                AND ws.is_warmup = 0
                AND COALESCE(ws.set_type, 'working') != 'warmup'
              WHERE sess.status = 'completed'
                AND sess.started_at >= ?`,
            [sevenDaysAgo],
          ),
        ]);

      const activeSession = active.status === 'none' ? null : active.session;
      const [activeStatus, muscleRows] = await Promise.all([
        activeSession ? getActiveWorkoutSummary(db, activeSession, loadedAt) : null,
        getRecentMuscleRows(db, sessions.map((session) => session.id)),
      ]);

      setTemplates(tpls);
      setTemplateLastUsed(
        Object.fromEntries(lastUsedRows.map((row) => [row.template_id, row.last_used_at])),
      );
      setRecents(sessions);
      setRecentMuscles(buildRecentMuscleChips(muscleRows));
      setSessionRecovery(active);
      setInProgress(activeSession);
      setActiveSummary(activeStatus);
      setUnfinishedTagsSessionId(unfinishedTags?.id ?? null);
      setTrainingReport(volumeReport);
      setTrainingTotals(totalsRows[0] ?? { session_count: 0, set_count: 0, total_volume: 0 });
      setNow(loadedAt);
    } catch {
      // Home should stay usable if a summary query fails during migrations or tests.
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const today = useMemo(() => new Date(now), [now]);
  const nextTemplate: TemplateSummary | null = templates[0] ?? null;
  const topMuscles = trainingReport?.muscles.slice(0, 4) ?? [];
  const maxMuscleExposure = Math.max(...topMuscles.map((row) => row.totalExposure), 1);

  const handleStartWorkout = () => {
    navigation.navigate('LiveWorkout', nextTemplate ? { templateId: nextTemplate.id } : {});
  };

  const handleResumeWorkout = () => {
    navigation.navigate('LiveWorkout', inProgress ? { sessionId: inProgress.id } : {});
  };

  const handleDiscardWorkout = async () => {
    if (!inProgress) return;
    const db = await openDb();
    await discardSession(db, inProgress.id);
    await load();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>{formatDateHeader(today)}</Text>
            <Text style={styles.title}>Set</Text>
          </View>
          <View style={styles.weekCount}>
            <Text style={styles.weekCountValue}>{trainingTotals.session_count}</Text>
            <Text style={styles.weekCountLabel}>this week</Text>
          </View>
        </View>

        {inProgress && (
          <View style={styles.section}>
            <View style={styles.activeCard} testID="active-workout-card">
              <Text style={styles.activeStatus}>
                {sessionRecovery?.status === 'stale'
                  ? `PAUSED ${formatAgoShort(activeSummary?.lastActivityAt ?? inProgress.updated_at, now)}`
                  : `ACTIVE · ${formatAgoShort(activeSummary?.lastActivityAt ?? inProgress.updated_at, now)}`}
              </Text>
              <Text style={styles.activeTitle}>{inProgress.name ?? 'Workout'}</Text>
              <Text style={styles.activeMeta}>
                {activeSummary
                  ? `Exercise ${activeSummary.exerciseNumber} of ${activeSummary.exerciseCount} · ${activeSummary.currentExercise}`
                  : 'Workout in progress'}
              </Text>
              <Text style={styles.activeMeta}>
                {pluralize(activeSummary?.loggedSetCount ?? 0, 'set')} logged
              </Text>

              <View style={styles.activeActions}>
                <TouchableOpacity
                  style={styles.resumeButton}
                  activeOpacity={0.86}
                  onPress={handleResumeWorkout}
                  testID="resume-workout-btn"
                >
                  <Ionicons name="play" size={17} color={T.text} />
                  <Text style={styles.resumeButtonText}>Resume Workout</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.discardButton}
                  activeOpacity={0.82}
                  onPress={handleDiscardWorkout}
                  testID="discard-workout-btn"
                >
                  <Text style={styles.discardButtonText}>Discard</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {unfinishedTagsSessionId && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.finishTagsCard}
              activeOpacity={0.86}
              onPress={() =>
                navigation.navigate('PostSessionTags', { sessionId: unfinishedTagsSessionId })
              }
            >
              <Text style={styles.finishTagsText}>Finish this session</Text>
              <Ionicons name="chevron-forward" size={16} color={T.muted} />
            </TouchableOpacity>
          </View>
        )}

        <View style={[styles.section, inProgress && styles.sectionTight]}>
          <TouchableOpacity
            activeOpacity={0.88}
            style={[styles.startCard, inProgress && styles.startCardSecondary]}
            onPress={handleStartWorkout}
            testID="start-workout-btn"
          >
            <Ionicons name="play" size={20} color={inProgress ? T.text : T.accentInk} />
            <Text style={[styles.startCardText, inProgress && styles.startCardTextSecondary]}>
              Start Workout
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>TEMPLATES</Text>
          <View style={styles.templateGrid}>
            {templates.slice(0, 3).map((template) => (
              <TouchableOpacity
                key={template.id}
                style={styles.templateCard}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('LiveWorkout', { templateId: template.id })}
                testID={`template-card-${template.id}`}
              >
                <Text style={styles.templateName}>{template.name}</Text>
                <Text style={styles.templateMeta}>{pluralize(template.item_count, 'exercise')}</Text>
                <Text style={styles.templateUsed}>
                  {templateLastUsed[template.id]
                    ? `Used ${formatWhen(templateLastUsed[template.id], now).toLowerCase()}`
                    : 'Not used yet'}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.templateCard, styles.templateAddCard]}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('Templates')}
              testID="template-add-card"
            >
              <Ionicons name="add" size={22} color={T.mutedDeep} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>TRAINING VOLUME · PAST 7 DAYS</Text>
          <TouchableOpacity
            style={styles.volumeCard}
            activeOpacity={0.86}
            onPress={() => navigation.navigate('TrainingVolume')}
            testID="training-volume-card"
          >
            <View style={styles.volumeStats}>
              <View style={styles.volumeStat}>
                <Text style={styles.volumeValue}>{trainingTotals.session_count}</Text>
                <Text style={styles.volumeLabel}>Sessions</Text>
              </View>
              <View style={styles.volumeStat}>
                <Text style={styles.volumeValue}>{trainingTotals.set_count}</Text>
                <Text style={styles.volumeLabel}>Sets</Text>
              </View>
              <View style={styles.volumeStat}>
                <Text style={styles.volumeValue}>
                  {trainingTotals.total_volume ? formatWorkoutVolumeKg(trainingTotals.total_volume) : '0 kg'}
                </Text>
                <Text style={styles.volumeLabel}>Volume</Text>
              </View>
            </View>
            <View style={styles.volumeDivider} />
            {topMuscles.length > 0 ? (
              <View style={styles.muscleBars}>
                {topMuscles.map((row) => (
                  <View key={row.muscle} style={styles.muscleBarRow}>
                    <Text style={styles.muscleBarLabel}>{MUSCLE_LABELS[row.muscle]}</Text>
                    <View style={styles.muscleTrack}>
                      <View
                        style={[
                          styles.muscleFill,
                          {
                            width: `${Math.max(8, (row.totalExposure / maxMuscleExposure) * 100)}%`,
                            backgroundColor: muscleColor(row.muscle),
                          },
                        ]}
                      >
                        <Text style={styles.muscleBarValue}>{formatChipValue(row.totalExposure)}</Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={styles.emptyVolumeText}>No completed working sets in the last 7 days.</Text>
            )}
          </TouchableOpacity>
        </View>

        {recents.length > 0 && (
          <View style={[styles.section, styles.sectionLast]}>
            <Text style={styles.sectionLabel}>RECENT WORKOUTS</Text>
            <View style={styles.recentList}>
              {recents.map((session) => (
                <TouchableOpacity
                  key={session.id}
                  style={styles.recentCard}
                  activeOpacity={0.8}
                  onPress={() => navigation.navigate('WorkoutDetails', { sessionId: session.id })}
                  testID={`recent-workout-${session.id}`}
                >
                  <View style={styles.recentTop}>
                    <View style={styles.recentInfo}>
                      <View style={styles.recentTitleRow}>
                        <Text style={styles.recentName}>{session.name ?? 'Workout'}</Text>
                        {session.pr_count > 0 && (
                          <View style={styles.prBadge}>
                            <Text style={styles.prBadgeText}>
                              ↗ {session.pr_count} PR{session.pr_count === 1 ? '' : 's'}
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.recentMeta}>
                        {[formatWhen(session.started_at, now), formatDuration(session.started_at, session.ended_at)]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    </View>
                    <View style={styles.recentNumbers}>
                      <Text style={styles.recentVolume}>
                        {session.total_volume_cached ? formatWorkoutVolumeKg(session.total_volume_cached) : '0 kg'}
                      </Text>
                      <Text style={styles.recentSets}>{pluralize(session.set_count, 'set')}</Text>
                    </View>
                  </View>
                  {recentMuscles[session.id]?.length ? (
                    <View style={styles.chipRow}>
                      {recentMuscles[session.id]?.map((chip) => (
                        <View
                          key={chip.muscle}
                          style={[
                            styles.muscleChip,
                            { backgroundColor: `${muscleColor(chip.muscle)}33` },
                          ]}
                        >
                          <Text style={[styles.muscleChipText, { color: muscleColor(chip.muscle) }]}>
                            {chip.label} {formatChipValue(chip.value)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

async function getActiveWorkoutSummary(
  db: Awaited<ReturnType<typeof openDb>>,
  session: WorkoutSession,
  now: number,
): Promise<ActiveWorkoutSummary> {
  const [loggedRows, templateRows] = await Promise.all([
    db.getAllAsync<ActiveExerciseRow>(
      `SELECT ws.exercise_id,
              COALESCE(e.name, 'Exercise') AS exercise_name,
              COUNT(ws.id) AS logged_sets,
              MAX(ws.logged_at) AS last_logged_at,
              MIN(ws.position) AS first_position
         FROM workout_sets ws
         LEFT JOIN exercises e ON e.id = ws.exercise_id
        WHERE ws.session_id = ?
          AND ws.deleted_at IS NULL
        GROUP BY ws.exercise_id
        ORDER BY first_position ASC`,
      [session.id],
    ),
    session.template_id
      ? db.getAllAsync<TemplateExerciseRow>(
          `SELECT ti.exercise_id, COALESCE(e.name, 'Exercise') AS exercise_name
             FROM template_items ti
             JOIN exercises e ON e.id = ti.exercise_id
            WHERE ti.template_id = ?
            ORDER BY ti.position ASC`,
          [session.template_id],
        )
      : Promise.resolve([]),
  ]);

  const lastLoggedAt =
    loggedRows.reduce<number | null>(
      (latest, row) => Math.max(latest ?? 0, row.last_logged_at ?? 0),
      null,
    ) ?? null;
  const latestExerciseId =
    loggedRows.find((row) => row.last_logged_at === lastLoggedAt)?.exercise_id ??
    loggedRows[0]?.exercise_id ??
    templateRows[0]?.exercise_id ??
    null;
  const exerciseOrder = templateRows.length > 0 ? templateRows : loggedRows;
  const currentExercise =
    exerciseOrder.find((row) => row.exercise_id === latestExerciseId)?.exercise_name ??
    loggedRows.find((row) => row.exercise_id === latestExerciseId)?.exercise_name ??
    'No exercise selected';
  const exerciseIndex = exerciseOrder.findIndex((row) => row.exercise_id === latestExerciseId);

  return {
    currentExercise,
    exerciseNumber: exerciseIndex >= 0 ? exerciseIndex + 1 : latestExerciseId ? 1 : 0,
    exerciseCount: Math.max(exerciseOrder.length, latestExerciseId ? 1 : 0),
    loggedSetCount: loggedRows.reduce((total, row) => total + row.logged_sets, 0),
    lastActivityAt: lastLoggedAt ?? session.updated_at ?? session.started_at ?? now,
  };
}

async function getRecentMuscleRows(
  db: Awaited<ReturnType<typeof openDb>>,
  sessionIds: string[],
): Promise<RecentMuscleRow[]> {
  if (sessionIds.length === 0) return [];
  return db.getAllAsync<RecentMuscleRow>(
    `SELECT ws.session_id,
            ws.exercise_id,
            COALESCE(e.name, 'Exercise') AS exercise_name,
            ws.set_type,
            ws.is_warmup,
            ws.deleted_at,
            em.primary_muscles_json,
            em.secondary_muscles_json,
            em.tertiary_muscles_json
       FROM workout_sets ws
       LEFT JOIN exercises e ON e.id = ws.exercise_id
       LEFT JOIN exercise_metadata em ON em.exercise_id = ws.exercise_id
      WHERE ws.session_id IN (${sessionIds.map(() => '?').join(',')})
        AND ws.deleted_at IS NULL
        AND ws.is_warmup = 0
        AND COALESCE(ws.set_type, 'working') != 'warmup'
      ORDER BY ws.logged_at ASC`,
    sessionIds,
  );
}

function buildRecentMuscleChips(rows: RecentMuscleRow[]): Record<string, MuscleChip[]> {
  const bySession = new Map<string, RecentMuscleRow[]>();
  for (const row of rows) {
    bySession.set(row.session_id, [...(bySession.get(row.session_id) ?? []), row]);
  }

  return Object.fromEntries(
    [...bySession.entries()].map(([sessionId, sessionRows]) => [
      sessionId,
      calculateTrainingVolumeMuscleExposure(sessionRows.map(toExposureSet))
        .slice(0, 3)
        .map((row) => ({
          muscle: row.muscle,
          label: MUSCLE_LABELS[row.muscle],
          value: row.totalExposure,
        })),
    ]),
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  container: { flex: 1, backgroundColor: T.bg },
  content: { paddingBottom: 24 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 8,
  },
  eyebrow: {
    fontSize: 12,
    textTransform: 'uppercase',
    color: T.muted,
    fontWeight: '600',
  },
  title: {
    fontSize: 29,
    fontWeight: '700',
    color: T.text,
    marginTop: 4,
  },
  weekCount: { alignItems: 'flex-end', paddingBottom: 2 },
  weekCountValue: { color: T.text, fontSize: 22, fontWeight: '700' },
  weekCountLabel: { color: T.muted, fontSize: 12, marginTop: 2 },

  section: { paddingHorizontal: 18, paddingTop: 16 },
  sectionTight: { paddingTop: 14 },
  sectionLast: { paddingBottom: 8 },
  sectionLabel: {
    fontSize: 13,
    textTransform: 'uppercase',
    color: T.muted,
    fontWeight: '700',
    marginBottom: 10,
  },

  activeCard: {
    backgroundColor: T.accent,
    borderRadius: 18,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 18,
  },
  activeStatus: {
    color: 'rgba(10,10,10,0.7)',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  activeTitle: {
    color: T.accentInk,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 12,
  },
  activeMeta: {
    color: T.accentInk,
    fontSize: 15,
    fontWeight: '500',
    marginTop: 5,
  },
  activeActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  resumeButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: 13,
    backgroundColor: T.accentInk,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  resumeButtonText: { color: T.text, fontSize: 17, fontWeight: '800' },
  discardButton: {
    minHeight: 52,
    paddingHorizontal: 18,
    borderRadius: 13,
    backgroundColor: 'rgba(10,10,10,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  discardButtonText: { color: T.accentInk, fontSize: 15, fontWeight: '800' },
  finishTagsCard: {
    minHeight: 48,
    borderRadius: 13,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  finishTagsText: { color: T.text, fontSize: 14, fontWeight: '700' },

  startCard: {
    minHeight: 68,
    borderRadius: 16,
    backgroundColor: T.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  startCardSecondary: {
    minHeight: 52,
    borderRadius: 13,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
  },
  startCardText: { color: T.accentInk, fontSize: 17, fontWeight: '800' },
  startCardTextSecondary: { color: T.text, fontSize: 15 },

  templateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  templateCard: {
    width: '48.5%',
    minHeight: 108,
    borderRadius: 14,
    backgroundColor: T.surface,
    paddingHorizontal: 16,
    paddingVertical: 16,
    justifyContent: 'center',
  },
  templateAddCard: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  templateName: { color: T.text, fontSize: 16, fontWeight: '800' },
  templateMeta: { color: T.textDim, fontSize: 14, fontWeight: '600', marginTop: 7 },
  templateUsed: { color: T.muted, fontSize: 13, fontWeight: '600', marginTop: 9 },

  volumeCard: {
    borderRadius: 14,
    backgroundColor: T.surface,
    padding: 18,
  },
  volumeStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  volumeStat: { flex: 1 },
  volumeValue: { color: T.text, fontSize: 24, fontWeight: '800' },
  volumeLabel: { color: T.muted, fontSize: 13, marginTop: 4 },
  volumeDivider: { height: 1, backgroundColor: T.border, marginTop: 18, marginBottom: 16 },
  muscleBars: { gap: 11 },
  muscleBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  muscleBarLabel: { width: 86, color: T.textDim, fontSize: 13 },
  muscleTrack: {
    flex: 1,
    height: 24,
    borderRadius: 4,
    backgroundColor: T.surface3,
    overflow: 'hidden',
  },
  muscleFill: {
    height: '100%',
    minWidth: 28,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 8,
    borderRadius: 4,
  },
  muscleBarValue: { color: T.text, fontSize: 12, fontWeight: '800' },
  emptyVolumeText: { color: T.muted, fontSize: 13 },

  recentList: { gap: 10 },
  recentCard: {
    minHeight: 98,
    borderRadius: 14,
    backgroundColor: T.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  recentTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  recentInfo: { flex: 1, minWidth: 0 },
  recentTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  recentName: { color: T.text, fontSize: 16, fontWeight: '800' },
  recentMeta: { color: T.muted, fontSize: 13, fontWeight: '600', marginTop: 7 },
  recentNumbers: { alignItems: 'flex-end', minWidth: 90 },
  recentVolume: { color: T.text, fontSize: 16, fontWeight: '800' },
  recentSets: { color: T.muted, fontSize: 12, marginTop: 5 },
  prBadge: {
    backgroundColor: 'rgba(255,216,77,0.28)',
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  prBadgeText: { color: T.accent, fontSize: 12, fontWeight: '800' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 12 },
  muscleChip: { borderRadius: 5, paddingHorizontal: 9, paddingVertical: 5 },
  muscleChipText: { fontSize: 12, fontWeight: '800' },
});
