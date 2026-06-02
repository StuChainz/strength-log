import React from 'react';
import { act, render, fireEvent, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import ExerciseLibrary from '@/screens/ExerciseLibrary';
import {
  getExerciseLibraryDiagnostics,
  getExercisesWithMetadata,
  type ExerciseMetadataFilters,
} from '@/db/repositories/exercises.repo';
import { normalizeName } from '@/domain/ids';
import type { ExerciseWithMetadata } from '@/domain/types';

// ── Navigation mock ───────────────────────────────────────────────────────────
const mockNavigate = jest.fn();
const mockSetOptions = jest.fn();
const mockUseFocusEffect = jest.fn((cb: () => (() => void) | void) => {
  React.useEffect(() => cb(), [cb]);
});

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate,
    setOptions: mockSetOptions,
  }),
  useFocusEffect: (cb: Parameters<typeof mockUseFocusEffect>[0]) => mockUseFocusEffect(cb),
}));

// ── DB mock ───────────────────────────────────────────────────────────────────
const mockExercises: ExerciseWithMetadata[] = [
  {
    id: 'ex-1',
    name: 'Barbell Squat',
    normalized_name: 'barbell squat',
    aliases: ['squat', 'back squat'],
    category: 'barbell',
    primary_muscle: 'quads',
    is_custom: 0,
    default_unit: null,
    archived_at: null,
    created_at: 1,
    updated_at: 1,
    metadata: {
      exercise_id: 'ex-1',
      movement_pattern: 'squat',
      force_type: 'legs',
      body_region: 'lower_body',
      primary_muscles: ['quads'],
      secondary_muscles: ['glutes'],
      equipment: ['barbell'],
      mechanics: 'compound',
      laterality: 'bilateral',
      difficulty: 3,
      substitution_group: 'squat',
      source: 'curated_seed',
      source_id: 'curated_seed:barbell_squat',
      updated_at: 1,
    },
  },
  {
    id: 'ex-2',
    name: 'Dumbbell Curl',
    normalized_name: 'dumbbell curl',
    aliases: ['curl', 'db curl'],
    category: 'dumbbell',
    primary_muscle: 'biceps',
    is_custom: 0,
    default_unit: null,
    archived_at: null,
    created_at: 1,
    updated_at: 1,
    metadata: {
      exercise_id: 'ex-2',
      movement_pattern: 'elbow_flexion',
      force_type: 'pull',
      body_region: 'upper_body',
      primary_muscles: ['biceps'],
      secondary_muscles: ['forearms'],
      equipment: ['dumbbell'],
      mechanics: 'isolation',
      laterality: 'bilateral',
      difficulty: 1,
      substitution_group: 'elbow_flexion',
      source: 'curated_seed',
      source_id: 'curated_seed:dumbbell_curl',
      updated_at: 1,
    },
  },
  {
    id: 'ex-3',
    name: 'My Custom Press',
    normalized_name: 'my custom press',
    aliases: [],
    category: 'barbell',
    primary_muscle: null,
    is_custom: 1,
    default_unit: null,
    archived_at: null,
    created_at: 1,
    updated_at: 1,
    metadata: null,
  },
  {
    id: 'ex-4',
    name: 'Barbell Deadlift',
    normalized_name: 'barbell deadlift',
    aliases: ['deadlift', 'dl'],
    category: 'barbell',
    primary_muscle: 'hamstrings',
    is_custom: 0,
    default_unit: null,
    archived_at: null,
    created_at: 1,
    updated_at: 1,
    metadata: {
      exercise_id: 'ex-4',
      movement_pattern: 'hinge',
      force_type: 'hinge',
      body_region: 'lower_body',
      primary_muscles: ['hamstrings'],
      secondary_muscles: ['glutes'],
      equipment: ['barbell'],
      mechanics: 'compound',
      laterality: 'bilateral',
      difficulty: 4,
      substitution_group: 'deadlift',
      source: 'curated_seed',
      source_id: 'curated_seed:barbell_deadlift',
      updated_at: 1,
    },
  },
  {
    id: 'ex-5',
    name: 'Plank',
    normalized_name: 'plank',
    aliases: ['plank'],
    category: 'bodyweight',
    primary_muscle: 'abs',
    is_custom: 0,
    default_unit: null,
    archived_at: null,
    created_at: 1,
    updated_at: 1,
    metadata: {
      exercise_id: 'ex-5',
      movement_pattern: 'core',
      force_type: 'core',
      body_region: 'core',
      primary_muscles: ['abs'],
      secondary_muscles: [],
      equipment: ['bodyweight'],
      mechanics: 'isolation',
      laterality: 'bilateral',
      difficulty: 1,
      substitution_group: 'core',
      source: 'curated_seed',
      source_id: 'curated_seed:plank',
      updated_at: 1,
    },
  },
  {
    id: 'ex-6',
    name: 'Bench Press',
    normalized_name: 'bench press',
    aliases: ['bench', 'flat bench'],
    category: 'barbell',
    primary_muscle: 'chest',
    is_custom: 0,
    default_unit: null,
    archived_at: null,
    created_at: 1,
    updated_at: 1,
    metadata: {
      exercise_id: 'ex-6',
      movement_pattern: 'horizontal_push',
      force_type: 'push',
      body_region: 'upper_body',
      primary_muscles: ['chest'],
      secondary_muscles: ['triceps'],
      equipment: ['barbell'],
      mechanics: 'compound',
      laterality: 'bilateral',
      difficulty: 3,
      substitution_group: 'horizontal_press',
      source: 'curated_seed',
      source_id: 'curated_seed:bench_press',
      updated_at: 1,
    },
  },
];

