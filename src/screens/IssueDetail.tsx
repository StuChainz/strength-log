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
import IssueReactionEditSheet from '@/components/IssueReactionEditSheet';
import { openDb } from '@/db/client';
import {
  archiveIssue,
  createIssue,
  deleteExerciseIssueEvent,
  getIssueById,
  getIssueRecentEvents,
  type ExerciseIssueEventWithNames,
  updateExerciseIssueEvent,
  updateIssue,
} from '@/db/repositories/issues.repo';
import { T } from '@/theme/tokens';
import type { IssueDetailNavigationProp, IssueDetailRouteProp } from '@/navigation/types';

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatReaction(value: string): string {
  return value === 'aggravated' ? 'Aggravated' : 'Helped';
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
  const [saving, setSaving] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<ExerciseIssueEventWithNames | null>(null);
  const [savingReaction, setSavingReaction] = useState(false);

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
    setEvents(await getIssueRecentEvents(db, issueId, 12));
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
        await createIssue(db, { name: trimmedName, note });
      } else {
        await updateIssue(db, issueId, { name: trimmedName, note, active });
      }
      navigation.goBack();
    } finally {
      setSaving(false);
    }
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
