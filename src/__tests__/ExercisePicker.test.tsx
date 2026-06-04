import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ExercisePicker } from '@/components/ExercisePicker';
import {
  createExerciseIfMissing,
  getExercisesWithMetadata,
  type ExerciseMetadataFilters,
} from '@/db/repositories/exercises.repo';
import { SEED_EXERCISES, SEED_EXERCISE_METADATA } from '@/db/seed/exercises';
import { normalizeName } from '@/domain/ids';
import type { ExerciseWithMetadata } from '@/domain/types';

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
      tertiary_muscles: [],
      equipment: ['barbell'],
      mechanics: 'compound',
      laterality: 'bilateral',
      difficulty: 3,
      substitution_group: 'squat_barbell',
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
      tertiary_muscles: [],
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
    name: 'Push Up',
    normalized_name: 'push up',
    aliases: ['pushup'],
    category: 'bodyweight',
    primary_muscle: 'chest',
    is_custom: 0,
    default_unit: null,
    archived_at: null,
    created_at: 1,
    updated_at: 1,
    metadata: {
      exercise_id: 'ex-3',
      movement_pattern: 'horizontal_push',
      force_type: 'push',
      body_region: 'upper_body',
      primary_muscles: ['chest'],
      secondary_muscles: ['triceps'],
      tertiary_muscles: [],
      equipment: ['bodyweight'],
      mechanics: 'compound',
      laterality: 'bilateral',
      difficulty: 1,
      substitution_group: 'horizontal_press',
      source: 'curated_seed',
      source_id: 'curated_seed:push_up',
      updated_at: 1,
    },
  },
  {
    id: 'ex-4',
    name: 'Custom Carry',
    normalized_name: 'custom carry',
    aliases: [],
    category: 'other',
    primary_muscle: null,
    is_custom: 1,
    default_unit: null,
    archived_at: null,
    created_at: 1,
    updated_at: 1,
    metadata: null,
  },
];
let exerciseRows: ExerciseWithMetadata[] = [];

