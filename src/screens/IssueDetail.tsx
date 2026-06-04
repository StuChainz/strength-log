import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ExercisePicker } from '@/components/ExercisePicker';
import IssueRoutineEditor, {
  type IssueRoutineEditorItem,
  type SaveIssueRoutineInput,
} from '@/components/IssueRoutineEditor';
import IssueReactionEditSheet from '@/components/IssueReactionEditSheet';
import { openDb } from '@/db/client';
import {
  archiveIssue,
  createIssueCheckin,
  createIssue,
  createIssueExerciseLink,
  createIssueRoutine,
  deleteExerciseIssueEvent,
  deleteIssueExerciseLink,
  getIssueCheckinTrend,
  getIssueById,
  getIssueExerciseLinks,
  getIssueRecentCheckins,
  getIssueRoutine,
  getIssueRoutineCompletionContext,
  getIssueRoutineItems,
  getIssueRecentEvents,
  removeIssueRoutine,
  type IssueCheckinTrend,
  type IssueRoutineCompletionContext,
  type IssueRoutineSummary,
  type IssueExerciseLinkWithExerciseName,
  type ExerciseIssueEventWithNames,
  updateIssueRoutine,
  updateIssueExerciseLink,
  updateExerciseIssueEvent,
  updateIssue,
} from '@/db/repositories/issues.repo';
import { T } from '@/theme/tokens';
import type { IssueDetailNavigationProp, IssueDetailRouteProp } from '@/navigation/types';
import type { Exercise, IssueCheckin, IssueExerciseLinkType } from '@/domain/types';

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatRelativeDate(ts: number, now = Date.now()): string {
  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.max(0, Math.floor((now - ts) / dayMs));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 14) return `${diffDays} days ago`;
  const weeks = Math.floor(diffDays / 7);
  return `${weeks} week${weeks === 1 ? '' : 's'} ago`;
}

function formatAverage(value: number): string {
  return value.toFixed(1);
}

function formatLastCompleted(ts: number | null): string | null {
  if (ts === null) return null;
  return `Last completed ${formatDate(ts)}`;
}

function formatReaction(value: string): string {
  return value === 'aggravated' ? 'Aggravated' : 'Helped';
}

function formatLinkType(value: IssueExerciseLinkType): string {
  return value === 'helpful' ? 'Helpful' : 'Aggravating';
}

function toRepoRoutineItems(input: SaveIssueRoutineInput) {
  return input.items.map((item) => ({
    exerciseId: item.exerciseId,
    targetSets: item.targetSets,
    targetReps: item.targetReps,
    note: item.note,
  }));
}

