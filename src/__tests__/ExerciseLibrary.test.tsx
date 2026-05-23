import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ExerciseLibrary from '@/screens/ExerciseLibrary';
import { getAllExercises } from '@/db/repositories/exercises.repo';

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
    name: 'My Custom Press',
    normalized_name: 'my custom press',
    category: 'barbell',
    primary_muscle: null,
    is_custom: 1,
    default_unit: null,
    archived_at: null,
  },
];

jest.mock('@/db/client', () => ({ openDb: jest.fn() }));
jest.mock('@/db/repositories/exercises.repo', () => ({
  getAllExercises: jest.fn().mockResolvedValue(mockExercises),
}));

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('ExerciseLibrary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseFocusEffect.mockImplementation((cb) => { cb(); });
    getAllExercises.mockResolvedValue(mockExercises);
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
    render(<ExerciseLibrary />);
    await waitFor(() => expect(mockSetOptions).toHaveBeenCalled());

    // Extract the headerRight component from the last setOptions call
    const lastCall = mockSetOptions.mock.calls[mockSetOptions.mock.calls.length - 1][0];
    const HeaderRight = lastCall.headerRight;
    const { getByTestId } = render(<HeaderRight />);

    fireEvent.press(getByTestId('add-exercise-btn'));

    expect(mockNavigate).toHaveBeenCalledWith('ExerciseEdit', {});
  });

  it('shows empty state when no matches found', async () => {
    const { getByTestId, getByText } = render(<ExerciseLibrary />);
    await waitFor(() => expect(getByTestId('exercise-row-ex-1')).toBeTruthy());

    fireEvent.changeText(getByTestId('search-input'), 'xyznotfound');

    await waitFor(() => {
      expect(getByText('No matching exercises.')).toBeTruthy();
    });
  });

  it('reloads exercises on focus', async () => {
    render(<ExerciseLibrary />);
    await waitFor(() => expect(getAllExercises).toHaveBeenCalled());

    const callsBefore = getAllExercises.mock.calls.length;

    // Simulate focus by re-invoking the useFocusEffect callback
    const cb = mockUseFocusEffect.mock.calls[0][0];
    cb();

    await waitFor(() =>
      expect(getAllExercises.mock.calls.length).toBeGreaterThan(callsBefore),
    );
  });
});