function filterExercises(
  exercises: ExerciseWithMetadata[],
  filters: ExerciseMetadataFilters = {},
): ExerciseWithMetadata[] {
  return exercises.filter((exercise) => {
    if (filters.category && exercise.category !== filters.category) return false;
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

function buildExpandedSeedRows(): ExerciseWithMetadata[] {
  const metadataByName = new Map(
    SEED_EXERCISE_METADATA.map((metadata) => [metadata.exerciseName, metadata]),
  );

  return SEED_EXERCISES.map((exercise, index) => {
    const metadata = metadataByName.get(exercise.name);
    if (!metadata) {
      throw new Error(`Missing test metadata for ${exercise.name}`);
    }

    return {
      ...exercise,
      id: `seed-${index}`,
      normalized_name: normalizeName(exercise.name),
      aliases: exercise.aliases.map(normalizeName),
      is_custom: 0,
      archived_at: null,
      created_at: 1,
      updated_at: 1,
      metadata: {
        exercise_id: `seed-${index}`,
        movement_pattern: metadata.movement_pattern,
        force_type: metadata.force_type,
        body_region: metadata.body_region,
        primary_muscles: metadata.primary_muscles,
        secondary_muscles: metadata.secondary_muscles,
        tertiary_muscles: metadata.tertiary_muscles,
        equipment: metadata.equipment,
        mechanics: metadata.mechanics,
        laterality: metadata.laterality,
        difficulty: metadata.difficulty,
        substitution_group: metadata.substitution_group,
        source: 'curated_seed',
        source_id: metadata.source_id,
        updated_at: 1,
      },
    };
  });
}

jest.mock('@/db/client', () => ({ openDb: jest.fn().mockResolvedValue({}) }));
jest.mock('@/db/repositories/exercises.repo', () => ({
  createExerciseIfMissing: jest.fn(),
  getExercisesWithMetadata: jest.fn(),
}));

const createExerciseIfMissingMock = createExerciseIfMissing as jest.MockedFunction<
  typeof createExerciseIfMissing
>;
const getExercisesWithMetadataMock = getExercisesWithMetadata as jest.MockedFunction<
  typeof getExercisesWithMetadata
>;

// ── Helpers ───────────────────────────────────────────────────────────────────
const defaultProps = {
  visible: true,
  onSelect: jest.fn(),
  onClose: jest.fn(),
};

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('ExercisePicker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    exerciseRows = mockExercises.map((exercise) => ({ ...exercise }));
    getExercisesWithMetadataMock.mockImplementation((_db, filters) =>
      Promise.resolve(filterExercises(exerciseRows, filters)),
    );
    createExerciseIfMissingMock.mockImplementation(async (_db, input) => {
      const existing = exerciseRows.find(
        (exercise) => exercise.normalized_name === normalizeName(input.name),
      );
      if (existing) return { exercise: existing, created: false };

      const created: ExerciseWithMetadata = {
        id: 'custom-created',
        name: input.name.trim(),
        normalized_name: normalizeName(input.name),
        aliases: [],
        category: input.category,
        primary_muscle: input.primary_muscle ?? null,
        is_custom: 1,
        default_unit: input.default_unit ?? null,
        archived_at: null,
        created_at: 2,
        updated_at: 2,
        metadata: null,
      };
      exerciseRows = [...exerciseRows, created];
      return { exercise: created, created: true };
    });
  });

  it('renders all exercises when visible', async () => {
    const { getByTestId } = render(<ExercisePicker {...defaultProps} />);
    await waitFor(() => {
      expect(getByTestId('picker-exercise-ex-1')).toBeTruthy();
      expect(getByTestId('picker-exercise-ex-2')).toBeTruthy();
      expect(getByTestId('picker-exercise-ex-3')).toBeTruthy();
    });
  });

  it('does not load exercises when not visible', () => {
    render(<ExercisePicker {...defaultProps} visible={false} />);
    expect(getExercisesWithMetadata).not.toHaveBeenCalled();
  });

  it('calls onClose when Cancel is pressed', async () => {
    const onClose = jest.fn();
    const { getByTestId } = render(<ExercisePicker {...defaultProps} onClose={onClose} />);
    await waitFor(() => expect(getByTestId('picker-close-btn')).toBeTruthy());

    fireEvent.press(getByTestId('picker-close-btn'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onSelect and onClose when an exercise row is pressed', async () => {
    const onSelect = jest.fn();
    const onClose = jest.fn();
    const { getByTestId } = render(
      <ExercisePicker {...defaultProps} onSelect={onSelect} onClose={onClose} />,
    );
    await waitFor(() => expect(getByTestId('picker-exercise-ex-1')).toBeTruthy());

    fireEvent.press(getByTestId('picker-exercise-ex-1'));

    expect(onSelect).toHaveBeenCalledWith(mockExercises[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it('keeps the add-exercise search input inside a keyboard-aware modal layout', async () => {
    const { getByTestId } = render(<ExercisePicker {...defaultProps} />);
    await waitFor(() => expect(getByTestId('picker-search-input')).toBeTruthy());

    const keyboardWrapper = getByTestId('picker-keyboard-avoiding');
    expect(keyboardWrapper).toBeTruthy();

    fireEvent(getByTestId('picker-search-input'), 'focus');
    fireEvent.changeText(getByTestId('picker-search-input'), 'squat');

    await waitFor(() =>
      expect(getExercisesWithMetadata).toHaveBeenLastCalledWith(expect.any(Object), {
        query: 'squat',
      }),
    );
  });

  it('filters exercises by search query', async () => {
    const { getByTestId, queryByTestId } = render(<ExercisePicker {...defaultProps} />);
    await waitFor(() => expect(getByTestId('picker-exercise-ex-1')).toBeTruthy());

    fireEvent.changeText(getByTestId('picker-search-input'), 'curl');

    await waitFor(() => {
      expect(queryByTestId('picker-exercise-ex-1')).toBeNull();
      expect(getByTestId('picker-exercise-ex-2')).toBeTruthy();
    });
    expect(getExercisesWithMetadata).toHaveBeenLastCalledWith(expect.any(Object), {
      query: 'curl',
    });
  });

  it('filters exercises by alias search query', async () => {
    const { getByTestId, queryByTestId } = render(<ExercisePicker {...defaultProps} />);
    await waitFor(() => expect(getByTestId('picker-exercise-ex-1')).toBeTruthy());

    fireEvent.changeText(getByTestId('picker-search-input'), 'pushup');

    await waitFor(() => {
      expect(queryByTestId('picker-exercise-ex-1')).toBeNull();
      expect(getByTestId('picker-exercise-ex-3')).toBeTruthy();
    });
    expect(getExercisesWithMetadata).toHaveBeenLastCalledWith(expect.any(Object), {
      query: 'pushup',
    });
  });

  it('renders and searches the expanded seed library', async () => {
    const expandedSeedRows = buildExpandedSeedRows();
    getExercisesWithMetadataMock.mockImplementation((_db, filters) =>
      Promise.resolve(filterExercises(expandedSeedRows, filters)),
    );

    const { getByTestId, getByText, queryByText } = render(<ExercisePicker {...defaultProps} />);
    await waitFor(() => expect(getByText('Barbell Back Squat')).toBeTruthy());

    fireEvent.changeText(getByTestId('picker-search-input'), 'lateral raise');

    await waitFor(() => {
      expect(getByText('Dumbbell Lateral Raise')).toBeTruthy();
      expect(queryByText('Barbell Back Squat')).toBeNull();
    });
    expect(getExercisesWithMetadata).toHaveBeenLastCalledWith(expect.any(Object), {
      query: 'lateral raise',
    });
  });

  it('filters exercises by force type chip', async () => {
    const { getByTestId, queryByTestId } = render(<ExercisePicker {...defaultProps} />);
    await waitFor(() => expect(getByTestId('picker-exercise-ex-1')).toBeTruthy());

    fireEvent.press(getByTestId('picker-filter-pull'));

    await waitFor(() => {
      expect(queryByTestId('picker-exercise-ex-1')).toBeNull();
      expect(getByTestId('picker-exercise-ex-2')).toBeTruthy();
      expect(queryByTestId('picker-exercise-ex-3')).toBeNull();
    });
    expect(getExercisesWithMetadata).toHaveBeenLastCalledWith(expect.any(Object), {
      force_type: 'pull',
    });
  });

  it('filters exercises by category chip', async () => {
    const { getByTestId, queryByTestId } = render(<ExercisePicker {...defaultProps} />);
    await waitFor(() => expect(getByTestId('picker-exercise-ex-1')).toBeTruthy());

    fireEvent.press(getByTestId('picker-filter-bodyweight'));

    await waitFor(() => {
      expect(queryByTestId('picker-exercise-ex-1')).toBeNull();
      expect(queryByTestId('picker-exercise-ex-2')).toBeNull();
      expect(getByTestId('picker-exercise-ex-3')).toBeTruthy();
    });
    expect(getExercisesWithMetadata).toHaveBeenLastCalledWith(expect.any(Object), {
      category: 'bodyweight',
    });
  });

  it('shows empty state when search has no results', async () => {
    const { getByTestId, getByText } = render(<ExercisePicker {...defaultProps} />);
    await waitFor(() => expect(getByTestId('picker-exercise-ex-1')).toBeTruthy());

    fireEvent.changeText(getByTestId('picker-search-input'), 'xyznotfound');

    await waitFor(() => {
      expect(getByText('No matching exercises.')).toBeTruthy();
    });
  });

  it('resets search and filter when reopened', async () => {
    const { getByTestId, queryByTestId, rerender } = render(<ExercisePicker {...defaultProps} />);
    await waitFor(() => expect(getByTestId('picker-exercise-ex-1')).toBeTruthy());

    // Apply a search filter
    fireEvent.changeText(getByTestId('picker-search-input'), 'squat');
    await waitFor(() => expect(queryByTestId('picker-exercise-ex-2')).toBeNull());

    // Close and reopen
    rerender(<ExercisePicker {...defaultProps} visible={false} />);
    rerender(<ExercisePicker {...defaultProps} visible={true} />);

    // Search should be cleared
    await waitFor(() => {
      expect((getByTestId('picker-search-input') as any).props.value).toBe('');
      expect(getByTestId('picker-exercise-ex-2')).toBeTruthy();
    });
  });

  it('creates a custom exercise and returns it to the picker results', async () => {
    const { getByTestId, getByText } = render(<ExercisePicker {...defaultProps} />);
    await waitFor(() => expect(getByTestId('picker-custom-exercise-btn')).toBeTruthy());

    fireEvent.press(getByTestId('picker-custom-exercise-btn'));
    fireEvent.changeText(getByTestId('custom-exercise-name-input'), ' Cable Y Raise ');
    fireEvent.press(getByTestId('custom-category-cable'));
    fireEvent.changeText(getByTestId('custom-exercise-muscle-input'), 'rear delts');
    fireEvent.press(getByTestId('save-custom-exercise-btn'));

    await waitFor(() =>
      expect(createExerciseIfMissingMock).toHaveBeenCalledWith(expect.any(Object), {
        name: 'Cable Y Raise',
        category: 'cable',
        primary_muscle: 'rear delts',
        default_unit: null,
      }),
    );
    await waitFor(() => expect(getByTestId('picker-exercise-custom-created')).toBeTruthy());
    expect(getByText('Cable Y Raise')).toBeTruthy();
  });

  it('rejects a blank custom exercise name', async () => {
    const { getByTestId, getByText } = render(<ExercisePicker {...defaultProps} />);
    await waitFor(() => expect(getByTestId('picker-custom-exercise-btn')).toBeTruthy());

    fireEvent.press(getByTestId('picker-custom-exercise-btn'));
    fireEvent.changeText(getByTestId('custom-exercise-name-input'), '   ');
    fireEvent.press(getByTestId('save-custom-exercise-btn'));

    expect(createExerciseIfMissingMock).not.toHaveBeenCalled();
    expect(getByText('Exercise name is required.')).toBeTruthy();
  });

  it('rejects a duplicate custom exercise name without creating another exercise', async () => {
    const { getByTestId, getByText } = render(<ExercisePicker {...defaultProps} />);
    await waitFor(() => expect(getByTestId('picker-custom-exercise-btn')).toBeTruthy());

    fireEvent.press(getByTestId('picker-custom-exercise-btn'));
    fireEvent.changeText(getByTestId('custom-exercise-name-input'), 'barbell squat');
    fireEvent.press(getByTestId('save-custom-exercise-btn'));

    await waitFor(() =>
      expect(createExerciseIfMissingMock).toHaveBeenCalledWith(expect.any(Object), {
        name: 'barbell squat',
        category: 'other',
        primary_muscle: null,
        default_unit: null,
      }),
    );
    expect(getByText('"Barbell Squat" already exists.')).toBeTruthy();
    expect(exerciseRows.filter((exercise) => exercise.normalized_name === 'barbell squat')).toHaveLength(
      1,
    );
  });
});
