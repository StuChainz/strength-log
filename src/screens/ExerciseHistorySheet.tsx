import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Rect } from 'react-native-svg';
import IssueReactionEditSheet from '@/components/IssueReactionEditSheet';
import { openDb } from '@/db/client';
import { getExerciseHistory, type ExerciseHistorySession } from '@/db/repositories/history.repo';
import {
  deleteExerciseIssueEvent,
  getActiveIssueExerciseLinksForExercise,
  getExerciseIssueEventsForExercise,
  getExerciseIssueSummary,
  type IssueExerciseLinkWithIssueName,
  type ExerciseIssueEventWithIssueName,
  type ExerciseIssueSummary,
  updateExerciseIssueEvent,
} from '@/db/repositories/issues.repo';
import { getFinalPRsByExercise } from '@/db/repositories/prs.repo';
import {
  getProgressionSuggestion,
  type ProgressionExercise,
  type ProgressionIssueReactionContext,
  type ProgressionRuleConfig,
  type ProgressionSuggestion,
} from '@/domain/progression';
import {
  buildEstimated1RMGraphPoints,
  buildExerciseCalendarDays,
  buildVolumeGraphPoints,
  calculateExerciseSessionVolume,
  getBestEstimated1RMForSession,
  getRecentExerciseSessions,
  type ExerciseHistoryPoint,
} from '@/domain/exerciseHistory';
import { formatWorkoutVolumeKg } from '@/domain/volume';
import { accentAlpha, T } from '@/theme/tokens';
import type {
  ExerciseCategory,
  ExercisePR,
  ExerciseIssueEvent,
  IssueExerciseLinkType,
  IssueReactionType,
  Unit,
} from '@/domain/types';

