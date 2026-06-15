import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { openDb } from '@/db/client';
import {
  createTemplate,
  updateTemplate,
  archiveTemplate,
  getTemplateById,
  getTemplateItemsWithExercise,
} from '@/db/repositories/templates.repo';
import { ExercisePicker } from '@/components/ExercisePicker';
import type { Exercise, ExerciseCategory, ProgressionRule, Unit } from '@/domain/types';
import type { TemplateBuilderNavigationProp, TemplateBuilderRouteProp } from '@/navigation/types';

// ── Draft types ───────────────────────────────────────────────────────────────

type DraftItem = {
  key: string;
  exercise_id: string;
  exercise_name: string;
  exercise_category: ExerciseCategory;
  exercise_default_unit: Unit | null;
  target_sets: string;
  target_reps: string;
  target_weight: string;
  target_rpe: string;
  rest_seconds: string;
  progression_rule: ProgressionRule;
  increment: string;
  rep_range_min: string;
  rep_range_max: string;
  rpe_cap: string;
  amrap_last_set: boolean;
};

const REST_PRESETS_SECONDS = [60, 90, 120, 180] as const;
const PROGRESSION_OPTIONS: { value: ProgressionRule; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'linear', label: 'Linear' },
  { value: 'double', label: 'Double' },
  { value: 'rpe_gated', label: 'RPE-gated' },
];

let draftKeyCounter = 0;
const nextKey = () => String(++draftKeyCounter);

function parseOptionalInt(s: string): number | null {
  const n = parseInt(s, 10);
  return isNaN(n) || n <= 0 ? null : n;
}

