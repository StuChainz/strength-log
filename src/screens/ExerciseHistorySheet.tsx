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
import IssueReactionEditSheet from '@/components/IssueReactionEditSheet';
import { openDb } from '@/db/client';
import { getExerciseHistory, type ExerciseHistorySession } from '@/db/repositories/history.repo';
import {
  deleteExerciseIssueEvent,
  getExerciseIssueSummary,
  type ExerciseIssueSummary,
  updateExerciseIssueEvent,
} from '@/db/repositories/issues.repo';
import {
  getProgressionSuggestion,
  type ProgressionExercise,
  type ProgressionRuleConfig,
  type ProgressionSuggestion,
} from '@/domain/progression';
import { formatWorkoutVolumeKg } from '@/domain/volume';
import { T } from '@/theme/tokens';
import type { ExerciseCategory, ExerciseIssueEvent, IssueReactionType, Unit } from '@/domain/types';

interface ExerciseHistorySheetProps {
  visible: boolean;
  exerciseId: string | null;
  exerciseName: string;
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

export default function ExerciseHistorySheet({
  visible,
  exerciseId,
  exerciseName,
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
  const [issueSummary, setIssueSummary] = useState<ExerciseIssueSummary[]>([]);
  const [loadedExerciseId, setLoadedExerciseId] = useState<string | null>(null);
  const [selectedIssueSummary, setSelectedIssueSummary] = useState<ExerciseIssueSummary | null>(
    null,
  );
  const [savingReaction, setSavingReaction] = useState(false);
  const loading = visible && exerciseId !== null && loadedExerciseId !== exerciseId;

  const load = useCallback(async () => {
    if (!exerciseId) return;
    const db = await openDb();
    const [historyRows, issueRows] = await Promise.all([
      getExerciseHistory(db, exerciseId, 5),
      getExerciseIssueSummary(db, exerciseId),
    ]);
    setHistory(historyRows);
    setIssueSummary(issueRows);
    setLoadedExerciseId(exerciseId);
  }, [exerciseId]);

  useEffect(() => {
    if (!visible || !exerciseId) return;
    load().catch(() => {});
  }, [exerciseId, load, visible]);

  const selectedEvent: ExerciseIssueEvent | null = selectedIssueSummary?.latestEvent ?? null;

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
      recentSets: history[0]?.sets ?? [],
      previousSessionSets: history[1]?.sets ?? [],
    });
  }, [
    category,
    defaultUnit,
    history,
    progressionExercise,
    progressionRule,
    targetReps,
    targetSets,
    targetWeight,
  ]);

  const canApply = suggestion.weight !== null || suggestion.reps !== null;

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
            </View>
            <TouchableOpacity style={styles.iconBtn} onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={16} color={T.textDim} />
            </TouchableOpacity>
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

              {history.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyText}>No completed sessions yet.</Text>
                </View>
              ) : (
                history.map((session) => (
                  <View key={session.sessionId} style={styles.historyRow}>
                    <View style={styles.historyTop}>
                      <Text style={styles.historyDate}>{formatDate(session.startedAt)}</Text>
                      <Text style={styles.historyVolume}>
                        {formatWorkoutVolumeKg(session.volume)}
                      </Text>
                    </View>
                    <Text style={styles.historySets} numberOfLines={2}>
                      {formatSets(session)}
                    </Text>
                    <View style={styles.metricsRow}>
                      <Text style={styles.metric}>
                        Top {session.topSetWeight ?? '—'} × {session.topSetReps ?? '—'}
                      </Text>
                      <Text style={styles.metric}>
                        1RM {session.est1rm !== null ? session.est1rm.toFixed(1) : '—'}
                      </Text>
                    </View>
                  </View>
                ))
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
  issueHistoryBlock: {
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 12,
    padding: 12,
    gap: 8,
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
  metricsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  metric: {
    color: T.muted,
    fontFamily: 'Courier New',
    fontSize: 11,
    backgroundColor: T.surface2,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
});