function filterMockExercises(filters: ExerciseMetadataFilters = {}): ExerciseWithMetadata[] {
  return mockExercises.filter((exercise) => {
    if (filters.category && exercise.category !== filters.category) return false;
    if (filters.custom !== undefined && exercise.is_custom !== (filters.custom ? 1 : 0)) {
      return false;
    }
    if (filters.force_type && exercise.metadata?.force_type !== filters.force_type) return false;
    if (filters.query?.trim()) {
      const needle = normalizeName(filters.query);
      return (
        exercise.normalized_name.includes(needle) ||
        exercise.aliases.some((alias) => alias.includes(needle))
      );
    }
    return true;
  });
}

jest.mock('@/db/client', () => ({ openDb: jest.fn().mockResolvedValue({}) }));
jest.mock('@/db/repositories/exercises.repo', () => ({
  getExerciseLibraryDiagnostics: jest.fn(),
  getExercisesWithMetadata: jest.fn(),
}));

const getExerciseLibraryDiagnosticsMock = getExerciseLibraryDiagnostics as jest.MockedFunction<
  typeof getExerciseLibraryDiagnostics
>;
const getExercisesWithMetadataMock = getExercisesWithMetadata as jest.MockedFunction<
  typeof getExercisesWithMetadata
>;

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('ExerciseLibrary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseFocusEffect.mockImplementation((cb) => {
      React.useEffect(() => cb(), [cb]);
    });
    getExercisesWithMetadataMock.mockImplementation((_db, filters) =>
      Promise.resolve(filterMockExercises(filters)),
    );
    getExerciseLibraryDiagnosticsMock.mockResolvedValue({
      total: mockExercises.length,
      seed: mockExercises.filter((exercise) => exercise.is_custom === 0).length,
      custom: mockExercises.filter((exercise) => exercise.is_custom === 1).length,
      metadata: mockExercises.filter((exercise) => exercise.metadata).length,
    });
  });

  it('renders all exercises after load', async () => {
    const { getByTestId, getByText } = render(<ExerciseLibrary />);
    await waitFor(() => {
      expect(getByTestId('exercise-row-ex-1')).toBeTruthy();
      expect(getByTestId('exercise-row-ex-2')).toBeTruthy();
      expect(getByTestId('exercise-row-ex-3')).toBeTruthy();
    });
    expect(getByText('Barbell Squat')).toBeTruthy();
    expect(getByText('Dumbbell Curl')).toBeTruthy();
    expect(getByText('My Custom Press')).toBeTruthy();
  });

  it('shows metadata when present and falls back when missing', async () => {
    const { getByTestId, getByText } = render(<ExerciseLibrary />);
    await waitFor(() => expect(getByTestId('exercise-row-ex-6')).toBeTruthy());

    expect(getByText('Barbell · Chest · Push')).toBeTruthy();
    expect(getByText('Barbell · Custom')).toBeTruthy();
  });

  it('filters by search query', async () => {
    const { getByTestId, queryByTestId } = render(<ExerciseLibrary />);
    await waitFor(() => expect(getByTestId('exercise-row-ex-1')).toBeTruthy());

    fireEvent.changeText(getByTestId('search-input'), 'squat');

    await waitFor(
      () => {
        expect(getByTestId('exercise-row-ex-1')).toBeTruthy();
        expect(queryByTestId('exercise-row-ex-2')).toBeNull();
      },
      { timeout: 3000 },
    );
    expect(getExercisesWithMetadata).toHaveBeenLastCalledWith(expect.any(Object), {
      query: 'squat',
    });
  });

  it('filters by alias search query', async () => {
    const { getByTestId, queryByTestId } = render(<ExerciseLibrary />);
    await waitFor(() => expect(getByTestId('exercise-row-ex-1')).toBeTruthy());

    fireEvent.changeText(getByTestId('search-input'), 'flat bench');

    await waitFor(
      () => {
        expect(getByTestId('exercise-row-ex-6')).toBeTruthy();
        expect(queryByTestId('exercise-row-ex-1')).toBeNull();
      },
      { timeout: 3000 },
    );
    expect(getExercisesWithMetadata).toHaveBeenLastCalledWith(expect.any(Object), {
      query: 'flat bench',
    });
  });

  it('filters by category chip', async () => {
    const { getByTestId, queryByTestId } = render(<ExerciseLibrary />);
    await waitFor(() => expect(getByTestId('exercise-row-ex-1')).toBeTruthy());

    fireEvent.press(getByTestId('filter-dumbbell'));

    await waitFor(
      () => {
        expect(queryByTestId('exercise-row-ex-1')).toBeNull();
        expect(getByTestId('exercise-row-ex-2')).toBeTruthy();
      },
      { timeout: 3000 },
    );
    expect(getExercisesWithMetadata).toHaveBeenLastCalledWith(expect.any(Object), {
      category: 'dumbbell',
    });
  });

  it('keeps filter chips compact and pressable', async () => {
    const { getByTestId, queryByTestId } = render(<ExerciseLibrary />);
    await waitFor(() => expect(getByTestId('exercise-row-ex-1')).toBeTruthy());

    const filtersScrollStyle = StyleSheet.flatten(
      getByTestId('exercise-library-filter-scroll').props.style,
    );
    const allChipStyle = StyleSheet.flatten(getByTestId('filter-all').props.style);

    expect(filtersScrollStyle.flexGrow).toBe(0);
    expect(filtersScrollStyle.flexShrink).toBe(0);
    expect(filtersScrollStyle.maxHeight).toBeLessThanOrEqual(44);
    expect(allChipStyle.minHeight).toBeGreaterThanOrEqual(34);

    fireEvent.press(getByTestId('filter-push'));

    await waitFor(() => {
      expect(getByTestId('exercise-row-ex-6')).toBeTruthy();
      expect(queryByTestId('exercise-row-ex-1')).toBeNull();
    });
    expect(getExercisesWithMetadata).toHaveBeenLastCalledWith(expect.any(Object), {
      force_type: 'push',
    });
  });

  it.each([
    ['push', 'ex-6'],
    ['pull', 'ex-2'],
    ['legs', 'ex-1'],
    ['hinge', 'ex-4'],
    ['core', 'ex-5'],
  ])('filters by %s metadata chip', async (filter, expectedId) => {
    const { getByTestId, queryByTestId } = render(<ExerciseLibrary />);
    await waitFor(() => expect(getByTestId('exercise-row-ex-1')).toBeTruthy());

    fireEvent.press(getByTestId(`filter-${filter}`));

    await waitFor(
      () => {
        expect(getByTestId(`exercise-row-${expectedId}`)).toBeTruthy();
        mockExercises
          .filter((exercise) => exercise.id !== expectedId)
          .forEach((exercise) => {
            expect(queryByTestId(`exercise-row-${exercise.id}`)).toBeNull();
          });
      },
      { timeout: 3000 },
    );
    expect(getExercisesWithMetadata).toHaveBeenLastCalledWith(expect.any(Object), {
      force_type: filter,
    });
  });

  it('filters Custom chip to only custom exercises', async () => {
    const { getByTestId, queryByTestId } = render(<ExerciseLibrary />);
    await waitFor(() => expect(getByTestId('exercise-row-ex-1')).toBeTruthy());

    fireEvent.press(getByTestId('filter-custom'));

    await waitFor(
      () => {
        expect(queryByTestId('exercise-row-ex-1')).toBeNull();
        expect(queryByTestId('exercise-row-ex-2')).toBeNull();
        expect(getByTestId('exercise-row-ex-3')).toBeTruthy();
      },
      { timeout: 3000 },
    );
    expect(getExercisesWithMetadata).toHaveBeenLastCalledWith(expect.any(Object), {
      custom: true,
    });
  });

  it('navigates to ExerciseEdit when a row is pressed', async () => {
    const { getByTestId } = render(<ExerciseLibrary />);
    await waitFor(() => expect(getByTestId('exercise-row-ex-1')).toBeTruthy());

    fireEvent.press(getByTestId('exercise-row-ex-1'));

    expect(mockNavigate).toHaveBeenCalledWith('ExerciseEdit', { exerciseId: 'ex-1' });
  });

  it('navigates to ExerciseEdit (new) when Add button is pressed', async () => {
    const { getByTestId } = render(<ExerciseLibrary />);
    await waitFor(() => expect(getByTestId('exercise-row-ex-1')).toBeTruthy());

    fireEvent.press(getByTestId('add-exercise-btn'));

    expect(mockNavigate).toHaveBeenCalledWith('ExerciseEdit', {});
  });

  it('shows empty state when no matches found', async () => {
    const { getByTestId, getByText } = render(<ExerciseLibrary />);
    await waitFor(() => expect(getByTestId('exercise-row-ex-1')).toBeTruthy());

    fireEvent.changeText(getByTestId('search-input'), 'xyznotfound');

    await waitFor(() => {
      expect(getByText('No matches. Tap + to create.')).toBeTruthy();
    });
  });

  it('reloads exercises on focus', async () => {
    render(<ExerciseLibrary />);
    await waitFor(() => expect(getExercisesWithMetadata).toHaveBeenCalled());

    const callsBefore = getExercisesWithMetadataMock.mock.calls.length;

    // Simulate focus by re-invoking the useFocusEffect callback
    const cb = mockUseFocusEffect.mock.calls[0][0];
    await act(async () => {
      cb();
    });

    await waitFor(() =>
      expect(getExercisesWithMetadataMock.mock.calls.length).toBeGreaterThan(callsBefore),
    );
  });

  it('shows dev diagnostics after load', async () => {
    const { getByTestId } = render(<ExerciseLibrary />);

    await waitFor(() => {
      expect(getByTestId('exercise-library-diagnostics')).toBeTruthy();
    });
  });

  it('shows a dev-visible error instead of silently empty data when DB loading fails', async () => {
    const error = new Error('native sqlite failed');
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    getExercisesWithMetadataMock.mockRejectedValueOnce(error);

    const { getByTestId, getByText } = render(<ExerciseLibrary />);

    await waitFor(() => {
      expect(getByTestId('exercise-library-db-error')).toBeTruthy();
      expect(getByText('DB load error: native sqlite failed')).toBeTruthy();
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[ExerciseLibrary] Failed to load exercises',
      error,
    );

    consoleErrorSpy.mockRestore();
  });
});