function parseOptionalRestSeconds(s: string): number | null {
  const trimmed = s.trim();
  if (trimmed.length === 0 || !/^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

function parseOptionalFloat(s: string): number | null {
  const n = parseFloat(s);
  return isNaN(n) || n <= 0 ? null : n;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TemplateBuilder() {
  const navigation = useNavigation<TemplateBuilderNavigationProp>();
  const route = useRoute<TemplateBuilderRouteProp>();
  const templateId = route.params?.templateId;
  const isEditMode = !!templateId;

  const [templateName, setTemplateName] = useState('');
  const [templateNotes, setTemplateNotes] = useState('');
  const [items, setItems] = useState<DraftItem[]>([]);
  const [nameError, setNameError] = useState<string | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  const dbRef = useRef<Awaited<ReturnType<typeof openDb>> | null>(null);
  const getDb = useCallback(async () => {
    if (!dbRef.current) dbRef.current = await openDb();
    return dbRef.current;
  }, []);

  // ── Load existing template in edit mode ───────────────────────────────────
  useEffect(() => {
    if (!templateId) return;
    (async () => {
      const db = await getDb();
      const [tmpl, existingItems] = await Promise.all([
        getTemplateById(db, templateId),
        getTemplateItemsWithExercise(db, templateId),
      ]);
      if (!tmpl) return;
      setTemplateName(tmpl.name);
      setTemplateNotes(tmpl.notes ?? '');
      setItems(
        existingItems.map((it) => ({
          key: nextKey(),
          exercise_id: it.exercise_id,
          exercise_name: it.exercise_name,
          exercise_category: it.exercise_category,
          exercise_default_unit: it.exercise_default_unit,
          target_sets: it.target_sets != null ? String(it.target_sets) : '',
          target_reps: it.target_reps != null ? String(it.target_reps) : '',
          target_weight: it.target_weight != null ? String(it.target_weight) : '',
          target_rpe: it.target_rpe != null ? String(it.target_rpe) : '',
          rest_seconds: it.rest_seconds != null ? String(it.rest_seconds) : '',
          progression_rule: it.progression_rule ?? 'none',
          increment:
            it.exercise_default_unit === 'lb'
              ? it.increment_lb != null
                ? String(it.increment_lb)
                : ''
              : it.increment_kg != null
                ? String(it.increment_kg)
                : '',
          rep_range_min: it.rep_range_min != null ? String(it.rep_range_min) : '',
          rep_range_max: it.rep_range_max != null ? String(it.rep_range_max) : '',
          rpe_cap: it.rpe_cap != null ? String(it.rpe_cap) : '',
          amrap_last_set: it.amrap_last_set === 1,
        })),
      );
    })();
  }, [templateId, getDb]);

  // ── Exercise picker ───────────────────────────────────────────────────────
  const handleExerciseSelected = (exercise: Exercise) => {
    setItems((prev) => [
      ...prev,
      {
        key: nextKey(),
        exercise_id: exercise.id,
        exercise_name: exercise.name,
        exercise_category: exercise.category,
        exercise_default_unit: exercise.default_unit,
        target_sets: '',
        target_reps: '',
        target_weight: '',
        target_rpe: '',
        rest_seconds: '',
        progression_rule: 'none',
        increment: '',
        rep_range_min: '',
        rep_range_max: '',
        rpe_cap: '',
        amrap_last_set: false,
      },
    ]);
  };

  // ── Reorder ───────────────────────────────────────────────────────────────
  const moveUp = (index: number) => {
    if (index === 0) return;
    setItems((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index]!, next[index - 1]!];
      return next;
    });
  };

  const moveDown = (index: number) => {
    setItems((prev) => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1]!, next[index]!];
      return next;
    });
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateItemField = (
    index: number,
    field: keyof Pick<
      DraftItem,
      | 'target_sets'
      | 'target_reps'
      | 'target_weight'
      | 'target_rpe'
      | 'rest_seconds'
      | 'increment'
      | 'rep_range_min'
      | 'rep_range_max'
      | 'rpe_cap'
    >,
    value: string,
  ) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const toggleAmrapLastSet = (index: number) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, amrap_last_set: !item.amrap_last_set } : item,
      ),
    );
  };

  const updateItemRule = (index: number, progressionRule: ProgressionRule) => {
    setItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              progression_rule: progressionRule,
              rep_range_min: progressionRule === 'double' ? item.rep_range_min : '',
              rep_range_max: progressionRule === 'double' ? item.rep_range_max : '',
              rpe_cap: progressionRule === 'rpe_gated' ? item.rpe_cap : '',
            }
          : item,
      ),
    );
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const canSave = templateName.trim().length > 0 && items.length > 0;

  const handleSave = async () => {
    if (!templateName.trim()) {
      setNameError('Template name is required');
      return;
    }
    if (items.length === 0) return;
    setNameError(null);
    setSaving(true);

    try {
      const db = await getDb();
      const draftItems = items.map((it) => {
        const increment = parseOptionalFloat(it.increment);
        return {
          exercise_id: it.exercise_id,
          target_sets: parseOptionalInt(it.target_sets),
          target_reps: parseOptionalInt(it.target_reps),
          target_weight: parseOptionalFloat(it.target_weight),
          target_rpe: parseOptionalFloat(it.target_rpe),
          rest_seconds: parseOptionalRestSeconds(it.rest_seconds),
          progression_rule: it.progression_rule,
          increment_kg: it.exercise_default_unit === 'lb' ? null : increment,
          increment_lb: it.exercise_default_unit === 'lb' ? increment : null,
          rep_range_min:
            it.progression_rule === 'double' ? parseOptionalInt(it.rep_range_min) : null,
          rep_range_max:
            it.progression_rule === 'double' ? parseOptionalInt(it.rep_range_max) : null,
          rpe_cap: it.progression_rule === 'rpe_gated' ? parseOptionalFloat(it.rpe_cap) : null,
          amrap_last_set: it.amrap_last_set,
        };
      });

      if (isEditMode && templateId) {
        await updateTemplate(db, templateId, {
          name: templateName.trim(),
          notes: templateNotes.trim() || null,
          items: draftItems,
        });
      } else {
        await createTemplate(db, {
          name: templateName.trim(),
          notes: templateNotes.trim() || null,
          items: draftItems,
        });
      }
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'Could not save the template. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Archive ───────────────────────────────────────────────────────────────
  const handleArchive = () => {
    Alert.alert(
      'Remove template?',
      'This hides the template from your list. Completed workouts stay in your history.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            if (!templateId) return;
            const db = await getDb();
            await archiveTemplate(db, templateId);
            navigation.goBack();
          },
        },
      ],
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={12}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {/* Template name */}
        <Text style={styles.label}>Template Name *</Text>
        <TextInput
          style={[styles.input, nameError ? styles.inputError : null]}
          value={templateName}
          onChangeText={(t) => {
            setTemplateName(t);
            if (nameError) setNameError(null);
          }}
          placeholder="e.g. Push A"
          placeholderTextColor="#555"
          testID="template-name-input"
          autoCorrect={false}
          maxLength={100}
        />
        {nameError && (
          <Text style={styles.errorText} testID="name-error">
            {nameError}
          </Text>
        )}

        {/* Notes */}
        <Text style={styles.label}>Notes (optional)</Text>
        <TextInput
          style={[styles.input, styles.notesInput]}
          value={templateNotes}
          onChangeText={setTemplateNotes}
          placeholder="Warm-up notes, focus cues…"
          placeholderTextColor="#555"
          testID="template-notes-input"
          multiline
          maxLength={500}
        />

        {/* Exercise list */}
        <Text style={styles.label}>Exercises</Text>
        {items.length === 0 ? (
          <View style={styles.emptyExercises} testID="empty-exercises">
            <Text style={styles.emptyExercisesText}>No exercises added yet.</Text>
          </View>
        ) : (
          <View style={styles.itemList}>
            {items.map((item, index) => (
              <View key={item.key} style={styles.itemCard} testID={`item-card-${item.key}`}>
                {/* Item header */}
                <View style={styles.itemHeader}>
                  <View style={styles.itemTitleGroup}>
                    <Text style={styles.itemName}>{item.exercise_name}</Text>
                    <Text style={styles.itemCategory}>{item.exercise_category}</Text>
                  </View>
                  <View style={styles.itemActions}>
                    <TouchableOpacity
                      onPress={() => moveUp(index)}
                      disabled={index === 0}
                      testID={`move-up-${item.key}`}
                      hitSlop={6}
                    >
                      <Text style={[styles.reorderBtn, index === 0 && styles.reorderBtnDisabled]}>
                        ▲
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => moveDown(index)}
                      disabled={index === items.length - 1}
                      testID={`move-down-${item.key}`}
                      hitSlop={6}
                    >
                      <Text
                        style={[
                          styles.reorderBtn,
                          index === items.length - 1 && styles.reorderBtnDisabled,
                        ]}
                      >
                        ▼
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => removeItem(index)}
                      testID={`remove-item-${item.key}`}
                      hitSlop={6}
                    >
                      <Text style={styles.removeBtn}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Target fields */}
                <View style={styles.targetRow}>
                  <View style={styles.targetField}>
                    <Text style={styles.targetLabel}>Sets</Text>
                    <TextInput
                      style={styles.targetInput}
                      value={item.target_sets}
                      onChangeText={(v) => updateItemField(index, 'target_sets', v)}
                      keyboardType="number-pad"
                      placeholder="—"
                      placeholderTextColor="#444"
                      maxLength={3}
                      testID={`target-sets-${item.key}`}
                    />
                  </View>
                  <View style={styles.targetField}>
                    <Text style={styles.targetLabel}>Reps</Text>
                    <TextInput
                      style={styles.targetInput}
                      value={item.target_reps}
                      onChangeText={(v) => updateItemField(index, 'target_reps', v)}
                      keyboardType="number-pad"
                      placeholder="—"
                      placeholderTextColor="#444"
                      maxLength={3}
                      testID={`target-reps-${item.key}`}
                    />
                  </View>
                  <View style={styles.targetField}>
                    <Text style={styles.targetLabel}>Weight</Text>
                    <TextInput
                      style={styles.targetInput}
                      value={item.target_weight}
                      onChangeText={(v) => updateItemField(index, 'target_weight', v)}
                      keyboardType="decimal-pad"
                      placeholder="—"
                      placeholderTextColor="#444"
                      maxLength={7}
                      testID={`target-weight-${item.key}`}
                    />
                  </View>
                  <View style={styles.targetField}>
                    <Text style={styles.targetLabel}>RPE</Text>
                    <TextInput
                      style={styles.targetInput}
                      value={item.target_rpe}
                      onChangeText={(v) => updateItemField(index, 'target_rpe', v)}
                      keyboardType="decimal-pad"
                      placeholder="—"
                      placeholderTextColor="#444"
                      maxLength={4}
                      testID={`target-rpe-${item.key}`}
                    />
                  </View>
                </View>

                {/* Rest timer */}
                <View style={styles.restRow}>
                  <Text style={styles.restLabel}>Rest</Text>
                  <View style={styles.restOptions}>
                    <TouchableOpacity
                      style={[styles.restChip, item.rest_seconds === '' && styles.restChipActive]}
                      onPress={() => updateItemField(index, 'rest_seconds', '')}
                      testID={`rest-preset-none-${item.key}`}
                    >
                      <Text
                        style={[
                          styles.restChipText,
                          item.rest_seconds === '' && styles.restChipTextActive,
                        ]}
                      >
                        Off
                      </Text>
                    </TouchableOpacity>
                    {REST_PRESETS_SECONDS.map((seconds) => {
                      const value = String(seconds);
                      const active = item.rest_seconds === value;
                      return (
                        <TouchableOpacity
                          key={seconds}
                          style={[styles.restChip, active && styles.restChipActive]}
                          onPress={() => updateItemField(index, 'rest_seconds', value)}
                          testID={`rest-preset-${seconds}-${item.key}`}
                        >
                          <Text
                            style={[styles.restChipText, active && styles.restChipTextActive]}
                          >
                            {seconds}s
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                    <TextInput
                      style={styles.restInput}
                      value={
                        REST_PRESETS_SECONDS.some((seconds) => String(seconds) === item.rest_seconds)
                          ? ''
                          : item.rest_seconds
                      }
                      onChangeText={(v) => updateItemField(index, 'rest_seconds', v)}
                      keyboardType="number-pad"
                      placeholder="Custom"
                      placeholderTextColor="#444"
                      maxLength={4}
                      testID={`rest-custom-${item.key}`}
                    />
                  </View>
                </View>

                {/* AMRAP toggle */}
                <View style={styles.amrapRow}>
                  <Text style={styles.amrapLabel}>Last set AMRAP</Text>
                  <TouchableOpacity
                    style={[styles.amrapChip, item.amrap_last_set && styles.amrapChipActive]}
                    onPress={() => toggleAmrapLastSet(index)}
                    testID={`amrap-last-set-${item.key}`}
                  >
                    <Text
                      style={[
                        styles.amrapChipText,
                        item.amrap_last_set && styles.amrapChipTextActive,
                      ]}
                    >
                      {item.amrap_last_set ? 'On' : 'Off'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Progression */}
                <View style={styles.progressionBlock}>
                  <Text style={styles.progressionLabel}>Progression</Text>
                  <View style={styles.progressionOptions}>
                    {PROGRESSION_OPTIONS.map((option) => {
                      const active = item.progression_rule === option.value;
                      return (
                        <TouchableOpacity
                          key={option.value}
                          style={[styles.progressionChip, active && styles.progressionChipActive]}
                          onPress={() => updateItemRule(index, option.value)}
                          testID={`progression-rule-${option.value}-${item.key}`}
                        >
                          <Text
                            style={[
                              styles.progressionChipText,
                              active && styles.progressionChipTextActive,
                            ]}
                          >
                            {option.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {item.progression_rule !== 'none' && (
                    <View style={styles.progressionFields}>
                      {item.progression_rule === 'double' && (
                        <>
                          <View style={styles.progressionField}>
                            <Text style={styles.targetLabel}>Min reps</Text>
                            <TextInput
                              style={styles.targetInput}
                              value={item.rep_range_min}
                              onChangeText={(v) => updateItemField(index, 'rep_range_min', v)}
                              keyboardType="number-pad"
                              placeholder="—"
                              placeholderTextColor="#444"
                              maxLength={3}
                              testID={`progression-rep-min-${item.key}`}
                            />
                          </View>
                          <View style={styles.progressionField}>
                            <Text style={styles.targetLabel}>Max reps</Text>
                            <TextInput
                              style={styles.targetInput}
                              value={item.rep_range_max}
                              onChangeText={(v) => updateItemField(index, 'rep_range_max', v)}
                              keyboardType="number-pad"
                              placeholder="—"
                              placeholderTextColor="#444"
                              maxLength={3}
                              testID={`progression-rep-max-${item.key}`}
                            />
                          </View>
                        </>
                      )}
                      {item.progression_rule === 'rpe_gated' && (
                        <View style={styles.progressionField}>
                          <Text style={styles.targetLabel}>RPE cap</Text>
                          <TextInput
                            style={styles.targetInput}
                            value={item.rpe_cap}
                            onChangeText={(v) => updateItemField(index, 'rpe_cap', v)}
                            keyboardType="decimal-pad"
                            placeholder="8.5"
                            placeholderTextColor="#444"
                            maxLength={4}
                            testID={`progression-rpe-cap-${item.key}`}
                          />
                        </View>
                      )}
                      <View style={styles.progressionField}>
                        <Text style={styles.targetLabel}>Increment</Text>
                        <TextInput
                          style={styles.targetInput}
                          value={item.increment}
                          onChangeText={(v) => updateItemField(index, 'increment', v)}
                          keyboardType="decimal-pad"
                          placeholder="Auto"
                          placeholderTextColor="#444"
                          maxLength={6}
                          testID={`progression-increment-${item.key}`}
                        />
                      </View>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Add exercise button */}
        <TouchableOpacity
          style={styles.addExerciseBtn}
          onPress={() => setPickerVisible(true)}
          testID="add-exercise-btn"
        >
          <Text style={styles.addExerciseBtnText}>+ Add Exercise</Text>
        </TouchableOpacity>

        {/* Save */}
        <TouchableOpacity
          style={[styles.saveBtn, (!canSave || saving) && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!canSave || saving}
          testID="save-btn"
        >
          <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save Template'}</Text>
        </TouchableOpacity>

        {/* Archive (edit mode only) */}
        {isEditMode && (
          <TouchableOpacity style={styles.archiveBtn} onPress={handleArchive} testID="archive-btn">
            <Text style={styles.archiveBtnText}>Archive Template</Text>
          </TouchableOpacity>
        )}

        {/* Exercise picker modal */}
        <ExercisePicker
          visible={pickerVisible}
          onSelect={handleExerciseSelected}
          onClose={() => setPickerVisible(false)}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 16, paddingBottom: 120 },

  label: { color: '#888', fontSize: 13, fontWeight: '500', marginTop: 20, marginBottom: 6 },

  input: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#f5f5f5',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  inputError: { borderColor: '#e74c3c' },
  notesInput: { minHeight: 72, textAlignVertical: 'top' },

  errorText: { color: '#e74c3c', fontSize: 13, marginTop: 4 },

  emptyExercises: {
    paddingVertical: 20,
    alignItems: 'center',
    backgroundColor: '#111',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1a1a1a',
  },
  emptyExercisesText: { color: '#555', fontSize: 14 },

  itemList: { gap: 8 },
  itemCard: {
    backgroundColor: '#111',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e1e1e',
    overflow: 'hidden',
  },

  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  itemTitleGroup: { flex: 1 },
  itemName: { color: '#f5f5f5', fontSize: 15, fontWeight: '500' },
  itemCategory: { color: '#666', fontSize: 12, marginTop: 1, textTransform: 'capitalize' },
  itemActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  reorderBtn: { color: '#555', fontSize: 13, fontWeight: '700' },
  reorderBtnDisabled: { color: '#2a2a2a' },
  removeBtn: { color: '#e74c3c', fontSize: 13, fontWeight: '600' },

  targetRow: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 12,
  },
  targetField: { flex: 1, alignItems: 'center' },
  targetLabel: { color: '#555', fontSize: 11, fontWeight: '500', marginBottom: 4 },
  targetInput: {
    width: '100%',
    backgroundColor: '#1a1a1a',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 6,
    color: '#f5f5f5',
    fontSize: 14,
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  restRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  restLabel: {
    width: 36,
    color: '#777',
    fontSize: 12,
    fontWeight: '600',
  },
  restOptions: { flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  restChip: {
    minHeight: 30,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  restChipActive: { backgroundColor: '#7c5cfc', borderColor: '#7c5cfc' },
  restChipText: { color: '#888', fontSize: 12, fontWeight: '600' },
  restChipTextActive: { color: '#fff' },
  restInput: {
    minWidth: 72,
    minHeight: 30,
    backgroundColor: '#1a1a1a',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    color: '#f5f5f5',
    fontSize: 12,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  amrapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  amrapLabel: { flex: 1, color: '#777', fontSize: 12, fontWeight: '600' },
  amrapChip: {
    minHeight: 30,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amrapChipActive: { backgroundColor: '#7c5cfc', borderColor: '#7c5cfc' },
  amrapChipText: { color: '#888', fontSize: 12, fontWeight: '600' },
  amrapChipTextActive: { color: '#fff' },
  progressionBlock: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    gap: 8,
  },
  progressionLabel: {
    color: '#777',
    fontSize: 12,
    fontWeight: '600',
  },
  progressionOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  progressionChip: {
    minHeight: 30,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressionChipActive: { backgroundColor: '#7c5cfc', borderColor: '#7c5cfc' },
  progressionChipText: { color: '#888', fontSize: 12, fontWeight: '600' },
  progressionChipTextActive: { color: '#fff' },
  progressionFields: {
    flexDirection: 'row',
    gap: 10,
  },
  progressionField: { flex: 1, alignItems: 'center' },

  addExerciseBtn: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#7c5cfc',
    alignItems: 'center',
  },
  addExerciseBtnText: { color: '#7c5cfc', fontWeight: '600', fontSize: 15 },

  saveBtn: {
    marginTop: 24,
    paddingVertical: 14,
    backgroundColor: '#7c5cfc',
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  archiveBtn: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e74c3c',
    alignItems: 'center',
  },
  archiveBtnText: { color: '#e74c3c', fontWeight: '600', fontSize: 15 },
});
