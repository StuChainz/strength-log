import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { openDb } from '@/db/client';
import { getAllTemplatesWithCount, type TemplateSummary } from '@/db/repositories/templates.repo';
import { getSessionRecovery, type SessionRecovery } from '@/db/repositories/sessions.repo';
import { getUntaggedCompletedSession } from '@/db/repositories/tags.repo';
import { maybeGenerateWeeklyInsight } from '@/db/repositories/insights.repo';
import { InsightCard } from '@/components/InsightCard';
import { T } from '@/theme/tokens';
import type { WeeklyInsightCard, WorkoutSession } from '@/domain/types';
import type { HomeNavigationProp } from '@/navigation/types';

interface RecentSession {
  id: string;
  name: string | null;
  started_at: number;
  ended_at: number | null;
  total_volume_cached: number | null;
}

export default function Home() {
  const navigation = useNavigation<HomeNavigationProp>();
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [recents, setRecents] = useState<RecentSession[]>([]);
  const [inProgress, setInProgress] = useState<WorkoutSession | null>(null);
  const [sessionRecovery, setSessionRecovery] = useState<SessionRecovery | null>(null);
  const [unfinishedTagsSessionId, setUnfinishedTagsSessionId] = useState<string | null>(null);
  const [insightCard, setInsightCard] = useState<WeeklyInsightCard | null>(null);
  const [now, setNow] = useState<number>(Date.now);

  const load = useCallback(async () => {
    try {
      const db = await openDb();
      const [tpls, sessions, active, unfinishedTags, latestInsight] = await Promise.all([
        getAllTemplatesWithCount(db),
        db.getAllAsync<RecentSession>(
          `SELECT id, name, started_at, ended_at, total_volume_cached
           FROM workout_sessions
           WHERE status = 'completed'
           ORDER BY ended_at DESC
           LIMIT 5`,
        ),
        getSessionRecovery(db),
        getUntaggedCompletedSession(db),
        maybeGenerateWeeklyInsight(db),
      ]);
      setTemplates(tpls);
      setRecents(sessions);
      setSessionRecovery(active);
      setInProgress(active.status === 'none' ? null : active.session);
      setUnfinishedTagsSessionId(unfinishedTags?.id ?? null);
      setInsightCard(latestInsight);
      setNow(Date.now());
    } catch {
      // ignore
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const nextTemplate: TemplateSummary | null = templates[0] ?? null;
  const inProgressLabel =
    sessionRecovery?.status === 'multiple_active'
      ? 'MULTIPLE ACTIVE WORKOUTS'
      : sessionRecovery?.status === 'stale'
        ? 'STALE WORKOUT'
        : 'IN PROGRESS';
  const inProgressTitle =
    sessionRecovery?.status === 'multiple_active'
      ? `${sessionRecovery.sessions.length} workouts need attention`
      : inProgress
        ? `Resumed workout from ${new Date(inProgress.started_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}`
        : '';

  const today = new Date();
  const dayLabel = today.toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase();
  const dateLabel = today
    .toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    .toUpperCase();

  const formatDuration = (session: RecentSession) => {
    if (!session.ended_at) return '';
    const mins = Math.round((session.ended_at - session.started_at) / 60000);
    return `${mins}m`;
  };

  const formatVolume = (v: number | null): string => {
    if (v === null || v === 0) return '';
    if (v >= 1000) return `${(v / 1000).toFixed(1)}k kg`;
    return `${v} kg`;
  };

  const formatWhen = (ts: number): string => {
    const diff = now - ts;
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Mon
  const weekSessions = recents.filter((r) => r.started_at >= weekStart.getTime());
  const weekVolume = weekSessions.reduce((s, r) => s + (r.total_volume_cached ?? 0), 0);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>
              {dayLabel} · {dateLabel}
            </Text>
            <Text style={styles.title}>Strength Log</Text>
          </View>
          <TouchableOpacity
            style={styles.dotsBtn}
            hitSlop={8}
            onPress={() => navigation.navigate('Settings')}
          >
            <Ionicons name="ellipsis-horizontal" size={18} color={T.textDim} />
          </TouchableOpacity>
        </View>

        {inProgress && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.resumeCard}
              activeOpacity={0.86}
              onPress={() => navigation.navigate('LiveWorkout', {})}
            >
              <View style={styles.resumeIcon}>
                <Ionicons name="refresh" size={18} color={T.accent} />
              </View>
              <View style={styles.resumeBody}>
                <Text style={styles.resumeLabel}>{inProgressLabel}</Text>
                <Text style={styles.resumeTitle}>{inProgressTitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={T.mutedDeep} />
            </TouchableOpacity>
          </View>
        )}

        {unfinishedTagsSessionId && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.resumeCard}
              activeOpacity={0.86}
              onPress={() =>
                navigation.navigate('PostSessionTags', { sessionId: unfinishedTagsSessionId })
              }
            >
              <View style={styles.resumeIcon}>
                <Ionicons name="pricetag-outline" size={18} color={T.accent} />
              </View>
              <View style={styles.resumeBody}>
                <Text style={styles.resumeLabel}>FINISH THIS SESSION</Text>
                <Text style={styles.resumeTitle}>Add tags and energy rating</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={T.mutedDeep} />
            </TouchableOpacity>
          </View>
        )}

        {/* Hero CTA */}
        <View style={styles.section}>
          <TouchableOpacity
            activeOpacity={0.88}
            style={styles.heroCard}
            onPress={() =>
              navigation.navigate(
                'LiveWorkout',
                nextTemplate ? { templateId: nextTemplate.id } : {},
              )
            }
            testID="start-workout-btn"
          >
            <View style={styles.heroLeft}>
              <Text style={styles.heroEyebrow}>NEXT UP</Text>
              <Text style={styles.heroName}>{nextTemplate?.name ?? 'Empty Workout'}</Text>
              <Text style={styles.heroSub}>
                {nextTemplate
                  ? `${nextTemplate.item_count} exercise${nextTemplate.item_count !== 1 ? 's' : ''}`
                  : 'Pick exercises as you go'}
              </Text>
            </View>
            <View style={styles.heroPlayWrap}>
              <Ionicons name="play" size={24} color={T.accent} />
            </View>
          </TouchableOpacity>
        </View>

        {/* This week */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>THIS WEEK</Text>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{weekSessions.length}</Text>
              <Text style={styles.statUnit}>sessions</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>
                {weekVolume > 0 ? formatVolume(weekVolume) : '—'}
              </Text>
              <Text style={styles.statUnit}>kg volume</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>—</Text>
              <Text style={styles.statUnit}>PRs</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>WEEKLY INSIGHT</Text>
          {insightCard ? (
            <InsightCard card={insightCard} />
          ) : (
            <View style={styles.insightHint}>
              <Text style={styles.insightHintText}>
                Add tags after workouts to unlock weekly patterns.
              </Text>
            </View>
          )}
        </View>

        {/* Recent workouts */}
        {recents.length > 0 && (
          <View style={[styles.section, styles.sectionLast]}>
            <Text style={styles.sectionLabel}>RECENT</Text>
            <View style={styles.recentList}>
              {recents.map((r, i) => (
                <View key={r.id} style={[styles.recentRow, i === 0 && styles.recentRowFirst]}>
                  <View style={styles.recentInfo}>
                    <Text style={styles.recentName}>{r.name ?? 'Workout'}</Text>
                    <Text style={styles.recentMeta}>
                      {[
                        formatWhen(r.started_at),
                        formatVolume(r.total_volume_cached),
                        r.ended_at ? formatDuration(r) : '',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={T.mutedDeep} />
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
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
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 8,
  },
  eyebrow: {
    fontFamily: 'Courier New',
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: T.muted,
    fontWeight: '500',
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: -0.5,
    color: T.text,
    marginTop: 4,
  },
  dotsBtn: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: T.surface2,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  section: { paddingHorizontal: 22, paddingTop: 20 },
  sectionLast: { paddingBottom: 8 },
  sectionLabel: {
    fontFamily: 'Courier New',
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: T.muted,
    fontWeight: '500',
    marginBottom: 10,
  },
  resumeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 14,
    padding: 14,
  },
  resumeIcon: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: T.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resumeBody: { flex: 1, minWidth: 0 },
  resumeLabel: {
    fontFamily: 'Courier New',
    color: T.muted,
    fontSize: 10.5,
    letterSpacing: 1.2,
  },
  resumeTitle: { color: T.text, fontSize: 14, fontWeight: '600', marginTop: 3 },

  heroCard: {
    backgroundColor: T.accent,
    borderRadius: 22,
    padding: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: T.accent,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 8,
  },
  heroLeft: { flex: 1 },
  heroEyebrow: {
    fontFamily: 'Courier New',
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 1,
    color: T.accentInk,
    opacity: 0.7,
  },
  heroName: {
    fontSize: 26,
    fontWeight: '600',
    color: T.accentInk,
    letterSpacing: -0.5,
    marginTop: 4,
  },
  heroSub: {
    fontFamily: 'Courier New',
    fontSize: 12,
    color: T.accentInk,
    opacity: 0.7,
    marginTop: 6,
  },
  heroPlayWrap: {
    width: 56,
    height: 56,
    borderRadius: 999,
    backgroundColor: T.accentInk,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },

  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1,
    backgroundColor: T.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: T.border,
    padding: 12,
  },
  statValue: {
    fontFamily: 'Courier New',
    fontSize: 22,
    fontWeight: '500',
    color: T.text,
    lineHeight: 26,
  },
  statUnit: {
    fontFamily: 'Courier New',
    fontSize: 11,
    color: T.muted,
    marginTop: 4,
    letterSpacing: 0.3,
  },
  insightHint: {
    backgroundColor: T.surface,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: T.border,
    borderRadius: 14,
    padding: 14,
  },
  insightHintText: { color: T.muted, fontSize: 13 },

  recentList: {
    backgroundColor: T.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: T.border,
    overflow: 'hidden',
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: T.border,
    gap: 8,
  },
  recentRowFirst: { borderTopWidth: 0 },
  recentInfo: { flex: 1 },
  recentName: { fontSize: 15, fontWeight: '600', color: T.text },
  recentMeta: {
    fontFamily: 'Courier New',
    fontSize: 11.5,
    color: T.muted,
    marginTop: 3,
    letterSpacing: 0.2,
  },
});