interface ExerciseHistorySheetProps {
  visible: boolean;
  exerciseId: string | null;
  exerciseName: string;
  primaryMuscle?: string | null;
  category: ExerciseCategory;
  defaultUnit: Unit;
  targetSets: number | null;
  targetReps: number | null;
  targetWeight: number | null;
  progressionRule: ProgressionRuleConfig;
  progressionExercise: ProgressionExercise;
  onClose: () => void;
  onApplySuggestion?: (suggestion: ProgressionSuggestion) => void;
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatFullDate(ts: number): string {
  return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatCompactValue(value: number): string {
  if (value >= 1000) return `${Math.round(value / 100) / 10}k`;
  return value % 1 === 0 ? String(value) : value.toFixed(1);
}

function formatSets(session: ExerciseHistorySession): string {
  return session.sets
    .map((set) => {
      if (set.weight !== null && set.reps !== null) return `${set.weight}×${set.reps}`;
      if (set.reps !== null) return `${set.reps} reps`;
      return null;
    })
    .filter(Boolean)
    .join(', ');
}

function formatReaction(value: IssueReactionType): string {
  return value === 'aggravated' ? 'Aggravated' : 'Helped';
}

function formatLinkType(value: IssueExerciseLinkType): string {
  return value === 'helpful' ? 'Helpful' : 'Aggravating';
}

function formatReactionDetail(
  event: Pick<ExerciseIssueEvent, 'reaction_type' | 'severity'>,
): string {
  const severity = event.severity !== null ? ` ${event.severity}/5` : '';
  return `${formatReaction(event.reaction_type)}${severity}`;
}

function getSetNumberForEvent(
  session: ExerciseHistorySession,
  event: ExerciseIssueEventWithIssueName,
): number | null {
  if (!event.set_id) return null;
  const index = session.sets.findIndex((set) => set.id === event.set_id);
  return index >= 0 ? index + 1 : null;
}

function formatIssueEvent(
  event: ExerciseIssueEventWithIssueName,
  session?: ExerciseHistorySession,
): string {
  const setNumber = session ? getSetNumberForEvent(session, event) : null;
  if (setNumber !== null) {
    return `Set ${setNumber}: ${event.issue_name} · ${formatReactionDetail(event)}`;
  }
  return `${event.issue_name}: ${formatReactionDetail(event)}`;
}

function toProgressionIssueReaction(
  event: ExerciseIssueEventWithIssueName,
): ProgressionIssueReactionContext {
  return {
    issueName: event.issue_name,
    reactionType: event.reaction_type,
    severity: event.severity,
    createdAt: event.created_at,
    sessionId: event.session_id,
    setId: event.set_id,
  };
}

function formatPR(record: ExercisePR): string {
  if (record.record_type === 'estimated_1rm') {
    return `Best estimated 1RM ${record.value.toFixed(1)} ${record.unit}`;
  }
  if (record.record_type === 'session_volume') {
    return `Best volume session ${formatWorkoutVolumeKg(record.value)}`;
  }
  return `Best ${record.reps ?? 'rep'} rep${record.reps === 1 ? '' : 's'} at ${
    record.weight ?? record.value
  } ${record.unit}`;
}

function formatCount(value: number, singular: string, plural: string): string {
  return `${value} ${value === 1 ? singular : plural}`;
}

function buildPath(points: ExerciseHistoryPoint[], width: number, height: number): string {
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return points
    .map((point, index) => {
      const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width;
      const y = height - ((point.value - min) / range) * height;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
}

function MiniLineGraph({
  points,
  testID,
}: {
  points: ExerciseHistoryPoint[];
  testID: string;
}) {
  const width = 260;
  const height = 64;
  return (
    <View style={styles.graphFrame} testID={testID}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <Path
          d={buildPath(points, width, height - 8)}
          stroke={T.accent}
          strokeWidth={3}
          fill="none"
        />
      </Svg>
      <View style={styles.graphLabels}>
        <Text style={styles.graphLabel}>{formatDate(points[0].startedAt)}</Text>
        <Text style={styles.graphLabel}>{formatDate(points[points.length - 1].startedAt)}</Text>
      </View>
    </View>
  );
}

function MiniBarGraph({
  points,
  testID,
}: {
  points: ExerciseHistoryPoint[];
  testID: string;
}) {
  const width = 260;
  const height = 64;
  const max = Math.max(...points.map((point) => point.value), 1);
  const gap = 4;
  const barWidth = Math.max(5, (width - gap * (points.length - 1)) / points.length);
  return (
    <View style={styles.graphFrame} testID={testID}>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {points.map((point, index) => {
          const barHeight = Math.max(4, (point.value / max) * (height - 4));
          const x = index * (barWidth + gap);
          const y = height - barHeight;
          return (
            <Rect
              key={point.sessionId}
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              rx={3}
              fill={T.accent}
            />
          );
        })}
      </Svg>
      <View style={styles.graphLabels}>
        <Text style={styles.graphLabel}>{formatDate(points[0].startedAt)}</Text>
        <Text style={styles.graphLabel}>{formatDate(points[points.length - 1].startedAt)}</Text>
      </View>
    </View>
  );
}

export default function ExerciseHistorySheet({
  visible,
  exerciseId,
  exerciseName,
  primaryMuscle,
  category,
  defaultUnit,
  targetSets,
  targetReps,
  targetWeight,
  progressionRule,
  progressionExercise,
  onClose,
  onApplySuggestion,
}: ExerciseHistorySheetProps) {
  const [history, setHistory] = useState<ExerciseHistorySession[]>([]);
  const [issueLinks, setIssueLinks] = useState<IssueExerciseLinkWithIssueName[]>([]);
  const [issueSummary, setIssueSummary] = useState<ExerciseIssueSummary[]>([]);
  const [issueEvents, setIssueEvents] = useState<ExerciseIssueEventWithIssueName[]>([]);
  const [prs, setPrs] = useState<ExercisePR[]>([]);
  const [loadedExerciseId, setLoadedExerciseId] = useState<string | null>(null);
  const [selectedIssueSummary, setSelectedIssueSummary] = useState<ExerciseIssueSummary | null>(
    null,
  );
  const [savingReaction, setSavingReaction] = useState(false);
  const loading = visible && exerciseId !== null && loadedExerciseId !== exerciseId;

  const load = useCallback(async () => {
    if (!exerciseId) return;
    const db = await openDb();
    const [historyRows, issueLinkRows, issueRows, issueEventRows, prRows] = await Promise.all([
      getExerciseHistory(db, exerciseId, 40),
      getActiveIssueExerciseLinksForExercise(db, exerciseId),
      getExerciseIssueSummary(db, exerciseId),
      getExerciseIssueEventsForExercise(db, exerciseId),
      getFinalPRsByExercise(db, exerciseId),
    ]);
    setHistory(historyRows);
    setIssueLinks(issueLinkRows);
    setIssueSummary(issueRows);
    setIssueEvents(issueEventRows);
    setPrs(prRows);
    setLoadedExerciseId(exerciseId);
  }, [exerciseId]);

  useEffect(() => {
    if (!visible || !exerciseId) return;
    load().catch(() => {});
  }, [exerciseId, load, visible]);

  const selectedEvent: ExerciseIssueEvent | null = selectedIssueSummary?.latestEvent ?? null;
  const displayHistory = useMemo(
    () => (loadedExerciseId === exerciseId ? history : []),
    [exerciseId, history, loadedExerciseId],
  );
  const issueReactionContexts = useMemo(() => {
    const seen = new Set(issueEvents.map((event) => event.id));
    const summaryEvents = issueSummary
      .map((item) => ({
        ...item.latestEvent,
        issue_name: item.issueName,
      }))
      .filter((event) => !seen.has(event.id));
    return [...issueEvents, ...summaryEvents].map(toProgressionIssueReaction);
  }, [issueEvents, issueSummary]);

  const saveReaction = async (input: {
    reactionType: IssueReactionType;
    severity: number;
    note: string;
  }) => {
    if (!selectedEvent) return;
    setSavingReaction(true);
    try {
      const db = await openDb();
      await updateExerciseIssueEvent(db, selectedEvent.id, {
        reactionType: input.reactionType,
        severity: input.severity,
        note: input.note,
      });
      setSelectedIssueSummary(null);
      await load();
    } finally {
      setSavingReaction(false);
    }
  };

  const confirmDeleteReaction = () => {
    if (!selectedEvent) return;
    Alert.alert(
      'Delete this issue record?',
      'This removes the personal note from your history.\nIt does not delete the Issue.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const eventId = selectedEvent.id;
            void openDb()
              .then((db) => deleteExerciseIssueEvent(db, eventId))
              .then(async () => {
                setSelectedIssueSummary(null);
                await load();
              });
          },
        },
      ],
    );
  };

  const suggestion = useMemo(() => {
    return getProgressionSuggestion({
      exercise: progressionExercise ?? { category },
      templateTarget: {
        targetSets,
        targetReps,
        targetWeight,
        unit: defaultUnit,
      },
      progressionRule,
      recentSets: displayHistory[0]?.sets ?? [],
      previousSessionSets: displayHistory[1]?.sets ?? [],
      recentIssueReactions: issueReactionContexts,
    });
  }, [
    category,
    defaultUnit,
    displayHistory,
    issueReactionContexts,
    progressionExercise,
    progressionRule,
    targetReps,
    targetSets,
    targetWeight,
  ]);

  const canApply = suggestion.weight !== null || suggestion.reps !== null;
  const recentSessions = useMemo(
    () => getRecentExerciseSessions(displayHistory, 5),
    [displayHistory],
  );
  const estimated1RMPoints = useMemo(
    () => buildEstimated1RMGraphPoints(displayHistory),
    [displayHistory],
  );
  const volumePoints = useMemo(() => buildVolumeGraphPoints(displayHistory), [displayHistory]);
  const calendarDays = useMemo(() => buildExerciseCalendarDays(displayHistory), [displayHistory]);
  const issueEventsBySession = useMemo(() => {
    const bySession = new Map<string, ExerciseIssueEventWithIssueName[]>();
    for (const event of issueEvents) {
      if (!event.session_id) continue;
      const events = bySession.get(event.session_id) ?? [];
      events.push(event);
      bySession.set(event.session_id, events);
    }
    return bySession;
  }, [issueEvents]);
  const lastSession = displayHistory[0] ?? null;
  const bestEstimated1RM = useMemo(() => {
    const values = displayHistory
      .map((session) => getBestEstimated1RMForSession(session.sets))
      .filter((value): value is number => value !== null);
    return values.length > 0 ? Math.max(...values) : null;
  }, [displayHistory]);
  const bestVolume = useMemo(() => {
    const values = displayHistory.map((session) => calculateExerciseSessionVolume(session.sets));
    return values.length > 0 ? Math.max(...values) : null;
  }, [displayHistory]);
  const recentPrs = prs.slice(0, 4);
  const toleranceSummary = useMemo(() => {
    if (issueEvents.length === 0 && issueSummary.length === 0 && issueLinks.length === 0) {
      return null;
    }

    const recentSessionIds = new Set(recentSessions.map((session) => session.sessionId));
    const eventSessionsInSample = new Set<string>(
      issueEvents.flatMap((event) =>
        event.session_id !== null && recentSessionIds.has(event.session_id)
          ? [event.session_id]
          : [],
      ),
    );
    const aggravatedCount =
      issueSummary.length > 0
        ? issueSummary.reduce((sum, item) => sum + item.aggravatedCount, 0)
        : issueEvents.filter((event) => event.reaction_type === 'aggravated').length;
    const helpedCount =
      issueSummary.length > 0
        ? issueSummary.reduce((sum, item) => sum + item.helpedCount, 0)
        : issueEvents.filter((event) => event.reaction_type === 'helped').length;
    const latestEvent =
      issueEvents[0] ??
      issueSummary
        .map((item) => ({
          ...item.latestEvent,
          issue_name: item.issueName,
        }))
        .sort((a, b) => b.created_at - a.created_at)[0] ??
      null;
    const eventCount =
      issueEvents.length > 0
        ? issueEvents.length
        : issueSummary.reduce((sum, item) => sum + item.aggravatedCount + item.helpedCount, 0);
    const hasSessionIssueEvents = issueEvents.some((event) => event.session_id !== null);

    const lines: string[] = [];
    if (hasSessionIssueEvents && recentSessions.length > 0) {
      lines.push(
        `Issue notes co-occurred with ${eventSessionsInSample.size} of last ${formatCount(
          recentSessions.length,
          'session',
          'sessions',
        )}.`,
      );
    } else if (eventCount > 0) {
      lines.push(`${formatCount(eventCount, 'issue record', 'issue records')} noted.`);
    } else {
      lines.push(
        `${formatCount(issueLinks.length, 'active issue link', 'active issue links')} marked.`,
      );
    }

    if (latestEvent) {
      lines.push(
        `Latest: ${formatReactionDetail(latestEvent)} · ${formatDate(latestEvent.created_at)}`,
      );
    }
    if (aggravatedCount > 0) {
      lines.push(`Marked aggravated ${formatCount(aggravatedCount, 'time', 'times')}.`);
    }
    if (helpedCount > 0) {
      lines.push(
        `${aggravatedCount > 0 ? 'Also marked' : 'Marked'} helped ${formatCount(
          helpedCount,
          'time',
          'times',
        )}.`,
      );
    }
    if (eventCount === 0 && issueLinks.length > 0) {
      lines.push(
        ...issueLinks
          .slice(0, 2)
          .map(
            (link) =>
              `${link.issue_name} marked ${
                link.link_type === 'helpful' ? 'helpful' : 'aggravating'
              }.`,
          ),
      );
    }

    const sample =
      hasSessionIssueEvents && recentSessions.length > 0
        ? `Sample: ${formatCount(recentSessions.length, 'recent session', 'recent sessions')}`
        : eventCount > 0
          ? `Sample: ${formatCount(eventCount, 'issue record', 'issue records')}`
          : `Sample: ${formatCount(issueLinks.length, 'active issue link', 'active issue links')}`;

    return { lines, sample };
  }, [issueEvents, issueLinks, issueSummary, recentSessions]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.eyebrow}>History</Text>
              <Text style={styles.title} numberOfLines={1}>
                {exerciseName}
              </Text>
              <Text style={styles.headerMeta} numberOfLines={1}>
                {primaryMuscle ? primaryMuscle.replace(/_/g, ' ') : 'Exercise'}
                {' · '}
                {lastSession ? `Last ${formatFullDate(lastSession.startedAt)}` : 'Not logged yet'}
              </Text>
            </View>
            <TouchableOpacity style={styles.iconBtn} onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={16} color={T.textDim} />
            </TouchableOpacity>
          </View>

          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Sessions</Text>
              <Text style={styles.summaryValue}>{displayHistory.length}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Best 1RM</Text>
              <Text style={styles.summaryValue}>
                {bestEstimated1RM !== null ? bestEstimated1RM.toFixed(1) : '—'}
              </Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Best volume</Text>
              <Text style={styles.summaryValue}>
                {bestVolume !== null ? formatCompactValue(bestVolume) : '—'}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.suggestionCard,
              (!canApply || !onApplySuggestion) && styles.suggestionCardDisabled,
            ]}
            disabled={!canApply || !onApplySuggestion}
            onPress={() => {
              onApplySuggestion?.(suggestion);
              onClose();
            }}
          >
            <View style={styles.suggestionIcon}>
              <Ionicons name="trending-up-outline" size={17} color={T.accentInk} />
            </View>
            <View style={styles.suggestionBody}>
              <Text
                style={[
                  styles.suggestionLabel,
                  (!canApply || !onApplySuggestion) && styles.suggestionTextDisabled,
                ]}
              >
                {suggestion.reason}
              </Text>
              {canApply ? (
                <Text
                  style={[
                    styles.suggestionValue,
                    !onApplySuggestion && styles.suggestionTextDisabled,
                  ]}
                >
                  {suggestion.weight ?? '—'} {suggestion.unit} × {suggestion.reps ?? '—'}
                </Text>
              ) : (
                <Text style={[styles.suggestionValue, styles.suggestionTextDisabled]}>
                  Log a completed session first
                </Text>
              )}
            </View>
          </TouchableOpacity>

          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={T.accent} />
            </View>
          ) : (
            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
              {toleranceSummary && (
                <View style={styles.toleranceBlock} testID="exercise-history-tolerance-summary">
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionTitle}>Tolerance</Text>
                    <Text style={styles.sectionMeta}>Worth noticing</Text>
                  </View>
                  {toleranceSummary.lines.map((line) => (
                    <Text key={line} style={styles.toleranceLine}>
                      {line}
                    </Text>
                  ))}
                  <Text style={styles.toleranceSample}>{toleranceSummary.sample}</Text>
                </View>
              )}

              {displayHistory.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>No completed sessions yet.</Text>
                </View>
              ) : (
                <>
                  {(estimated1RMPoints.length > 0 || volumePoints.length > 0) && (
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>Progress graphs</Text>
                      {estimated1RMPoints.length > 0 && (
                        <View style={styles.graphBlock}>
                          <View style={styles.sectionHeaderRow}>
                            <Text style={styles.graphTitle}>Est. 1RM Trend</Text>
                            <Text style={styles.graphValue}>
                              {estimated1RMPoints[estimated1RMPoints.length - 1].value.toFixed(1)}
                            </Text>
                          </View>
                          <MiniLineGraph
                            points={estimated1RMPoints}
                            testID="exercise-history-estimated-1rm-graph"
                          />
                        </View>
                      )}
                      {volumePoints.length > 0 && (
                        <View style={styles.graphBlock}>
                          <View style={styles.sectionHeaderRow}>
                            <Text style={styles.graphTitle}>Volume Trend</Text>
                            <Text style={styles.graphValue}>
                              {formatWorkoutVolumeKg(volumePoints[volumePoints.length - 1].value)}
                            </Text>
                          </View>
                          <MiniBarGraph
                            points={volumePoints}
                            testID="exercise-history-volume-graph"
                          />
                        </View>
                      )}
                    </View>
                  )}

                  <View style={styles.section}>
                    <View style={styles.sectionHeaderRow}>
                      <Text style={styles.sectionTitle}>Consistency</Text>
                      <Text style={styles.sectionMeta}>10 weeks</Text>
                    </View>
                    <View style={styles.calendarGrid} testID="exercise-history-calendar">
                      {calendarDays.map((day) => (
                        <View
                          key={day.dateKey}
                          style={[styles.calendarDay, day.marked && styles.calendarDayMarked]}
                          testID={`exercise-history-calendar-day-${day.dateKey}`}
                        >
                          {day.marked ? (
                            <View
                              style={styles.calendarMark}
                              testID={`exercise-history-calendar-mark-${day.dateKey}`}
                            />
                          ) : null}
                        </View>
                      ))}
                    </View>
                  </View>

                  {recentPrs.length > 0 && (
                    <View style={styles.section}>
                      <Text style={styles.sectionTitle}>PR timeline</Text>
                      {recentPrs.map((record) => (
                        <View key={record.id} style={styles.prRow}>
                          <Text style={styles.prLabel}>{formatPR(record)}</Text>
                          <Text style={styles.prDate}>{formatDate(record.achieved_at)}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </>
              )}

              {issueLinks.length > 0 && (
                <View style={styles.issueLinksBlock}>
                  <Text style={styles.issueHistoryTitle}>Issue links</Text>
                  {issueLinks.map((link) => (
                    <View key={link.id} style={styles.issueLinkRow}>
                      <Text style={styles.issueHistoryName} numberOfLines={1}>
                        {link.issue_name}
                      </Text>
                      <Text style={styles.issueHistoryLine}>{formatLinkType(link.link_type)}</Text>
                      {link.note ? (
                        <Text style={styles.issueHistoryNote} numberOfLines={2}>
                          {link.note}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </View>
              )}

              {issueSummary.length > 0 && (
                <View style={styles.issueHistoryBlock}>
                  <Text style={styles.issueHistoryTitle}>Issue history</Text>
                  {issueSummary.map((item) => (
                    <TouchableOpacity
                      key={item.issueId}
                      style={styles.issueHistoryRow}
                      activeOpacity={0.78}
                      onPress={() => setSelectedIssueSummary(item)}
                      testID={`exercise-history-issue-row-${item.issueId}`}
                    >
                      <Text style={styles.issueHistoryName}>{item.issueName}</Text>
                      {item.aggravatedCount > 0 && (
                        <Text style={styles.issueHistoryLine}>
                          Aggravated {item.aggravatedCount}{' '}
                          {item.aggravatedCount === 1 ? 'time' : 'times'}
                        </Text>
                      )}
                      {item.helpedCount > 0 && (
                        <Text style={styles.issueHistoryLine}>
                          Helped {item.helpedCount} {item.helpedCount === 1 ? 'time' : 'times'}
                        </Text>
                      )}
                      {item.lastNote ? (
                        <Text style={styles.issueHistoryNote} numberOfLines={2}>
                          Last note: {item.lastNote}
                        </Text>
                      ) : null}
                      <View style={styles.issueHistoryAction}>
                        <Text style={styles.issueHistoryLatest}>
                          Latest {formatReaction(item.latestEvent.reaction_type)}
                          {item.latestEvent.severity !== null
                            ? ` · ${item.latestEvent.severity}/5`
                            : ''}
                        </Text>
                        <Ionicons name="create-outline" size={14} color={T.muted} />
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {recentSessions.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Recent Sessions</Text>
                  {recentSessions.map((session) => {
                    const sessionIssueEvents = issueEventsBySession.get(session.sessionId) ?? [];
                    return (
                      <View
                        key={session.sessionId}
                        style={styles.historyRow}
                        testID={`exercise-history-session-${session.sessionId}`}
                      >
                        <View style={styles.historyTop}>
                          <Text style={styles.historyDate}>{formatDate(session.startedAt)}</Text>
                          <Text style={styles.historyVolume}>
                            {formatWorkoutVolumeKg(calculateExerciseSessionVolume(session.sets))}
                          </Text>
                        </View>
                        <Text style={styles.historySets} numberOfLines={2}>
                          {formatSets(session)}
                        </Text>
                        <View style={styles.metricsRow}>
                          <Text style={styles.metric}>
                            Top {session.topSetWeight ?? '—'} × {session.topSetReps ?? '—'}
                          </Text>
                          <Text style={styles.metric}>{session.sets.length} sets</Text>
                          <Text style={styles.metric}>
                            1RM{' '}
                            {getBestEstimated1RMForSession(session.sets) !== null
                              ? getBestEstimated1RMForSession(session.sets)?.toFixed(1)
                              : '—'}
                          </Text>
                        </View>
                        {sessionIssueEvents.length > 0 && (
                          <View style={styles.sessionIssueBlock}>
                            {sessionIssueEvents.slice(0, 2).map((event) => (
                              <View key={event.id} style={styles.sessionIssueRow}>
                                <Text style={styles.sessionIssueText}>
                                  {formatIssueEvent(event, session)}
                                </Text>
                                {event.note ? (
                                  <Text style={styles.sessionIssueNote} numberOfLines={2}>
                                    {event.note}
                                  </Text>
                                ) : null}
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </View>
      <IssueReactionEditSheet
        visible={selectedIssueSummary !== null}
        event={selectedEvent}
        title="Edit Issue Record"
        subtitle={selectedIssueSummary?.issueName ?? null}
        saving={savingReaction}
        onClose={() => setSelectedIssueSummary(null)}
        onSave={(input) => void saveReaction(input)}
        onDelete={confirmDeleteReaction}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.62)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '82%',
    backgroundColor: T.bg,
    borderTopWidth: 1,
    borderTopColor: T.border,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 26,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerText: { flex: 1, minWidth: 0 },
  eyebrow: {
    fontFamily: 'Courier New',
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: T.muted,
  },
  title: { color: T.text, fontSize: 20, fontWeight: '700', marginTop: 2 },
  headerMeta: {
    color: T.textDim,
    fontSize: 12,
    marginTop: 4,
    textTransform: 'capitalize',
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: T.surface2,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryGrid: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
  },
  summaryItem: {
    flex: 1,
    minWidth: 0,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  summaryLabel: {
    color: T.muted,
    fontFamily: 'Courier New',
    fontSize: 10,
    textTransform: 'uppercase',
  },
  summaryValue: {
    color: T.text,
    fontFamily: 'Courier New',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  suggestionCard: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: T.accent,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  suggestionCardDisabled: { backgroundColor: T.surface },
  suggestionIcon: {
    width: 32,
    height: 32,
    borderRadius: 999,
    backgroundColor: 'rgba(10,10,10,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionBody: { flex: 1, minWidth: 0 },
  suggestionLabel: { color: T.accentInk, fontSize: 13, fontWeight: '700' },
  suggestionValue: {
    color: T.accentInk,
    fontFamily: 'Courier New',
    fontSize: 12,
    marginTop: 3,
  },
  suggestionTextDisabled: { color: T.textDim },
  loading: { paddingVertical: 32 },
  list: { marginTop: 12 },
  listContent: { gap: 8 },
  section: {
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  sectionTitle: {
    color: T.text,
    fontSize: 14,
    fontWeight: '700',
  },
  sectionMeta: {
    color: T.muted,
    fontFamily: 'Courier New',
    fontSize: 11,
  },
  graphBlock: {
    borderTopWidth: 1,
    borderTopColor: T.border,
    paddingTop: 10,
    gap: 7,
  },
  graphTitle: { color: T.textDim, fontSize: 12, fontWeight: '700' },
  graphValue: { color: T.text, fontFamily: 'Courier New', fontSize: 12 },
  graphFrame: {
    backgroundColor: T.surface2,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingTop: 10,
    paddingBottom: 6,
  },
  graphLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  graphLabel: { color: T.muted, fontFamily: 'Courier New', fontSize: 10 },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  calendarDay: {
    width: 11,
    height: 11,
    borderRadius: 3,
    backgroundColor: T.surface2,
    borderWidth: 1,
    borderColor: T.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDayMarked: {
    backgroundColor: accentAlpha(0.2),
    borderColor: T.accent,
  },
  calendarMark: {
    width: 5,
    height: 5,
    borderRadius: 999,
    backgroundColor: T.accent,
  },
  prRow: {
    borderTopWidth: 1,
    borderTopColor: T.border,
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  prLabel: { flex: 1, color: T.textDim, fontSize: 12 },
  prDate: { color: T.muted, fontFamily: 'Courier New', fontSize: 11 },
  issueHistoryBlock: {
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  issueLinksBlock: {
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  issueLinkRow: {
    borderTopWidth: 1,
    borderTopColor: T.border,
    paddingTop: 8,
    gap: 4,
  },
  issueHistoryTitle: {
    color: T.text,
    fontSize: 14,
    fontWeight: '700',
  },
  issueHistoryRow: {
    borderTopWidth: 1,
    borderTopColor: T.border,
    paddingTop: 8,
    gap: 4,
  },
  issueHistoryName: { color: T.text, fontSize: 13, fontWeight: '700' },
  issueHistoryLine: { color: T.textDim, fontFamily: 'Courier New', fontSize: 12 },
  issueHistoryNote: { color: T.muted, fontSize: 12 },
  issueHistoryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 2,
  },
  issueHistoryLatest: { color: T.muted, fontFamily: 'Courier New', fontSize: 11 },
  toleranceBlock: {
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  toleranceLine: { color: T.textDim, fontFamily: 'Courier New', fontSize: 12 },
  toleranceSample: {
    color: T.muted,
    fontFamily: 'Courier New',
    fontSize: 11,
    marginTop: 2,
  },
  empty: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: T.border,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  emptyText: { color: T.muted, fontSize: 13 },
  historyRow: {
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 12,
    padding: 12,
  },
  historyTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  historyDate: { color: T.text, fontSize: 14, fontWeight: '700' },
  historyVolume: { color: T.textDim, fontFamily: 'Courier New', fontSize: 12 },
  historySets: { color: T.textDim, fontFamily: 'Courier New', fontSize: 12, marginTop: 8 },
  metricsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  metric: {
    color: T.muted,
    fontFamily: 'Courier New',
    fontSize: 11,
    backgroundColor: T.surface2,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  sessionIssueBlock: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: T.border,
    paddingTop: 8,
    gap: 6,
  },
  sessionIssueRow: { gap: 3 },
  sessionIssueText: { color: T.warning, fontFamily: 'Courier New', fontSize: 11 },
  sessionIssueNote: { color: T.muted, fontSize: 12 },
});
