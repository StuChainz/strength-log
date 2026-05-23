import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import ExerciseEdit from '@/screens/ExerciseEdit';

// ── Navigation mock ───────────────────────────────────────────────────────────
const mockGoBack = jest.fn();
let mockRouteParams: { exerciseId?: string } = {};

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ goBack: mockGoBack }),
  useRoute: () => ({ params: mockRouteParams }),
}));

// ── DB mock ───────────────────────────────────────────────────────────────────
const mockExistingExercise = {
  id: 'ex-1',
  name: 'Barbell Squat',
  normalized_name: 'barbell squat',
  category: 'barbell' as const,
  primary_muscle: 'quadriceps',
  default_unit: 'kg' as const,
  is_custom: 1,
  archived_at: null,
};

const mockAllExercises = [
  mockExistingExercise,
  {
    id: 'ex-2',
    name: 'Bench Press',
    normalized_name: 'bench press',
    category: 'barbell' as const,
    primary_muscle: null,
    default_unit: null,
    is_custom: 0,
    archived_at: null,
  },
];

const mockOpenDb = jest.fn().mockResolvedValue({});
const mockGetExerciseById = jest.fn();
const mockGetAllExercises = jest.fn().mockResolvedValue(mockAllExercises);
const mockCreateExercise = jest.fn().mockResolvedValue(undefined);
const mockUpdateExercise = jest.fn().mockResolvedValue(undefined);
const mockArchiveExercise = jest.fn().mockResolvedValue(undefined);

jest.mock('@/db/client', () => ({ openDb: () => mockOpenDb() }));
jest.mock('@/db/repositories/exercises.repo', () => ({
  getExerciseById: (...args: unknown[]) => mockGetExerciseById(...args),
  getAllExercises: (...args: unknown[]) => mockGetAllExercises(...args),
  createExercise: (...args: unknown[]) => mockCreateExercise(...args),
  updateExercise: (...args: unknown[]) => mockUpdateExercise(...args),
  archiveExercise: (...args: unknown[]) => mockArchiveExercise(...args),
}));

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('ExerciseEdit — create mode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouteParams = {};
  });

  it('renders empty form in create mode', () => {
    const { getByTestId, queryByTestId } = render(<ExerciseEdit />);
    expect((getByTestId('name-input') as any).props.value).toBe('');
    expect(queryByTestId('archive-btn')).toBeNull();
  });

  it('shows validation error when name is empty', async () => {
    const { getByTestId } = render(<ExerciseEdit />);
    fireEvent.press(getByTestId('save-btn'));
    await waitFor(() => {
      expect(getByTestId('name-error')).toBeTruthy();
    });
    expect(mockCreateExercise).not.toHaveBeenCalled();
  });

  it('creates exercise and goes back on valid save', async () => {
    const { getByTestId } = render(<ExerciseEdit />);
    fireEvent.changeText(getByTestId('name-input'), 'Pull Up');
    fireEvent.press(getByTestId('save-btn'));

    await waitFor(() => {
      expect(mockCreateExercise).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ name: 'Pull Up', category: 'barbell' }),
      );
      expect(mockGoBack).toHaveBeenCalled();
    });
  });

  it('clears name error when user starts typing', async () => {
    const { getByTestId, queryByTestId } = render(<ExerciseEdit />);
    fireEvent.press(getByTestId('save-btn'));
    await waitFor(() => expect(getByTestId('name-error')).toBeTruthy());

    fireEvent.changeText(getByTestId('name-input'), 'A');
    expect(queryByTestId('name-error')).toBeNull();
  });

  it('selects category chip', () => {
    const { getByTestId } = render(<ExerciseEdit />);
    fireEvent.press(getByTestId('category-dumbbell'));
    // Chip should now be active (we verify save picks up the new category)
    fireEvent.changeText(getByTestId('name-input'), 'Hammer Curl');
    fireEvent.press(getByTestId('save-btn'));

    return waitFor(() => {
      expect(mockCreateExercise).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ category: 'dumbbell' }),
      );
    });
  });

  it('selects unit chip', () => {
    const { getByTestId } = render(<ExerciseEdit />);
    fireEvent.press(getByTestId('unit-kg'));
    fireEvent.changeText(getByTestId('name-input'), 'Romanian Deadlift');
    fireEvent.press(getByTestId('save-btn'));

    return waitFor(() => {
      expect(mockCreateExercise).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ default_unit: 'kg' }),
      );
    });
  });

  it('shows duplicate warning on blur without blocking save', async () => {
    mockGetAllExercises.mockResolvedValue(mockAllExercises);
    const { getByTestId, queryByTestId } = render(<ExerciseEdit />);

    fireEvent.changeText(getByTestId('name-input'), 'Bench Press');
    fireEvent(getByTestId('name-input'), 'blur');

    await waitFor(() => {
      expect(getByTestId('duplicate-warning')).toBeTruthy();
    });

    // Save should still proceed (duplicate is a warning, not a block)
    fireEvent.press(getByTestId('save-btn'));
    await waitFor(() => {
      expect(mockCreateExercise).toHaveBeenCalled();
    });
    expect(queryByTestId('name-error')).toBeNull();
  });
});

describe('ExerciseEdit — edit mode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouteParams = { exerciseId: 'ex-1' };
    mockGetExerciseById.mockResolvedValue(mockExistingExercise);
  });

  it('loads and pre-fills existing exercise data', async () => {
    const { getByTestId } = render(<ExerciseEdit />);
    await waitFor(() => {
      expect((getByTestId('name-input') as any).props.value).toBe('Barbell Squat');
    });
    expect(getByTestId('archive-btn')).toBeTruthy();
  });

  it('calls updateExercise on save in edit mode', async () => {
    const { getByTestId } = render(<ExerciseEdit />);
    await waitFor(() => expect((getByTestId('name-input') as any).props.value).toBe('Barbell Squat'));

    fireEvent.changeText(getByTestId('name-input'), 'Barbell Back Squat');
    fireEvent.press(getByTestId('save-btn'));

    await waitFor(() => {
      expect(mockUpdateExercise).toHaveBeenCalledWith(
        expect.anything(),
        'ex-1',
        expect.objectContaining({ name: 'Barbell Back Squat' }),
      );
      expect(mockGoBack).toHaveBeenCalled();
    });
  });

  it('archives exercise after confirmation', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      const archiveBtn = buttons?.find((b) => b.text === 'Archive');
      archiveBtn?.onPress?.();
    });

    const { getByTestId } = render(<ExerciseEdit />);
    await waitFor(() => expect(getByTestId('archive-btn')).toBeTruthy());

    fireEvent.press(getByTestId('archive-btn'));

    await waitFor(() => {
      expect(mockArchiveExercise).toHaveBeenCalledWith(expect.anything(), 'ex-1');
      expect(mockGoBack).toHaveBeenCalled();
    });

    alertSpy.mockRestore();
  });

  it('does not archive when cancel is pressed', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      const cancelBtn = buttons?.find((b) => b.text === 'Cancel');
      cancelBtn?.onPress?.();
    });

    const { getByTestId } = render(<ExerciseEdit />);
    await waitFor(() => expect(getByTestId('archive-btn')).toBeTruthy());

    fireEvent.press(getByTestId('archive-btn'));

    await waitFor(() => {
      expect(mockArchiveExercise).not.toHaveBeenCalled();
    });

    alertSpy.mockRestore();
  });
});
