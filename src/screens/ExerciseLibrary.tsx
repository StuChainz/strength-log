import { useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { openDb } from '@/db/client';
import { getAllExercises } from '@/db/repositories/exercises.repo';
import { normalizeName } from '@/domain/ids';
import ExerciseHistorySheet from '@/screens/ExerciseHistorySheet';
import { T } from '@/theme/tokens';
import type { Exercise, ExerciseCategory } from '@/domain/types';
import type { ExerciseLibraryNavigationProp } from '@/navigation/types';

type FilterOption = ExerciseCategory | 'all' | 'custom';

const FILTER_CHIPS: { label: string; value: FilterOption }[] = [
  { label: 'All', value: 'all' },
  { label: 'Barbell', value: 'barbell' },
  { label: 'Dumbbell', value: 'dumbbell' },
  { label: 'Machine', value: 'machine' },
  { label: 'Bodyweight', value: 'bodyweight' },
  { label: 'Cable', value: 'cable' },
  { label: 'Custom', value: 'custom' },
];

const CATEGORY_LABEL: Record<ExerciseCategory, string> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbell',
  machine: 'Machine',
  bodyweight: 'Bodyweight',
  cable: 'Cable',
  other: 'Other',
};

export default function ExerciseLibrary() {
  const navigation = useNavigation<ExerciseLibraryNavigationProp>();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterOption>('all');
  const [loading, setLoading] = useState(true);
  const [historyExercise, setHistoryExercise] = useState<Exercise | null>(null);
  const dbRef = useRef<Awaited<ReturnType<typeof openDb>> | null>(null);

  const loadExercises = useCallback(async () => {
    try {
      const db = dbRef.current ?? (await openDb());
      dbRef.current = db;
      const all = await getAllExercises(db);
      setExercises(all);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void loadExercises(); }, [loadExercises]));

  const filtered = useMemo(() => {
    let result = exercises;
    if (activeFilter === 'custom') {
      result = result.filter((e) => e.is_custom === 1);
    } else if (activeFilter !== 'all') {
      result = result.filter((e) => e.category === activeFilter);
    }
    if (searchQuery.trim()) {
      const needle = normalizeName(searchQuery);
      result = result.filter((e) => e.normalized_name.includes(needle));
    }
    return result;
  }, [exercises, searchQuery, activeFilter]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.eyebrow}>Catalogue</Text>
          <Text style={styles.title}>Exercises</Text>
        </View>

        {/* Search */}
        <View style={styles.searchWrap}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={T.muted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name or alias…"
              placeholderTextColor={T.muted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              testID="search-input"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
                <Ionicons name="close" size={16} color={T.muted} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersRow}
          style={styles.filtersScroll}
        >
          {FILTER_CHIPS.map((f) => (
            <TouchableOpacity
              key={f.value}
              style={[styles.chip, activeFilter === f.value && styles.chipActive]}
              onPress={() => setActiveFilter(f.value)}
              testID={`filter-${f.value}`}
            >
              <Text style={[styles.chipText, activeFilter === f.value && styles.chipTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Count + New */}
        <View style={styles.countRow}>
          <Text style={styles.countLabel}>
            {loading ? '—' : `${filtered.length} result${filtered.length !== 1 ? 's' : ''}`}
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('ExerciseEdit', {})}
            testID="add-exercise-btn"
            hitSlop={8}
          >
            <Text style={styles.newBtn}>+ NEW</Text>
          </TouchableOpacity>
        </View>

        {/* Exercise list */}
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          style={styles.list}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            loading ? null : (
              <View style={styles.emptyList}>
                <Text style={styles.emptyText}>
                  {searchQuery || activeFilter !== 'all'
                    ? 'No matches. Tap + to create.'
                    : 'No exercises yet.'}
                </Text>
              </View>
            )
          }
          renderItem={({ item, index }) => (
            <TouchableOpacity
              style={[styles.exerciseRow, index === 0 && styles.exerciseRowFirst]}
              onPress={() => navigation.navigate('ExerciseEdit', { exerciseId: item.id })}
              testID={`exercise-row-${item.id}`}
            >
              <View style={styles.exerciseInfo}>
                <Text style={styles.exerciseName}>{item.name}</Text>
                <Text style={styles.exerciseMeta}>
                  {CATEGORY_LABEL[item.category]}
                  {item.primary_muscle ? ` · ${item.primary_muscle.toUpperCase()}` : ''}
                  {item.is_custom ? ' · CUSTOM' : ''}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.historyBtn}
                onPress={(event) => {
                  event.stopPropagation();
                  setHistoryExercise(item);
                }}
                hitSlop={8}
              >
                <Ionicons name="time-outline" size={16} color={T.textDim} />
              </TouchableOpacity>
              <Ionicons name="chevron-forward" size={16} color={T.mutedDeep} />
            </TouchableOpacity>
          )}
        />
      </View>
      <ExerciseHistorySheet
        visible={historyExercise !== null}
        exerciseId={historyExercise?.id ?? null}
        exerciseName={historyExercise?.name ?? ''}
        category={historyExercise?.category ?? 'barbell'}
        targetReps={null}
        onClose={() => setHistoryExercise(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  container: { flex: 1, backgroundColor: T.bg },

  header: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 4 },
  eyebrow: {
    fontFamily: 'Courier New',
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: T.muted,
    fontWeight: '500',
  },
  title: { fontSize: 28, fontWeight: '600', letterSpacing: -0.5, color: T.text, marginTop: 4 },

  searchWrap: { paddingHorizontal: 22, paddingTop: 14 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: T.surface,
    borderWidth: 1,
    borderColor: T.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  searchInput: {
    flex: 1,
    backgroundColor: 'transparent',
    color: T.text,
    fontSize: 14,
  },

  filtersScroll: { marginTop: 12 },
  filtersRow: {
    paddingHorizontal: 22,
    gap: 8,
    paddingBottom: 4,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: T.surface2,
    borderWidth: 1,
    borderColor: T.border,
  },
  chipActive: { backgroundColor: T.accent, borderColor: T.accent },
  chipText: { fontSize: 13, fontWeight: '500', color: T.text },
  chipTextActive: { color: T.accentInk },

  countRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 22,
    paddingTop: 14,
    paddingBottom: 8,
  },
  countLabel: {
    fontFamily: 'Courier New',
    fontSize: 10.5,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: T.muted,
    fontWeight: '500',
  },
  newBtn: {
    fontFamily: 'Courier New',
    fontSize: 12,
    color: T.accent,
    letterSpacing: 0.3,
  },

  list: { flex: 1 },
  listContent: { paddingHorizontal: 22, paddingBottom: 16 },

  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 13,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: T.border,
    backgroundColor: T.surface,
  },
  exerciseRowFirst: { borderTopWidth: 0, borderTopLeftRadius: 14, borderTopRightRadius: 14 },
  exerciseInfo: { flex: 1, minWidth: 0 },
  exerciseName: { fontSize: 14, fontWeight: '500', color: T.text },
  exerciseMeta: {
    fontFamily: 'Courier New',
    fontSize: 11,
    color: T.muted,
    marginTop: 3,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  historyBtn: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: T.surface2,
    borderWidth: 1,
    borderColor: T.border,
    marginRight: 8,
  },

  emptyList: {
    padding: 28,
    alignItems: 'center',
    backgroundColor: T.surface,
    borderRadius: 14,
  },
  emptyText: {
    fontFamily: 'Courier New',
    fontSize: 13,
    color: T.muted,
  },
});
