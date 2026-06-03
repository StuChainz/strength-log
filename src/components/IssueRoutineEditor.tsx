import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ExercisePicker } from '@/components/ExercisePicker';
import { T } from '@/theme/tokens';
import type { Exercise, ExerciseCategory } from '@/domain/types';

export interface IssueRoutineEditorItem {
  exerciseId: string;
  exerciseName: string;
  exerciseCategory: ExerciseCategory;
  targetSets: number | null;
  targetReps: number | null;
  note: string | null;
}

export interface SaveIssueRoutineInput {
  name: string;
  items: {
    exerciseId: string;
    targetSets: number;
    targetReps: number;
    note: string | null;
  }[];
}

interface DraftItem {
  key: string;
  exerciseId: string;
  exerciseName: string;
  exerciseCategory: ExerciseCategory;
  targetSets: string;
  targetReps: string;
  note: string;
}

interface IssueRoutineEditorProps {
  visible: boolean;
  issueName: string;
  initialName: string | null;
  initialItems: IssueRoutineEditorItem[];
  saving: boolean;
  onClose: () => void;
  onSave: (input: SaveIssueRoutineInput) => void;
}

let routineDraftKey = 0;
const nextRoutineDraftKey = () => `routine-item-${++routineDraftKey}`;

function parsePositiveInt(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function cleanNote(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toDraftItems(items: IssueRoutineEditorItem[]): DraftItem[] {
  return items.map((item) => ({
    key: nextRoutineDraftKey(),
    exerciseId: item.exerciseId,
    exerciseName: item.exerciseName,
    exerciseCategory: item.exerciseCategory,
    targetSets: item.targetSets !== null ? String(item.targetSets) : '',
    targetReps: item.targetReps !== null ? String(item.targetReps) : '',
    note: item.note ?? '',
  }));
}

export default function IssueRoutineEditor({
  visible,
  issueName,
  initialName,
  initialItems,
  saving,
  onClose,
  onSave,
}: IssueRoutineEditorProps) {
  const [name, setName] = useState('');
  const [items, setItems] = useState<DraftItem[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(initialName ?? `${issueName.trim() || 'Issue'} Routine`);
    setItems(toDraftItems(initialItems));
  }, [initialItems, initialName, issueName, visible]);

  const addExercise = (exercise: Exercise) => {
    setItems((prev) => [
      ...prev,
      {
        key: nextRoutineDraftKey(),
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        exerciseCategory: exercise.category,
        targetSets: '',
        targetReps: '',
        note: '',
      },
    ]);
    setPickerVisible(false);
  };

  const updateItem = (key: string, field: 'targetSets' | 'targetReps' | 'note', value: string) => {
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, [field]: value } : item)));
  };

  const removeItem = (key: string) => {
    setItems((prev) => prev.filter((item) => item.key !== key));
  };

  const parsedItems = items.map((item) => ({
    item,
    targetSets: parsePositiveInt(item.targetSets),
    targetReps: parsePositiveInt(item.targetReps),
  }));
  const canSave =
    name.trim().length > 0 &&
    parsedItems.length > 0 &&
    parsedItems.every((entry) => entry.targetSets !== null && entry.targetReps !== null) &&
    !saving;

  const save = () => {
    if (!canSave) return;
    onSave({
      name: name.trim(),
      items: parsedItems.map(({ item, targetSets, targetReps }) => ({
        exerciseId: item.exerciseId,
        targetSets: targetSets!,
        targetReps: targetReps!,
        note: cleanNote(item.note),
      })),
    });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <KeyboardAvoidingView
          style={styles.keyboard}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.sheet} testID="issue-routine-editor">
            <View style={styles.header}>
              <View>
                <Text style={styles.eyebrow}>Linked Routine</Text>
                <Text style={styles.title}>{initialName ? 'Edit Routine' : 'Create Routine'}</Text>
              </View>
              <TouchableOpacity style={styles.iconBtn} onPress={onClose} hitSlop={8}>
                <Ionicons name="close" size={17} color={T.textDim} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.content}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.fieldBlock}>
                <Text style={styles.label}>Routine Name</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Shoulder Pain Routine"
                  placeholderTextColor={T.muted}
                  testID="routine-name-input"
                />
              </View>

              <View style={styles.itemsHeader}>
                <Text style={styles.label}>Exercises</Text>
                <TouchableOpacity
                  style={styles.addBtn}
                  onPress={() => setPickerVisible(true)}
                  testID="add-routine-exercise-btn"
                >
                  <Ionicons name="add" size={14} color={T.accentInk} />
                  <Text style={styles.addText}>Add</Text>
                </TouchableOpacity>
              </View>

              {items.length === 0 ? (
                <View style={styles.empty} testID="empty-routine-exercises">
                  <Text style={styles.emptyText}>No exercises added yet.</Text>
                </View>
              ) : (
                <View style={styles.itemList}>
                  {items.map((item) => (
                    <View key={item.key} style={styles.itemRow} testID={`routine-item-${item.key}`}>
                      <View style={styles.itemTop}>
                        <View style={styles.itemTitle}>
                          <Text style={styles.itemName} numberOfLines={1}>
                            {item.exerciseName}
                          </Text>
                          <Text style={styles.itemCategory}>{item.exerciseCategory}</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.removeBtn}
                          onPress={() => removeItem(item.key)}
                          hitSlop={8}
                          testID={`remove-routine-item-${item.key}`}
                        >
                          <Ionicons name="close" size={14} color={T.muted} />
                        </TouchableOpacity>
                      </View>

                      <View style={styles.targetRow}>
                        <View style={styles.targetField}>
                          <Text style={styles.targetLabel}>Sets</Text>
                          <TextInput
                            style={styles.targetInput}
                            value={item.targetSets}
                            onChangeText={(value) => updateItem(item.key, 'targetSets', value)}
                            keyboardType="number-pad"
                            placeholder="-"
                            placeholderTextColor={T.muted}
                            maxLength={3}
                            testID={`routine-target-sets-${item.key}`}
                          />
                        </View>
                        <View style={styles.targetField}>
                          <Text style={styles.targetLabel}>Reps</Text>
                          <TextInput
                            style={styles.targetInput}
                            value={item.targetReps}
                            onChangeText={(value) => updateItem(item.key, 'targetReps', value)}
                            keyboardType="number-pad"
                            placeholder="-"
                            placeholderTextColor={T.muted}
                            maxLength={3}
                            testID={`routine-target-reps-${item.key}`}
                          />
                        </View>
                      </View>

                      <TextInput
                        style={styles.noteInput}
                        value={item.note}
                        onChangeText={(value) => updateItem(item.key, 'note', value)}
                        placeholder="Optional note"
                        placeholderTextColor={T.muted}
                        testID={`routine-note-${item.key}`}
                      />
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>

            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
                onPress={save}
                disabled={!canSave}
                testID="save-issue-routine-btn"
              >
                <Text style={styles.saveText}>{saving ? 'Saving...' : 'Save Routine'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
      <ExercisePicker
        visible={pickerVisible}
        onSelect={addExercise}
        onClose={() => setPickerVisible(false)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.66)',
    justifyContent: 'flex-end',
  },
  keyboard: { justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '88%',
    backgroundColor: T.bg,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: T.border,
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: T.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  eyebrow: {
    color: T.muted,
    fontFamily: 'Courier New',
    fontSize: 10.5,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  title: { color: T.text, fontSize: 20, fontWeight: '800', marginTop: 2 },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.borderBright,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { maxHeight: 520 },
  content: { padding: 18, gap: 14 },
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
    borderRadius: 10,
    color: T.text,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  itemsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  addBtn: {
    minHeight: 30,
    borderRadius: 999,
    backgroundColor: T.accent,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addText: { color: T.accentInk, fontSize: 12, fontWeight: '800' },
  empty: {
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 10,
    backgroundColor: T.surface,
    padding: 14,
  },
  emptyText: { color: T.muted, fontSize: 13 },
  itemList: { gap: 10 },
  itemRow: {
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  itemTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemTitle: { flex: 1, minWidth: 0 },
  itemName: { color: T.text, fontSize: 14, fontWeight: '800' },
  itemCategory: {
    color: T.muted,
    fontSize: 11,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: T.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetRow: { flexDirection: 'row', gap: 10 },
  targetField: { flex: 1, gap: 5 },
  targetLabel: {
    color: T.muted,
    fontFamily: 'Courier New',
    fontSize: 10,
    textTransform: 'uppercase',
  },
  targetInput: {
    minHeight: 38,
    backgroundColor: T.surface2,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 8,
    color: T.text,
    fontSize: 14,
    paddingHorizontal: 10,
    textAlign: 'center',
  },
  noteInput: {
    minHeight: 38,
    backgroundColor: T.surface2,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 8,
    color: T.text,
    fontSize: 13,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  footer: {
    padding: 18,
    borderTopWidth: 1,
    borderTopColor: T.border,
  },
  saveBtn: {
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: T.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnDisabled: { opacity: 0.55 },
  saveText: { color: T.accentInk, fontSize: 15, fontWeight: '800' },
});
