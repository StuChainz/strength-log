import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { openDb } from '@/db/client';
import { getAllExercises } from '@/db/repositories/exercises.repo';
import { normalizeName } from '@/domain/ids';
import type { Exercise, ExerciseCategory } from '@/domain/types';
import type { ExerciseLibraryNavigationProp } from '@/navigation/types';

type FilterOption = ExerciseCategory | 'all' | 'custom';

interface FilterChip {
  label: string;
  value: FilterOption;
}

const FILTER_CHIPS: FilterChip[] = [
  { label: 'All', value: 'all' },
  { label: 'Barbell', value: 'barbell' },
  { label: 'Dumbbell', value: 'dumbbell' },
  { label: 'Bodyweight', value: 'bodyweight' },
  { label: 'Machine', value: 'machine' },
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

  // Reload list whenever screen comes into focus (after create/edit).
  useFocusEffect(
    useCallback(() => {
      void loadExercises();
    }, [loadExercises]),
  );

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('ExerciseEdit', {})}
          testID="add-exercise-btn"
          hitSlop={8}
        >
          <Text style={styles.headerBtn}>+ Add</Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

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

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.muted}>Loading…</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <>
            {/* Search bar */}
            <View style={styles.searchRow}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search exercises…"
                placeholderTextColor="#555"
                value={searchQuery}
                onChangeText={setSearchQuery}
                testID="search-input"
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
                  testID={`filter-${item.value}`}
                >
                  <Text
                    style={[styles.chipText, activeFilter === item.value && styles.chipTextActive]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </>
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.muted}>
              {searchQuery || activeFilter !== 'all' ? 'No matching exercises.' : 'No exercises.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate('ExerciseEdit', { exerciseId: item.id })}
            testID={`exercise-row-${item.id}`}
          >
            <View style={styles.rowMain}>
              <Text style={styles.rowName}>{item.name}</Text>
              <Text style={styles.rowMeta}>
                {CATEGORY_LABEL[item.category]}
                {item.primary_muscle ? ` · ${item.primary_muscle}` : ''}
                {item.is_custom ? ' · Custom' : ''}
              </Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },

  headerBtn: { color: '#7c5cfc', fontSize: 15, fontWeight: '600' },

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
