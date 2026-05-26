import { useCallback, useRef, useState } from 'react';
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
import {
  getExerciseLibraryDiagnostics,
  getExercisesWithMetadata,
  type ExerciseLibraryDiagnostics,
} from '@/db/repositories/exercises.repo';
import {
  buildExerciseListFilters,
  LIBRARY_EXERCISE_FILTER_CHIPS,
  type ExerciseFilterOption,
} from '@/domain/exerciseFilters';
import { formatExerciseMetadataSummary } from '@/domain/exerciseMetadata';
import ExerciseHistorySheet from '@/screens/ExerciseHistorySheet';
import { T } from '@/theme/tokens';
import type { ExerciseWithMetadata } from '@/domain/types';
import type { ExerciseLibraryNavigationProp } from '@/navigation/types';

export default function ExerciseLibrary() {
  const navigation = useNavigation<ExerciseLibraryNavigationProp>();
  const [exercises, setExercises] = useState<ExerciseWithMetadata[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<ExerciseFilterOption>('all');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<ExerciseLibraryDiagnostics | null>(null);
  const [historyExercise, setHistoryExercise] = useState<ExerciseWithMetadata | null>(null);
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
      const nextDiagnostics = __DEV__ ? await getExerciseLibraryDiagnostics(db) : null;
      if (requestId === loadRequestIdRef.current) {
        setExercises(result);
        setDiagnostics(nextDiagnostics);
        setLoadError(null);
      }
    } catch (error) {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.error('[ExerciseLibrary] Failed to load exercises', error);
      }
      if (requestId === loadRequestIdRef.current) {
        setExercises([]);
        setDiagnostics(null);
        setLoadError(__DEV__ ? formatDevError(error) : null);
      }
    } finally {
      if (requestId === loadRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadExercises(activeFilterRef.current, searchQueryRef.current);
    }, [loadExercises]),
  );

  const handleSearchChange = (value: string) => {
    searchQueryRef.current = value;
    setSearchQuery(value);
    void loadExercises(activeFilterRef.current, value);
  };

  const handleFilterPress = (value: ExerciseFilterOption) => {
    activeFilterRef.current = value;
    setActiveFilter(value);
    void loadExercises(value, searchQueryRef.current);
  };

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
              onChangeText={handleSearchChange}
              testID="search-input"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => handleSearchChange('')} hitSlop={8}>
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
          testID="exercise-library-filter-scroll"
        >
          {LIBRARY_EXERCISE_FILTER_CHIPS.map((f) => (
            <TouchableOpacity
              key={f.value}
              style={[styles.chip, activeFilter === f.value && styles.chipActive]}
              onPress={() => handleFilterPress(f.value)}
              testID={`filter-${f.value}`}
            >
              <Text style={[styles.chipText, activeFilter === f.value && styles.chipTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {__DEV__ && loadError ? (
          <View style={styles.devError} testID="exercise-library-db-error">
            <Text style={styles.devErrorText}>DB load error: {loadError}</Text>
          </View>
        ) : null}

        {__DEV__ && diagnostics ? (
          <View style={styles.devDiagnostics} testID="exercise-library-diagnostics">
            <Text style={styles.devDiagnosticsText}>
              DB total: {diagnostics.total} · seed: {diagnostics.seed} · custom:{' '}
              {diagnostics.custom} · metadata: {diagnostics.metadata ?? 'n/a'}
            </Text>
          </View>
        ) : null}

        {/* Count + New */}
        <View style={styles.countRow}>
          <Text style={styles.countLabel}>
            {loading ? '—' : `${exercises.length} result${exercises.length !== 1 ? 's' : ''}`}
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
          data={exercises}
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
                <Text style={styles.exerciseMeta}>{formatExerciseMetadataSummary(item)}</Text>
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
        defaultUnit={historyExercise?.default_unit ?? 'kg'}
        targetSets={null}
        targetReps={null}
        targetWeight={null}
        progressionRule={{ rule: 'none' }}
        progressionExercise={{
          category: historyExercise?.category ?? 'barbell',
          movementPattern: historyExercise?.metadata?.movement_pattern ?? null,
          bodyRegion: historyExercise?.metadata?.body_region ?? null,
          mechanics: historyExercise?.metadata?.mechanics ?? null,
          equipment: historyExercise?.metadata?.equipment ?? [],
        }}
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

  filtersScroll: {
    marginTop: 12,
    flexGrow: 0,
    flexShrink: 0,
    maxHeight: 44,
  },
  filtersRow: {
    paddingHorizontal: 22,
    gap: 8,
    paddingBottom: 4,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: T.surface2,
    borderWidth: 1,
    borderColor: T.border,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
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
  devError: {
    marginHorizontal: 22,
    marginTop: 10,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#7f1d1d',
    backgroundColor: '#2a0d0d',
  },
  devErrorText: {
    fontFamily: 'Courier New',
    fontSize: 11,
    color: '#fecaca',
  },
  devDiagnostics: {
    marginHorizontal: 22,
    marginTop: 10,
  },
  devDiagnosticsText: {
    fontFamily: 'Courier New',
    fontSize: 10.5,
    color: T.muted,
  },
});

function formatDevError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
