import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { openDb } from '@/db/client';
import {
  BASE_EXERCISE_FILTER_CHIPS,
  buildExerciseListFilters,
  type ExerciseFilterOption,
} from '@/domain/exerciseFilters';
import { formatExerciseMetadataSummary } from '@/domain/exerciseMetadata';
import {
  createExerciseIfMissing,
  getExercisesWithMetadata,
} from '@/db/repositories/exercises.repo';
import type { Exercise, ExerciseCategory, ExerciseWithMetadata } from '@/domain/types';

interface ExercisePickerProps {
  visible: boolean;
  onSelect: (exercise: Exercise) => void;
  onClose: () => void;
}

const CUSTOM_CATEGORIES: { label: string; value: ExerciseCategory }[] = [
  { label: 'Barbell', value: 'barbell' },
  { label: 'Dumbbell', value: 'dumbbell' },
  { label: 'Machine', value: 'machine' },
  { label: 'Bodyweight', value: 'bodyweight' },
  { label: 'Cable', value: 'cable' },
  { label: 'Other', value: 'other' },
];

export function ExercisePicker({ visible, onSelect, onClose }: ExercisePickerProps) {
  const [exercises, setExercises] = useState<ExerciseWithMetadata[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<ExerciseFilterOption>('all');
  const [loading, setLoading] = useState(false);
  const [customVisible, setCustomVisible] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customPrimaryMuscle, setCustomPrimaryMuscle] = useState('');
  const [customCategory, setCustomCategory] = useState<ExerciseCategory>('other');
  const [customError, setCustomError] = useState<string | null>(null);
  const [savingCustom, setSavingCustom] = useState(false);
  const dbRef = useRef<Awaited<ReturnType<typeof openDb>> | null>(null);
  const loadRequestIdRef = useRef(0);
  const activeFilterRef = useRef<ExerciseFilterOption>('all');
  const searchQueryRef = useRef('');

  const loadExercises = useCallback(async (filter: ExerciseFilterOption, query: string) => {
    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;
    setLoading(true);
    try {
      const db = dbRef.current ?? (await openDb());
      dbRef.current = db;
      const result = await getExercisesWithMetadata(db, buildExerciseListFilters(filter, query));
      if (requestId === loadRequestIdRef.current) {
        setExercises(result);
      }
    } finally {
      if (requestId === loadRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    // Intentional: reset UI state when the modal opens.
    setSearchQuery('');
    setActiveFilter('all');
    setCustomVisible(false);
    setCustomName('');
    setCustomPrimaryMuscle('');
    setCustomCategory('other');
    setCustomError(null);
    activeFilterRef.current = 'all';
    searchQueryRef.current = '';
    void loadExercises('all', '');
  }, [visible, loadExercises]);

  const handleSearchChange = (value: string) => {
    searchQueryRef.current = value;
    setSearchQuery(value);
    if (visible) {
      void loadExercises(activeFilterRef.current, value);
    }
  };

  const handleFilterPress = (value: ExerciseFilterOption) => {
    activeFilterRef.current = value;
    setActiveFilter(value);
    if (visible) {
      void loadExercises(value, searchQueryRef.current);
    }
  };

  const handleSelect = (exercise: Exercise) => {
    onSelect(exercise);
    onClose();
  };

  const openCustomForm = () => {
    setCustomName(searchQuery.trim());
    setCustomPrimaryMuscle('');
    setCustomCategory('other');
    setCustomError(null);
    setCustomVisible(true);
  };

  const saveCustomExercise = async () => {
    const trimmedName = customName.trim();
    if (!trimmedName) {
      setCustomError('Exercise name is required.');
      return;
    }

    setSavingCustom(true);
    try {
      const db = dbRef.current ?? (await openDb());
      dbRef.current = db;
      const result = await createExerciseIfMissing(db, {
        name: trimmedName,
        category: customCategory,
        primary_muscle: customPrimaryMuscle.trim() || null,
        default_unit: null,
      });

      if (!result.created) {
        setCustomError(`"${result.exercise.name}" already exists.`);
        return;
      }

      setCustomVisible(false);
      setCustomError(null);
      searchQueryRef.current = trimmedName;
      activeFilterRef.current = 'all';
      setSearchQuery(trimmedName);
      setActiveFilter('all');
      await loadExercises('all', trimmedName);
    } finally {
      setSavingCustom(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      testID="exercise-picker-modal"
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        testID="picker-keyboard-avoiding"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Select Exercise</Text>
          <TouchableOpacity onPress={onClose} testID="picker-close-btn" hitSlop={8}>
            <Text style={styles.closeBtn}>Cancel</Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search exercises…"
            placeholderTextColor="#555"
            value={searchQuery}
            onChangeText={handleSearchChange}
            testID="picker-search-input"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </View>

        <View style={styles.customActionWrap}>
          <TouchableOpacity
            style={styles.customAction}
            onPress={openCustomForm}
            testID="picker-custom-exercise-btn"
          >
            <Text style={styles.customActionText}>+ Custom Exercise</Text>
          </TouchableOpacity>
        </View>

        {/* Filter chips */}
        <FlatList
          data={BASE_EXERCISE_FILTER_CHIPS}
          keyExtractor={(c) => c.value}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipsList}
          contentContainerStyle={styles.chipsRow}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.chip, activeFilter === item.value && styles.chipActive]}
              onPress={() => handleFilterPress(item.value)}
              testID={`picker-filter-${item.value}`}
            >
              <Text style={[styles.chipText, activeFilter === item.value && styles.chipTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />

        {/* Exercise list */}
        {loading ? (
          <View style={styles.center}>
            <Text style={styles.muted}>Loading…</Text>
          </View>
        ) : (
          <FlatList
            data={exercises}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={styles.muted}>
                  {searchQuery || activeFilter !== 'all'
                    ? 'No matching exercises.'
                    : 'No exercises.'}
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.row}
                onPress={() => handleSelect(item)}
                testID={`picker-exercise-${item.id}`}
              >
                <View style={styles.rowMain}>
                  <Text style={styles.rowName}>{item.name}</Text>
                  <Text style={styles.rowMeta}>{formatExerciseMetadataSummary(item)}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />
        )}
      </KeyboardAvoidingView>
      <Modal
        visible={customVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCustomVisible(false)}
        testID="custom-exercise-modal"
      >
        <View style={styles.customBackdrop}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.customKeyboard}
          >
            <View style={styles.customSheet}>
              <View style={styles.customHeader}>
                <Text style={styles.customTitle}>Custom Exercise</Text>
                <TouchableOpacity
                  style={styles.customCloseBtn}
                  onPress={() => setCustomVisible(false)}
                  hitSlop={8}
                  testID="custom-exercise-close-btn"
                >
                  <Text style={styles.customCloseText}>Cancel</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.customContent}>
                <Text style={styles.customLabel}>Name *</Text>
                <TextInput
                  style={[styles.customInput, customError ? styles.customInputError : null]}
                  value={customName}
                  onChangeText={(value) => {
                    setCustomName(value);
                    if (customError) setCustomError(null);
                  }}
                  placeholder="e.g. Cable Y Raise"
                  placeholderTextColor="#555"
                  autoCorrect={false}
                  maxLength={100}
                  testID="custom-exercise-name-input"
                />
                {customError ? (
                  <Text style={styles.customError} testID="custom-exercise-error">
                    {customError}
                  </Text>
                ) : null}

                <Text style={styles.customLabel}>Category</Text>
                <View style={styles.customChipRow}>
                  {CUSTOM_CATEGORIES.map((category) => (
                    <TouchableOpacity
                      key={category.value}
                      style={[
                        styles.customChip,
                        customCategory === category.value && styles.customChipActive,
                      ]}
                      onPress={() => setCustomCategory(category.value)}
                      testID={`custom-category-${category.value}`}
                    >
                      <Text
                        style={[
                          styles.customChipText,
                          customCategory === category.value && styles.customChipTextActive,
                        ]}
                      >
                        {category.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.customLabel}>Primary Muscle</Text>
                <TextInput
                  style={styles.customInput}
                  value={customPrimaryMuscle}
                  onChangeText={setCustomPrimaryMuscle}
                  placeholder="Optional"
                  placeholderTextColor="#555"
                  autoCorrect={false}
                  maxLength={60}
                  testID="custom-exercise-muscle-input"
                />
              </View>

              <View style={styles.customFooter}>
                <TouchableOpacity
                  style={[styles.customSaveBtn, savingCustom && styles.customSaveBtnDisabled]}
                  onPress={() => void saveCustomExercise()}
                  disabled={savingCustom}
                  testID="save-custom-exercise-btn"
                >
                  <Text style={styles.customSaveText}>
                    {savingCustom ? 'Saving...' : 'Save Custom Exercise'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
    backgroundColor: '#111111',
  },
  headerTitle: { color: '#f5f5f5', fontSize: 17, fontWeight: '600' },
  closeBtn: { color: '#7c5cfc', fontSize: 15, fontWeight: '500' },

  searchRow: { padding: 12 },
  searchInput: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#f5f5f5',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  customActionWrap: { paddingHorizontal: 12, paddingBottom: 8 },
  customAction: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: '#ffc700',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customActionText: { color: '#0a0a0a', fontSize: 15, fontWeight: '800' },

  chipsList: { flexGrow: 0, flexShrink: 0, maxHeight: 46 },
  chipsRow: { paddingHorizontal: 12, paddingBottom: 8, gap: 8, alignItems: 'center' },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: '#7c5cfc', borderColor: '#7c5cfc' },
  chipText: { color: '#888', fontSize: 13, fontWeight: '500' },
  chipTextActive: { color: '#fff' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#0a0a0a',
  },
  rowMain: { flex: 1 },
  rowName: { color: '#f5f5f5', fontSize: 16, fontWeight: '500', marginBottom: 2 },
  rowMeta: { color: '#666', fontSize: 13 },
  chevron: { color: '#444', fontSize: 20, marginLeft: 8 },
  separator: { height: 1, backgroundColor: '#1a1a1a', marginLeft: 16 },

  muted: { color: '#555', fontSize: 14 },
  customBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.66)',
    justifyContent: 'flex-end',
  },
  customKeyboard: { justifyContent: 'flex-end' },
  customSheet: {
    backgroundColor: '#0a0a0a',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: '#2a2a2a',
    overflow: 'hidden',
  },
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  customTitle: { color: '#f5f5f5', fontSize: 18, fontWeight: '800' },
  customCloseBtn: { minHeight: 34, justifyContent: 'center' },
  customCloseText: { color: '#888', fontSize: 14, fontWeight: '700' },
  customContent: { padding: 16, gap: 9 },
  customLabel: {
    color: '#888',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginTop: 8,
  },
  customInput: {
    minHeight: 44,
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#f5f5f5',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  customInputError: { borderColor: '#ff7a6a' },
  customError: { color: '#ff7a6a', fontSize: 12, fontWeight: '700' },
  customChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  customChip: {
    minHeight: 36,
    borderRadius: 999,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customChipActive: { backgroundColor: '#ffc700', borderColor: '#ffc700' },
  customChipText: { color: '#888', fontSize: 13, fontWeight: '700' },
  customChipTextActive: { color: '#0a0a0a' },
  customFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
  },
  customSaveBtn: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: '#ffc700',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customSaveBtnDisabled: { opacity: 0.6 },
  customSaveText: { color: '#0a0a0a', fontSize: 15, fontWeight: '800' },
});
