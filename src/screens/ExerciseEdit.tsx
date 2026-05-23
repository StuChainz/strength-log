import { useEffect, useState } from 'react';
import {
  Alert,
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
  getAllExercises,
  getExerciseById,
  createExercise,
  updateExercise,
  archiveExercise,
} from '@/db/repositories/exercises.repo';
import { normalizeName } from '@/domain/ids';
import { CreateExerciseSchema } from '@/domain/validation';
import type { ExerciseCategory, Unit } from '@/domain/types';
import type { ExerciseEditNavigationProp, ExerciseEditRouteProp } from '@/navigation/types';

type UnitOption = Unit | null;

const CATEGORIES: { label: string; value: ExerciseCategory }[] = [
  { label: 'Barbell', value: 'barbell' },
  { label: 'Dumbbell', value: 'dumbbell' },
  { label: 'Bodyweight', value: 'bodyweight' },
  { label: 'Machine', value: 'machine' },
  { label: 'Cable', value: 'cable' },
  { label: 'Other', value: 'other' },
];

const UNIT_OPTIONS: { label: string; value: UnitOption }[] = [
  { label: 'Default', value: null },
  { label: 'kg', value: 'kg' },
  { label: 'lb', value: 'lb' },
];

export default function ExerciseEdit() {
  const navigation = useNavigation<ExerciseEditNavigationProp>();
  const route = useRoute<ExerciseEditRouteProp>();
  const exerciseId = route.params?.exerciseId;
  const isEditMode = !!exerciseId;

  // ── Form state ────────────────────────────────────────────────────────────
  const [name, setName] = useState('');
  const [category, setCategory] = useState<ExerciseCategory>('barbell');
  const [primaryMuscle, setPrimaryMuscle] = useState('');
  const [unit, setUnit] = useState<UnitOption>(null);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [nameError, setNameError] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // ── Load existing exercise in edit mode ───────────────────────────────────
  useEffect(() => {
    if (!exerciseId) return;
    openDb()
      .then((db) => getExerciseById(db, exerciseId))
      .then((exercise) => {
        if (!exercise) return;
        setName(exercise.name);
        setCategory(exercise.category);
        setPrimaryMuscle(exercise.primary_muscle ?? '');
        setUnit(exercise.default_unit ?? null);
      })
      .catch(() => {});
  }, [exerciseId]);

  // ── Duplicate name check (runs on blur) ───────────────────────────────────
  const checkDuplicate = async (currentName: string) => {
    if (!currentName.trim()) {
      setDuplicateWarning(null);
      return;
    }
    try {
      const db = await openDb();
      const all = await getAllExercises(db);
      const needle = normalizeName(currentName);
      const duplicate = all.find(
        (e) => e.normalized_name === needle && e.id !== exerciseId,
      );
      setDuplicateWarning(
        duplicate ? `"${duplicate.name}" already exists` : null,
      );
    } catch {
      setDuplicateWarning(null);
    }
  };

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    // Client-side validation
    const parsed = CreateExerciseSchema.safeParse({
      name: name.trim(),
      category,
      primary_muscle: primaryMuscle.trim() || null,
      default_unit: unit,
    });

    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      setNameError(firstError?.message ?? 'Invalid input');
      return;
    }
    setNameError(null);
    setSaving(true);

    try {
      const db = await openDb();
      if (isEditMode && exerciseId) {
        await updateExercise(db, exerciseId, parsed.data);
      } else {
        await createExercise(db, parsed.data);
      }
      navigation.goBack();
    } catch {
      Alert.alert('Error', 'Could not save the exercise. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Archive ───────────────────────────────────────────────────────────────
  const handleArchive = () => {
    Alert.alert(
      'Archive Exercise',
      'This exercise will be hidden from the library. Existing sets using it are unaffected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            if (!exerciseId) return;
            const db = await openDb();
            await archiveExercise(db, exerciseId);
            navigation.goBack();
          },
        },
      ],
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Name */}
      <Text style={styles.label}>Name *</Text>
      <TextInput
        style={[styles.input, nameError ? styles.inputError : null]}
        value={name}
        onChangeText={(t) => {
          setName(t);
          if (nameError) setNameError(null);
        }}
        onBlur={() => checkDuplicate(name)}
        placeholder="e.g. Incline Dumbbell Press"
        placeholderTextColor="#555"
        testID="name-input"
        autoCorrect={false}
        maxLength={100}
      />
      {nameError && (
        <Text style={styles.errorText} testID="name-error">
          {nameError}
        </Text>
      )}
      {duplicateWarning && !nameError && (
        <Text style={styles.warningText} testID="duplicate-warning">
          ⚠ {duplicateWarning}
        </Text>
      )}

      {/* Category */}
      <Text style={styles.label}>Category *</Text>
      <View style={styles.chipRow}>
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.value}
            style={[styles.chip, category === cat.value && styles.chipActive]}
            onPress={() => setCategory(cat.value)}
            testID={`category-${cat.value}`}
          >
            <Text style={[styles.chipText, category === cat.value && styles.chipTextActive]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Primary Muscle */}
      <Text style={styles.label}>Primary Muscle (optional)</Text>
      <TextInput
        style={styles.input}
        value={primaryMuscle}
        onChangeText={setPrimaryMuscle}
        placeholder="e.g. chest, quadriceps"
        placeholderTextColor="#555"
        testID="muscle-input"
        autoCorrect={false}
        maxLength={60}
      />

      {/* Unit */}
      <Text style={styles.label}>Default Unit</Text>
      <View style={styles.chipRow}>
        {UNIT_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={String(opt.value)}
            style={[styles.chip, unit === opt.value && styles.chipActive]}
            onPress={() => setUnit(opt.value)}
            testID={`unit-${opt.value ?? 'default'}`}
          >
            <Text style={[styles.chipText, unit === opt.value && styles.chipTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Save */}
      <TouchableOpacity
        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={saving}
        testID="save-btn"
      >
        <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
      </TouchableOpacity>

      {/* Archive (edit mode only) */}
      {isEditMode && (
        <TouchableOpacity style={styles.archiveBtn} onPress={handleArchive} testID="archive-btn">
          <Text style={styles.archiveBtnText}>Archive Exercise</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 16, paddingBottom: 48 },

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

  errorText: { color: '#e74c3c', fontSize: 13, marginTop: 4 },
  warningText: { color: '#e6a817', fontSize: 13, marginTop: 4 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  chipActive: { backgroundColor: '#7c5cfc', borderColor: '#7c5cfc' },
  chipText: { color: '#888', fontSize: 14, fontWeight: '500' },
  chipTextActive: { color: '#fff' },

  saveBtn: {
    marginTop: 32,
    paddingVertical: 14,
    backgroundColor: '#7c5cfc',
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.5 },
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
