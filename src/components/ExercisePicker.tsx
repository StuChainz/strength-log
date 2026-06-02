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
import { getExercisesWithMetadata } from '@/db/repositories/exercises.repo';
import {
  BASE_EXERCISE_FILTER_CHIPS,
  buildExerciseListFilters,
  type ExerciseFilterOption,
} from '@/domain/exerciseFilters';
import { formatExerciseMetadataSummary } from '@/domain/exerciseMetadata';
import type { Exercise, ExerciseWithMetadata } from '@/domain/types';

interface ExercisePickerProps {
  visible: boolean;
  onSelect: (exercise: Exercise) => void;
  onClose: () => void;
}

export function ExercisePicker({ visible, onSelect, onClose }: ExercisePickerProps) {
  const [exercises, setExercises] = useState<ExerciseWithMetadata[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<ExerciseFilterOption>('all');
  const [loading, setLoading] = useState(false);
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
});
