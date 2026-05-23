import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ExerciseLibrary from '@/screens/ExerciseLibrary';
import { getExercisesWithMetadata } from '@/db/repositories/exercises.repo';

// ── Navigation mock ───────────────────────────────────────────────────────────
const mockNavigate = jest.fn();
const mockSetOptions = jest.fn();
const mockUseFocusEffect = jest.fn((cb: () => (() => void) | void) => {
  cb();
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
const mockExercises = [
  {
    id: 'ex-1',
    name: 'Barbell Squat',
    normalized_name: 'barbell squat',
    category: 'barbell',
    primary_muscle: 'quadriceps',
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
      primary_muscles: ['quadriceps'],
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
    category: 'bodyweight',
    primary_muscle: 'core',
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
      primary_muscles: ['core'],
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

jest.mock('@/db/client', () => ({ openDb: jest.fn() }));
jest.mock('@/db/repositories/exercises.repo', () => ({
  getExercisesWithMetadata: jest.fn().mockResolvedValue(mockExercises),
}));

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('ExerciseLibrary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseFocusEffect.mockImplementation((cb) => {
      cb();
    });
    getExercisesWithMetadata.mockResolvedValue(mockExercises);
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

    await waitFor(() => {
      expect(getByTestId('exercise-row-ex-1')).toBeTruthy();
      expect(queryByTestId('exercise-row-ex-2')).toBeNull();
    });
  });

  it('filters by category chip', async () => {
    const { getByTestId, queryByTestId } = render(<ExerciseLibrary />);
    await waitFor(() => expect(getByTestId('exercise-row-ex-1')).toBeTruthy());

    fireEvent.press(getByTestId('filter-dumbbell'));

    await waitFor(() => {
      expect(queryByTestId('exercise-row-ex-1')).toBeNull();
      expect(getByTestId('exercise-row-ex-2')).toBeTruthy();
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

    await waitFor(() => {
      expect(getByTestId(`exercise-row-${expectedId}`)).toBeTruthy();
      mockExercises
        .filter((exercise) => exercise.id !== expectedId)
        .forEach((exercise) => {
          expect(queryByTestId(`exercise-row-${exercise.id}`)).toBeNull();
        });
    });
  });

  it('filters Custom chip to only custom exercises', async () => {
    const { getByTestId, queryByTestId } = render(<ExerciseLibrary />);
    await waitFor(() => expect(getByTestId('exercise-row-ex-1')).toBeTruthy());

    fireEvent.press(getByTestId('filter-custom'));

    await waitFor(() => {
      expect(queryByTestId('exercise-row-ex-1')).toBeNull();
      expect(queryByTestId('exercise-row-ex-2')).toBeNull();
      expect(getByTestId('exercise-row-ex-3')).toBeTruthy();
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

    const callsBefore = getExercisesWithMetadata.mock.calls.length;

    // Simulate focus by re-invoking the useFocusEffect callback
    const cb = mockUseFocusEffect.mock.calls[0][0];
    cb();

    await waitFor(() =>
      expect(getExercisesWithMetadata.mock.calls.length).toBeGreaterThan(callsBefore),
    );
  });
});
