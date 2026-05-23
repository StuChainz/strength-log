import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { ExercisePicker } from '@/components/ExercisePicker';
import { getAllExercises } from '@/db/repositories/exercises.repo';
import type { Exercise } from '@/domain/types';

// ── DB mock ───────────────────────────────────────────────────────────────────
const mockExercises: Exercise[] = [
  {
    id: 'ex-1',
    name: 'Barbell Squat',
    normalized_name: 'barbell squat',
    category: 'barbell',
    primary_muscle: 'quadriceps',
    is_custom: 0,
    default_unit: null,
    archived_at: null,
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
  },
  {
    id: 'ex-3',
    name: 'Push Up',
    normalized_name: 'push up',
    category: 'bodyweight',
    primary_muscle: 'chest',
    is_custom: 0,
    default_unit: null,
    archived_at: null,
  },
];

jest.mock('@/db/client', () => ({ openDb: jest.fn().mockResolvedValue({}) }));
jest.mock('@/db/repositories/exercises.repo', () => ({
  getAllExercises: jest.fn().mockResolvedValue(mockExercises),
}));

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
    getAllExercises.mockResolvedValue(mockExercises);
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
    expect(getAllExercises).not.toHaveBeenCalled();
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

  it('filters exercises by search query', async () => {
    const { getByTestId, queryByTestId } = render(<ExercisePicker {...defaultProps} />);
    await waitFor(() => expect(getByTestId('picker-exercise-ex-1')).toBeTruthy());

    fireEvent.changeText(getByTestId('picker-search-input'), 'curl');

    await waitFor(() => {
      expect(queryByTestId('picker-exercise-ex-1')).toBeNull();
      expect(getByTestId('picker-exercise-ex-2')).toBeTruthy();
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
    const { getByTestId, queryByTestId, rerender } = render(
      <ExercisePicker {...defaultProps} />,
    );
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
});
