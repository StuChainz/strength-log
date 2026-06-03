import { useEffect, useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { T } from '@/theme/tokens';
import type { ExerciseIssueEvent, IssueReactionType } from '@/domain/types';

interface IssueReactionEditSheetProps {
  visible: boolean;
  event: ExerciseIssueEvent | null;
  title: string;
  subtitle?: string | null;
  saving?: boolean;
  onClose: () => void;
  onSave: (input: {
    reactionType: IssueReactionType;
    severity: number;
    note: string;
  }) => void;
  onDelete: () => void;
}

export default function IssueReactionEditSheet({
  visible,
  event,
  title,
  subtitle,
  saving = false,
  onClose,
  onSave,
  onDelete,
}: IssueReactionEditSheetProps) {
  const [reactionType, setReactionType] = useState<IssueReactionType>('aggravated');
  const [severity, setSeverity] = useState<number | null>(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (!event) return;
    setReactionType(event.reaction_type);
    setSeverity(event.severity);
    setNote(event.note ?? '');
  }, [event]);

  const canSave = event !== null && severity !== null && !saving;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet} testID="issue-reaction-edit-sheet">
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>{title}</Text>
              {subtitle ? (
                <Text style={styles.subtitle} numberOfLines={1}>
                  {subtitle}
                </Text>
              ) : null}
            </View>
            <TouchableOpacity style={styles.iconBtn} onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={16} color={T.textDim} />
            </TouchableOpacity>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Reaction</Text>
            <View style={styles.segmented}>
              {(['aggravated', 'helped'] as IssueReactionType[]).map((reaction) => (
                <TouchableOpacity
                  key={reaction}
                  style={[styles.segment, reactionType === reaction && styles.segmentActive]}
                  onPress={() => setReactionType(reaction)}
                  testID={`edit-issue-reaction-${reaction}`}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      reactionType === reaction && styles.segmentTextActive,
                    ]}
                  >
                    {reaction === 'aggravated' ? 'Aggravated' : 'Helped'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Severity</Text>
            <View style={styles.severityRow}>
              {[1, 2, 3, 4, 5].map((value) => (
                <TouchableOpacity
                  key={value}
                  style={[styles.severityBtn, severity === value && styles.severityBtnActive]}
                  onPress={() => setSeverity(value)}
                  testID={`edit-issue-severity-${value}`}
                >
                  <Text
                    style={[styles.severityText, severity === value && styles.severityTextActive]}
                  >
                    {value}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Note</Text>
            <TextInput
              style={styles.noteInput}
              value={note}
              onChangeText={setNote}
              placeholder="Optional"
              placeholderTextColor={T.muted}
              multiline
              textAlignVertical="top"
              testID="edit-issue-note-input"
            />
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={onDelete}
              disabled={!event || saving}
              testID="delete-issue-reaction-btn"
            >
              <Text style={styles.deleteText}>Delete</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
              onPress={() => {
                if (severity === null) return;
                onSave({ reactionType, severity, note });
              }}
              disabled={!canSave}
              testID="save-issue-reaction-edit-btn"
            >
              <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
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
    backgroundColor: T.bg,
    borderTopWidth: 1,
    borderTopColor: T.border,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 28,
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerText: { flex: 1, minWidth: 0 },
  title: { color: T.text, fontSize: 18, fontWeight: '700' },
  subtitle: { color: T.textDim, fontSize: 12, marginTop: 3 },
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
  field: { gap: 8 },
  label: {
    fontFamily: 'Courier New',
    fontSize: 10.5,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: T.muted,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: T.surface2,
    borderWidth: 1,
    borderColor: T.borderBright,
    borderRadius: 12,
    padding: 3,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 9,
  },
  segmentActive: { backgroundColor: T.surface3 },
  segmentText: { color: T.textDim, fontSize: 13, fontWeight: '700' },
  segmentTextActive: { color: T.text },
  severityRow: { flexDirection: 'row', gap: 7 },
  severityBtn: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: T.border,
    backgroundColor: T.surface,
  },
  severityBtnActive: { backgroundColor: T.text, borderColor: T.text },
  severityText: { color: T.textDim, fontFamily: 'Courier New', fontSize: 13, fontWeight: '700' },
  severityTextActive: { color: T.bg },
  noteInput: {
    minHeight: 82,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 12,
    color: T.text,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  actions: { flexDirection: 'row', gap: 8 },
  deleteBtn: {
    minWidth: 104,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,122,106,0.35)',
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteText: { color: T.danger, fontSize: 14, fontWeight: '700' },
  saveBtn: {
    flex: 1,
    backgroundColor: T.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.45 },
  saveText: { color: T.accentInk, fontSize: 15, fontWeight: '700' },
});
