import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { openDb } from '@/db/client';
import { getExercisesWithMetadata } from '@/db/repositories/exercises.repo';
import { formatExerciseMetadataSummary } from '@/domain/exerciseMetadata';
import { normalizeName } from '@/domain/ids';
import type { Exercise, ExerciseCategory, ExerciseWithMetadata, ForceType } from '@/domain/types';

type ForceFilterOption = Extract<ForceType, 'push' | 'pull' | 'legs' | 'hinge' | 'core'>;
type FilterOption = ExerciseCategory | ForceFilterOption | 'all';

interface FilterChip {
  label: string;
  value: FilterOption;
}

const FILTER_CHIPS: FilterChip[] = [
  { label: 'All', value: 'all' },
  { label: 'Push', value: 'push' },
  { label: 'Pull', value: 'pull' },
  { label: 'Legs', value: 'legs' },
  { label: 'Hinge', value: 'hinge' },
  { label: 'Core', value: 'core' },
  { label: 'Barbell', value: 'barbell' },
  { label: 'Dumbbell', value: 'dumbbell' },
  { label: 'Bodyweight', value: 'bodyweight' },
  { label: 'Machine', value: 'machine' },
  { label: 'Cable', value: 'cable' },
];

const FORCE_FILTERS = new Set<FilterOption>(['push', 'pull', 'legs', 'hinge', 'core']);

interface ExercisePickerProps {
  visible: boolean;
  onSelect: (exercise: Exercise) => void;
  onClose: () => void;
}

export function ExercisePicker({ visible, onSelect, onClose }: ExercisePickerProps) {
  const [exercises, setExercises] = useState<ExerciseWithMetadata[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterOption>('all');
  const [loading, setLoading] = useState(false);
  const dbRef = useRef<Awaited<ReturnType<typeof openDb>> | null>(null);

  const loadExercises = useCallback(async () => {
    setLoading(true);
    try {
      const db = dbRef.current ?? (await openDb());
      dbRef.current = db;
      const all = await getExercisesWithMetadata(db);
      setExercises(all);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!visible) return;
    // Intentional: reset UI state when the modal opens.
    /* eslint-disable react-hooks/set-state-in-effect */
    setSearchQuery('');
    setActiveFilter('all');
    /* eslint-enable react-hooks/set-state-in-effect */
    void loadExercises();
  }, [visible, loadExercises]);

  const filtered = useMemo(() => {
    let result = exercises;

    if (FORCE_FILTERS.has(activeFilter)) {
      result = result.filter((e) => e.metadata?.force_type === activeFilter);
    } else if (activeFilter !== 'all') {
      result = result.filter((e) => e.category === activeFilter);
    }

    if (searchQuery.trim()) {
      const needle = normalizeName(searchQuery);
      result = result.filter(
        (e) =>
          e.normalized_name.includes(needle) || e.aliases.some((alias) => alias.includes(needle)),
      );
    }

    return result;
  }, [exercises, searchQuery, activeFilter]);

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
      <View style={styles.container}>
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
            onChangeText={setSearchQuery}
            testID="picker-search-input"
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </View>

        {/* Filter chips */}
        <FlatList
          data={FILTER_CHIPS}
          keyExtractor={(c) => c.value}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsRow}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.chip, activeFilter === item.value && styles.chipActive]}
              onPress={() => setActiveFilter(item.value)}
              testID={`picker-filter-${item.value}`}
            >
              <Text
                style={[styles.chipText, activeFilter === item.value && styles.chipTextActive]}
              >
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
            data={filtered}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
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
      </View>
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

  chipsRow: { paddingHorizontal: 12, paddingBottom: 8, gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
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