export default function IssueDetail() {
  const navigation = useNavigation<IssueDetailNavigationProp>();
  const route = useRoute<IssueDetailRouteProp>();
  const issueId = route.params?.issueId ?? null;
  const isNew = issueId === null;

  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [active, setActive] = useState(true);
  const [events, setEvents] = useState<ExerciseIssueEventWithNames[]>([]);
  const [checkins, setCheckins] = useState<IssueCheckin[]>([]);
  const [trend, setTrend] = useState<IssueCheckinTrend | null>(null);
  const [routineCompletionContext, setRoutineCompletionContext] =
    useState<IssueRoutineCompletionContext | null>(null);
  const [links, setLinks] = useState<IssueExerciseLinkWithExerciseName[]>([]);
  const [routine, setRoutine] = useState<IssueRoutineSummary | null>(null);
  const [routineItems, setRoutineItems] = useState<IssueRoutineEditorItem[]>([]);
  const [pendingRoutine, setPendingRoutine] = useState<SaveIssueRoutineInput | null>(null);
  const [linkNoteDrafts, setLinkNoteDrafts] = useState<Record<string, string>>({});
  const [initialSeverity, setInitialSeverity] = useState<number | null>(null);
  const [checkinSeverity, setCheckinSeverity] = useState<number | null>(null);
  const [checkinNote, setCheckinNote] = useState('');
  const [savingCheckin, setSavingCheckin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [routineEditorVisible, setRoutineEditorVisible] = useState(false);
  const [savingRoutine, setSavingRoutine] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<ExerciseIssueEventWithNames | null>(null);
  const [savingReaction, setSavingReaction] = useState(false);
  const [pickerLinkType, setPickerLinkType] = useState<IssueExerciseLinkType | null>(null);

  const load = useCallback(async () => {
    if (!issueId) return;
    const db = await openDb();
    const issue = await getIssueById(db, issueId);
    if (!issue) {
      navigation.goBack();
      return;
    }
    setName(issue.name);
    setNote(issue.note ?? '');
    setActive(issue.active === 1);
    const [linkRows, eventRows, routineRow, checkinRows, trendSummary, completionContext] =
      await Promise.all([
        getIssueExerciseLinks(db, issueId),
        getIssueRecentEvents(db, issueId, 12),
        getIssueRoutine(db, issueId),
        getIssueRecentCheckins(db, issueId, 6),
        getIssueCheckinTrend(db, issueId),
        getIssueRoutineCompletionContext(db, issueId),
      ]);
    const routineItemRows = routineRow ? await getIssueRoutineItems(db, issueId) : [];
    setLinks(linkRows);
    setLinkNoteDrafts(Object.fromEntries(linkRows.map((link) => [link.id, link.note ?? ''])));
    setEvents(eventRows);
    setCheckins(checkinRows);
    setTrend(trendSummary);
    setRoutineCompletionContext(completionContext);
    setRoutine(routineRow);
    setRoutineItems(
      routineItemRows.map((item) => ({
        exerciseId: item.exercise_id,
        exerciseName: item.exercise_name,
        exerciseCategory: item.exercise_category,
        targetSets: item.target_sets,
        targetReps: item.target_reps,
        note: item.note,
      })),
    );
  }, [issueId, navigation]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Issue name required', 'Add a name before saving.');
      return;
    }

    setSaving(true);
    try {
      const db = await openDb();
      if (isNew) {
        const createdIssue = await createIssue(db, { name: trimmedName, note });
        if (initialSeverity !== null) {
          await createIssueCheckin(db, {
            issueId: createdIssue.id,
            severity: initialSeverity,
            note: null,
          });
        }
        if (pendingRoutine) {
          await createIssueRoutine(db, {
            issueId: createdIssue.id,
            name: pendingRoutine.name,
            items: toRepoRoutineItems(pendingRoutine),
          });
        }
      } else {
        await updateIssue(db, issueId, { name: trimmedName, note, active });
      }
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  };

  const addExerciseLink = async (exercise: Exercise) => {
    if (!issueId || !pickerLinkType) return;
    const db = await openDb();
    await createIssueExerciseLink(db, {
      issueId,
      exerciseId: exercise.id,
      linkType: pickerLinkType,
    });
    setPickerLinkType(null);
    await load();
  };

  const confirmRemoveLink = (link: IssueExerciseLinkWithExerciseName) => {
    Alert.alert(
      'Remove exercise link?',
      `This removes ${link.exercise_name} from ${formatLinkType(link.link_type)} exercises.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            void openDb()
              .then((db) => deleteIssueExerciseLink(db, link.id))
              .then(load);
          },
        },
      ],
    );
  };

  const saveLinkNote = async (link: IssueExerciseLinkWithExerciseName) => {
    const nextNote = linkNoteDrafts[link.id] ?? '';
    if ((link.note ?? '') === nextNote.trim()) return;
    const db = await openDb();
    await updateIssueExerciseLink(db, link.id, { note: nextNote });
    await load();
  };

  const saveRoutine = async (input: SaveIssueRoutineInput) => {
    if (!issueId) {
      setPendingRoutine(input);
      setRoutineEditorVisible(false);
      return;
    }
    setSavingRoutine(true);
    try {
      const db = await openDb();
      if (routine) {
        await updateIssueRoutine(db, issueId, {
          name: input.name,
          items: toRepoRoutineItems(input),
        });
      } else {
        await createIssueRoutine(db, {
          issueId,
          name: input.name,
          items: toRepoRoutineItems(input),
        });
      }
      setRoutineEditorVisible(false);
      await load();
    } finally {
      setSavingRoutine(false);
    }
  };

  const saveCheckin = async () => {
    if (!issueId || checkinSeverity === null) {
      Alert.alert('Severity required', 'Choose a severity from 1 to 5 before saving.');
      return;
    }

    setSavingCheckin(true);
    try {
      const db = await openDb();
      await createIssueCheckin(db, {
        issueId,
        severity: checkinSeverity,
        note: checkinNote,
      });
      setCheckinSeverity(null);
      setCheckinNote('');
      await load();
    } finally {
      setSavingCheckin(false);
    }
  };

  const runRoutine = () => {
    if (!routine) return;
    navigation.navigate('LiveWorkout', { templateId: routine.template_id });
  };

  const confirmRemoveRoutine = () => {
    if (!issueId || !routine) return;
    Alert.alert(
      'Remove this routine?',
      'This removes the routine from this Issue.\nIt does not delete your logged workouts or exercise history.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            void openDb()
              .then((db) => removeIssueRoutine(db, issueId))
              .then(load);
          },
        },
      ],
    );
  };

  const renderRoutine = () => {
    if (isNew) {
      return (
        <View style={styles.routineBlock}>
          <View style={styles.routineHeader}>
            <Text style={styles.sectionLabel}>Issue Routine</Text>
            <TouchableOpacity
              style={styles.linkAddBtn}
              onPress={() => setRoutineEditorVisible(true)}
              testID={pendingRoutine ? 'edit-issue-routine-btn' : 'create-issue-routine-btn'}
            >
              <Ionicons
                name={pendingRoutine ? 'create-outline' : 'add'}
                size={14}
                color={T.accentInk}
              />
              <Text style={styles.linkAddText}>{pendingRoutine ? 'Edit' : 'Create routine'}</Text>
            </TouchableOpacity>
          </View>

          {!pendingRoutine ? (
            <Text style={styles.emptyText} testID="issue-routine-empty">
              No routine linked
            </Text>
          ) : (
            <View style={styles.routineSummary} testID="issue-routine-summary">
              <View style={styles.routineSummaryText}>
                <Text style={styles.routineName} numberOfLines={1} testID="issue-routine-name">
                  {pendingRoutine.name}
                </Text>
                <Text style={styles.routineMeta} testID="issue-routine-count">
                  {pendingRoutine.items.length} exercise
                  {pendingRoutine.items.length === 1 ? '' : 's'}
                </Text>
              </View>
            </View>
          )}
        </View>
      );
    }
    const lastCompleted = formatLastCompleted(routine?.last_completed_at ?? null);
    return (
      <View style={styles.routineBlock}>
        <View style={styles.routineHeader}>
          <Text style={styles.sectionLabel}>Issue Routine</Text>
          <TouchableOpacity
            style={styles.linkAddBtn}
            onPress={() => setRoutineEditorVisible(true)}
            testID={routine ? 'edit-issue-routine-btn' : 'create-issue-routine-btn'}
          >
            <Ionicons name={routine ? 'create-outline' : 'add'} size={14} color={T.accentInk} />
            <Text style={styles.linkAddText}>{routine ? 'Edit' : 'Create routine'}</Text>
          </TouchableOpacity>
        </View>

        {!routine ? (
          <Text style={styles.emptyText} testID="issue-routine-empty">
            No routine linked
          </Text>
        ) : (
          <View style={styles.routineSummary} testID="issue-routine-summary">
            <View style={styles.routineSummaryText}>
              <Text style={styles.routineName} numberOfLines={1} testID="issue-routine-name">
                {routine.routine_name}
              </Text>
              <Text style={styles.routineMeta} testID="issue-routine-count">
                {routine.exercise_count} exercise{routine.exercise_count === 1 ? '' : 's'}
                {lastCompleted ? ` · ${lastCompleted}` : ''}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.runRoutineBtn}
              onPress={runRoutine}
              testID="run-issue-routine-btn"
            >
              <Ionicons name="play" size={14} color={T.accentInk} />
              <Text style={styles.runRoutineText}>Run Routine</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.removeRoutineBtn}
              onPress={confirmRemoveRoutine}
              testID="remove-issue-routine-btn"
            >
              <Text style={styles.removeRoutineText}>Remove</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderTrendSummary = () => {
    if (!trend) return null;
    if (trend.status === 'insufficient') {
      return (
        <Text style={styles.trendBody} testID="issue-checkin-trend-insufficient">
          Not enough check-ins for a trend yet.
        </Text>
      );
    }

    const summary =
      trend.status === 'improving'
        ? 'Reported severity is lower recently.'
        : trend.status === 'worsening'
          ? 'Reported severity is higher recently.'
          : 'Reported severity looks broadly unchanged.';

    return (
      <View style={styles.trendSummary} testID={`issue-checkin-trend-${trend.status}`}>
        <Text style={styles.trendBody}>{summary}</Text>
        {trend.status !== 'stable' ? (
          <>
            <Text style={styles.trendMeta}>
              First 3-check-in average: {formatAverage(trend.firstThreeAverage)}
            </Text>
            <Text style={styles.trendMeta}>
              Latest 3-check-in average: {formatAverage(trend.latestThreeAverage)}
            </Text>
          </>
        ) : null}
        <Text style={styles.trendMeta}>Small sample: {trend.count} check-ins</Text>
      </View>
    );
  };

  const renderCheckins = () => {
    if (isNew) return null;
    return (
      <View style={styles.checkinBlock} testID="issue-checkin-area">
        <Text style={styles.sectionLabel}>How is this issue today?</Text>
        <View style={styles.severityRow}>
          {[1, 2, 3, 4, 5].map((value) => (
            <TouchableOpacity
              key={value}
              style={[styles.severityBtn, checkinSeverity === value && styles.severityBtnSelected]}
              onPress={() => setCheckinSeverity(value)}
              testID={`issue-checkin-severity-${value}`}
            >
              <Text
                style={[
                  styles.severityBtnText,
                  checkinSeverity === value && styles.severityBtnTextSelected,
                ]}
              >
                {value}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput
          style={styles.checkinNoteInput}
          value={checkinNote}
          onChangeText={setCheckinNote}
          placeholder="Optional note"
          placeholderTextColor={T.muted}
          multiline
          textAlignVertical="top"
          testID="issue-checkin-note-input"
        />
        <TouchableOpacity
          style={[
            styles.checkinSaveBtn,
            (checkinSeverity === null || savingCheckin) && styles.saveBtnDisabled,
          ]}
          onPress={() => void saveCheckin()}
          disabled={checkinSeverity === null || savingCheckin}
          testID="save-issue-checkin-btn"
        >
          <Text style={styles.checkinSaveText}>
            {savingCheckin ? 'Saving...' : 'Save Check-in'}
          </Text>
        </TouchableOpacity>

        <View style={styles.trendBlock}>
          <Text style={styles.sectionLabel}>Trend Summary</Text>
          {renderTrendSummary()}
        </View>

        {routineCompletionContext ? (
          <View style={styles.routineContext} testID="issue-routine-completion-context">
            <Text style={styles.routineContextLabel}>Linked routine completed:</Text>
            <Text style={styles.routineContextValue}>
              {routineCompletionContext.completedLast30Days} time
              {routineCompletionContext.completedLast30Days === 1 ? '' : 's'} in the last 30 days
            </Text>
          </View>
        ) : null}

        <View style={styles.recentCheckinsBlock}>
          <Text style={styles.sectionLabel}>Recent Check-ins</Text>
          {checkins.length === 0 ? (
            <Text style={styles.emptyText}>No check-ins recorded yet.</Text>
          ) : (
            checkins.map((checkin) => (
              <View
                key={checkin.id}
                style={styles.checkinRow}
                testID={`issue-checkin-${checkin.id}`}
              >
                <Text style={styles.checkinLine}>
                  {checkin.severity}/5 · {formatRelativeDate(checkin.created_at)}
                  {checkin.note ? ` · "${checkin.note}"` : ''}
                </Text>
              </View>
            ))
          )}
        </View>
      </View>
    );
  };

  const renderInitialSeverity = () => {
    if (!isNew) return null;
    return (
      <View style={styles.fieldBlock}>
        <Text style={styles.label}>Starting Severity</Text>
        <View style={styles.severityRow}>
          {[1, 2, 3, 4, 5].map((value) => (
            <TouchableOpacity
              key={value}
              style={[styles.severityBtn, initialSeverity === value && styles.severityBtnSelected]}
              onPress={() => setInitialSeverity((prev) => (prev === value ? null : value))}
              testID={`initial-issue-severity-${value}`}
            >
              <Text
                style={[
                  styles.severityBtnText,
                  initialSeverity === value && styles.severityBtnTextSelected,
                ]}
              >
                {value}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  };

  const renderExerciseLinks = (linkType: IssueExerciseLinkType) => {
    const sectionLinks = links.filter((link) => link.link_type === linkType);
    return (
      <View style={styles.linkBlock}>
        <View style={styles.linkHeader}>
          <Text style={styles.sectionLabel}>{formatLinkType(linkType)} Exercises</Text>
          <TouchableOpacity
            style={styles.linkAddBtn}
            onPress={() => setPickerLinkType(linkType)}
            testID={`add-${linkType}-exercise-link-btn`}
          >
            <Ionicons name="add" size={14} color={T.accentInk} />
            <Text style={styles.linkAddText}>Add</Text>
          </TouchableOpacity>
        </View>
        {sectionLinks.length === 0 ? (
          <Text style={styles.emptyText}>No exercises linked yet.</Text>
        ) : (
          sectionLinks.map((link) => (
            <View key={link.id} style={styles.linkRow} testID={`issue-exercise-link-${link.id}`}>
              <View style={styles.linkTop}>
                <Text style={styles.linkExerciseName} numberOfLines={1}>
                  {link.exercise_name}
                </Text>
                <TouchableOpacity
                  style={styles.linkRemoveBtn}
                  onPress={() => confirmRemoveLink(link)}
                  hitSlop={8}
                  testID={`remove-issue-exercise-link-${link.id}`}
                >
                  <Ionicons name="close" size={14} color={T.muted} />
                </TouchableOpacity>
              </View>
              <TextInput
                style={styles.linkNoteInput}
                value={linkNoteDrafts[link.id] ?? ''}
                onChangeText={(value) =>
                  setLinkNoteDrafts((prev) => ({ ...prev, [link.id]: value }))
                }
                onBlur={() => void saveLinkNote(link)}
                placeholder="Optional note"
                placeholderTextColor={T.muted}
                testID={`issue-exercise-link-note-${link.id}`}
              />
            </View>
          ))
        )}
      </View>
    );
  };

  const archive = () => {
    if (!issueId) return;
    Alert.alert('Archive Issue?', 'Historical exercise records will stay visible.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        style: 'destructive',
        onPress: () => {
          void openDb()
            .then((db) => archiveIssue(db, issueId))
            .then(() => {
              setActive(false);
              void load();
            });
        },
      },
    ]);
  };

  const saveReaction = async (input: {
    reactionType: 'aggravated' | 'helped';
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
      setSelectedEvent(null);
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
                setSelectedEvent(null);
                await load();
              });
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() => navigation.goBack()}
          hitSlop={8}
          testID="issue-detail-back-btn"
        >
          <Ionicons name="arrow-back" size={20} color={T.textDim} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>Issue</Text>
          <Text style={styles.title}>{isNew ? 'New Issue' : 'Issue Detail'}</Text>
        </View>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.fieldBlock}>
          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Shoulder pain"
            placeholderTextColor={T.muted}
            autoCapitalize="words"
            testID="issue-name-input"
          />
        </View>

        <View style={styles.fieldBlock}>
          <Text style={styles.label}>Note</Text>
          <TextInput
            style={[styles.input, styles.noteInput]}
            value={note}
            onChangeText={setNote}
            placeholder="Optional"
            placeholderTextColor={T.muted}
            multiline
            textAlignVertical="top"
            testID="issue-note-input"
          />
        </View>

        {renderInitialSeverity()}

        {!isNew && (
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Active</Text>
            <TouchableOpacity
              style={[styles.statusToggle, active && styles.statusToggleActive]}
              onPress={() => setActive((prev) => !prev)}
              testID="issue-active-toggle"
            >
              <Text style={[styles.statusToggleText, active && styles.statusToggleTextActive]}>
                {active ? 'Active' : 'Archived'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {isNew && renderRoutine()}

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
          onPress={() => void save()}
          disabled={saving}
          testID="save-issue-btn"
        >
          <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save'}</Text>
        </TouchableOpacity>

        {!isNew && active && (
          <TouchableOpacity style={styles.archiveBtn} onPress={archive} testID="archive-issue-btn">
            <Text style={styles.archiveText}>Archive Issue</Text>
          </TouchableOpacity>
        )}

        {!isNew && renderRoutine()}
        {renderCheckins()}

        {!isNew && (
          <>
            {renderExerciseLinks('helpful')}
            {renderExerciseLinks('aggravating')}
          </>
        )}

        {!isNew && (
          <View style={styles.historyBlock}>
            <Text style={styles.sectionLabel}>Recent Exercise Reactions</Text>
            {events.length === 0 ? (
              <Text style={styles.emptyText}>No exercise reactions recorded yet.</Text>
            ) : (
              events.map((event) => (
                <TouchableOpacity
                  key={event.id}
                  style={styles.eventRow}
                  activeOpacity={0.78}
                  onPress={() => setSelectedEvent(event)}
                  testID={`issue-reaction-row-${event.id}`}
                >
                  <View style={styles.eventTop}>
                    <Text style={styles.eventExercise} numberOfLines={1}>
                      {event.exercise_name}
                    </Text>
                    <Text style={styles.eventDate}>{formatDate(event.created_at)}</Text>
                  </View>
                  <Text style={styles.eventReaction}>
                    {formatReaction(event.reaction_type)}
                    {event.severity !== null ? ` · ${event.severity}/5` : ''}
                  </Text>
                  {event.note ? <Text style={styles.eventNote}>{event.note}</Text> : null}
                </TouchableOpacity>
              ))
            )}
          </View>
        )}
      </ScrollView>
      <IssueReactionEditSheet
        visible={selectedEvent !== null}
        event={selectedEvent}
        title="Edit Issue Record"
        subtitle={selectedEvent?.exercise_name ?? null}
        saving={savingReaction}
        onClose={() => setSelectedEvent(null)}
        onSave={(input) => void saveReaction(input)}
        onDelete={confirmDeleteReaction}
      />
      <ExercisePicker
        visible={pickerLinkType !== null}
        onSelect={(exercise) => void addExerciseLink(exercise)}
        onClose={() => setPickerLinkType(null)}
      />
      <IssueRoutineEditor
        visible={routineEditorVisible}
        issueName={name}
        initialName={pendingRoutine?.name ?? routine?.routine_name ?? null}
        initialItems={pendingRoutine?.items ?? routineItems}
        saving={savingRoutine}
        onClose={() => setRoutineEditorVisible(false)}
        onSave={(input) => void saveRoutine(input)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 999,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.borderBright,
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
  title: { color: T.text, fontSize: 25, fontWeight: '700', marginTop: 2 },
  container: { flex: 1 },
  content: { padding: 18, gap: 14, paddingBottom: 32 },
  fieldBlock: { gap: 7 },
  label: {
    color: T.muted,
    fontFamily: 'Courier New',
    fontSize: 10.5,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 12,
    color: T.text,
    fontSize: 15,
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  noteInput: { minHeight: 96 },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 12,
    padding: 12,
  },
  statusLabel: { color: T.text, fontSize: 15, fontWeight: '700' },
  statusToggle: {
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: T.borderBright,
    paddingHorizontal: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusToggleActive: { backgroundColor: T.accent, borderColor: T.accent },
  statusToggleText: { color: T.textDim, fontSize: 12, fontWeight: '700' },
  statusToggleTextActive: { color: T.accentInk },
  saveBtn: {
    backgroundColor: T.accent,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveText: { color: T.accentInk, fontSize: 15, fontWeight: '700' },
  archiveBtn: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,122,106,0.35)',
    paddingVertical: 14,
    alignItems: 'center',
  },
  archiveText: { color: T.danger, fontSize: 14, fontWeight: '700' },
  routineBlock: {
    marginTop: 8,
    gap: 9,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 12,
    padding: 12,
  },
  routineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  routineSummary: {
    borderTopWidth: 1,
    borderTopColor: T.border,
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  routineSummaryText: { flex: 1, minWidth: 0 },
  routineName: { color: T.text, fontSize: 15, fontWeight: '800' },
  routineMeta: {
    color: T.textDim,
    fontFamily: 'Courier New',
    fontSize: 11,
    marginTop: 4,
  },
  runRoutineBtn: {
    minHeight: 34,
    borderRadius: 999,
    backgroundColor: T.accent,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    flexShrink: 0,
  },
  runRoutineText: { color: T.accentInk, fontSize: 12, fontWeight: '900' },
  removeRoutineBtn: {
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,122,106,0.35)',
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  removeRoutineText: { color: T.danger, fontSize: 12, fontWeight: '800' },
  checkinBlock: {
    marginTop: 8,
    gap: 10,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 12,
    padding: 12,
  },
  severityRow: { flexDirection: 'row', gap: 8 },
  severityBtn: {
    width: 42,
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: T.borderBright,
    backgroundColor: T.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  severityBtnSelected: { backgroundColor: T.accent, borderColor: T.accent },
  severityBtnText: { color: T.textDim, fontSize: 14, fontWeight: '800' },
  severityBtnTextSelected: { color: T.accentInk },
  checkinNoteInput: {
    minHeight: 58,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: T.border,
    color: T.text,
    fontSize: 13,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  checkinSaveBtn: {
    minHeight: 40,
    borderRadius: 12,
    backgroundColor: T.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkinSaveText: { color: T.accentInk, fontSize: 13, fontWeight: '900' },
  trendBlock: {
    borderTopWidth: 1,
    borderTopColor: T.border,
    paddingTop: 10,
    gap: 6,
  },
  trendSummary: { gap: 4 },
  trendBody: { color: T.text, fontSize: 13 },
  trendMeta: { color: T.textDim, fontFamily: 'Courier New', fontSize: 11 },
  routineContext: {
    borderTopWidth: 1,
    borderTopColor: T.border,
    paddingTop: 10,
    gap: 3,
  },
  routineContextLabel: { color: T.textDim, fontSize: 12, fontWeight: '700' },
  routineContextValue: { color: T.text, fontSize: 13 },
  recentCheckinsBlock: {
    borderTopWidth: 1,
    borderTopColor: T.border,
    paddingTop: 10,
    gap: 7,
  },
  checkinRow: {
    backgroundColor: T.surface2,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  checkinLine: { color: T.text, fontSize: 13 },
  linkBlock: {
    marginTop: 8,
    gap: 8,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 12,
    padding: 12,
  },
  linkHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  linkAddBtn: {
    minHeight: 30,
    borderRadius: 999,
    backgroundColor: T.accent,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  linkAddText: { color: T.accentInk, fontSize: 12, fontWeight: '800' },
  linkRow: {
    borderTopWidth: 1,
    borderTopColor: T.border,
    paddingTop: 8,
    gap: 7,
  },
  linkTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  linkExerciseName: { flex: 1, color: T.text, fontSize: 14, fontWeight: '700' },
  linkRemoveBtn: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: T.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkNoteInput: {
    minHeight: 36,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: T.border,
    color: T.text,
    fontSize: 13,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  historyBlock: { marginTop: 8, gap: 8 },
  sectionLabel: {
    color: T.muted,
    fontFamily: 'Courier New',
    fontSize: 10.5,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  emptyText: { color: T.muted, fontSize: 13 },
  eventRow: {
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 12,
    padding: 12,
  },
  eventTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  eventExercise: { flex: 1, color: T.text, fontSize: 14, fontWeight: '700' },
  eventDate: { color: T.muted, fontFamily: 'Courier New', fontSize: 11 },
  eventReaction: { color: T.textDim, fontFamily: 'Courier New', fontSize: 12, marginTop: 6 },
  eventNote: { color: T.text, fontSize: 13, marginTop: 7 },
});
