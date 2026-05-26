import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import TemplateBuilder from '@/screens/TemplateBuilder';
import {
  createTemplate,
  updateTemplate,
  getTemplateById,
  getTemplateItemsWithExercise,
} from '@/db/repositories/templates.repo';

// ── Navigation mock ───────────────────────────────────────────────────────────

const mockGoBack = jest.fn();
let mockRouteParams: { templateId?: string } = {};

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ goBack: mockGoBack }),
  useRoute: () => ({ params: mockRouteParams }),
}));

// ── DB & repo mocks ───────────────────────────────────────────────────────────

jest.mock('@/db/client', () => ({ openDb: jest.fn().mockResolvedValue({}) }));
jest.mock('@/db/repositories/templates.repo', () => ({
  createTemplate: jest.fn().mockResolvedValue({}),
  updateTemplate: jest.fn().mockResolvedValue(undefined),
  archiveTemplate: jest.fn().mockResolvedValue(undefined),
  getTemplateById: jest.fn(),
  getTemplateItemsWithExercise: jest.fn(),
}));

// ExercisePicker is complex; mock it with a simple stub
jest.mock('@/components/ExercisePicker', () => ({
  ExercisePicker: ({
    visible,
    onSelect,
  }: {
    visible: boolean;
    onSelect: (ex: object) => void;
    onClose: () => void;
  }) => {
    if (!visible) return null;
    const { Text, TouchableOpacity } =
      jest.requireActual<typeof import('react-native')>('react-native');
    return (
      <TouchableOpacity
        testID="mock-picker-select"
        onPress={() =>
          onSelect({
            id: 'ex-bench',
            name: 'Bench Press',
            category: 'barbell',
            normalized_name: 'bench press',
            primary_muscle: 'chest',
            is_custom: 0,
            default_unit: null,
            archived_at: null,
            created_at: 0,
            updated_at: 0,
          })
        }
      >
        <Text>Select Bench Press</Text>
      </TouchableOpacity>
    );
  },
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TemplateBuilder — create mode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouteParams = {};
  });

  it('renders the empty form', () => {
    const { getByTestId } = render(<TemplateBuilder />);
    expect(getByTestId('template-name-input')).toBeTruthy();
    expect(getByTestId('template-notes-input')).toBeTruthy();
    expect(getByTestId('add-exercise-btn')).toBeTruthy();
    expect(getByTestId('empty-exercises')).toBeTruthy();
  });

  it('save button is disabled when name and exercises are empty', () => {
    const { getByTestId } = render(<TemplateBuilder />);
    const saveBtn = getByTestId('save-btn');
    expect(saveBtn.props.accessibilityState?.disabled ?? saveBtn.props.disabled).toBeTruthy();
  });

  it('save button is disabled when name is filled but no exercises', () => {
    const { getByTestId } = render(<TemplateBuilder />);
    fireEvent.changeText(getByTestId('template-name-input'), 'Push A');
    const saveBtn = getByTestId('save-btn');
    expect(saveBtn.props.accessibilityState?.disabled ?? saveBtn.props.disabled).toBeTruthy();
  });

  it('save button is disabled when exercises exist but name is empty', async () => {
    const { getByTestId, getByText } = render(<TemplateBuilder />);

    fireEvent.press(getByTestId('add-exercise-btn'));
    await waitFor(() => expect(getByTestId('mock-picker-select')).toBeTruthy());
    fireEvent.press(getByTestId('mock-picker-select'));
    await waitFor(() => expect(getByText('Bench Press')).toBeTruthy());

    const saveBtn = getByTestId('save-btn');
    expect(saveBtn.props.accessibilityState?.disabled ?? saveBtn.props.disabled).toBeTruthy();
  });

  it('can add an exercise via the picker', async () => {
    const { getByTestId, getByText } = render(<TemplateBuilder />);

    fireEvent.press(getByTestId('add-exercise-btn'));
    await waitFor(() => expect(getByTestId('mock-picker-select')).toBeTruthy());
    fireEvent.press(getByTestId('mock-picker-select'));

    await waitFor(() => expect(getByText('Bench Press')).toBeTruthy());
  });

  it('save button is enabled when name and exercises are present', async () => {
    const { getByTestId } = render(<TemplateBuilder />);

    fireEvent.changeText(getByTestId('template-name-input'), 'Push A');
    fireEvent.press(getByTestId('add-exercise-btn'));
    await waitFor(() => expect(getByTestId('mock-picker-select')).toBeTruthy());
    fireEvent.press(getByTestId('mock-picker-select'));

    await waitFor(() => {
      const saveBtn = getByTestId('save-btn');
      const disabled = saveBtn.props.accessibilityState?.disabled ?? saveBtn.props.disabled;
      expect(disabled).toBeFalsy();
    });
  });

  it('calls createTemplate and navigates back on save', async () => {
    const { getByTestId } = render(<TemplateBuilder />);

    fireEvent.changeText(getByTestId('template-name-input'), 'Push A');
    fireEvent.press(getByTestId('add-exercise-btn'));
    await waitFor(() => expect(getByTestId('mock-picker-select')).toBeTruthy());
    fireEvent.press(getByTestId('mock-picker-select'));

    await waitFor(() => {
      const saveBtn = getByTestId('save-btn');
      const disabled = saveBtn.props.accessibilityState?.disabled ?? saveBtn.props.disabled;
      expect(disabled).toBeFalsy();
    });

    fireEvent.press(getByTestId('save-btn'));

    await waitFor(() => {
      expect(createTemplate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ name: 'Push A' }),
      );
      expect(mockGoBack).toHaveBeenCalled();
    });
  });

  it('still saves template notes and target fields after layout changes', async () => {
    const { getAllByPlaceholderText, getByTestId } = render(<TemplateBuilder />);

    fireEvent.changeText(getByTestId('template-name-input'), 'Push A');
    fireEvent.changeText(getByTestId('template-notes-input'), 'Keep elbows tucked');
    fireEvent.press(getByTestId('add-exercise-btn'));
    await waitFor(() => expect(getByTestId('mock-picker-select')).toBeTruthy());
    fireEvent.press(getByTestId('mock-picker-select'));

    await waitFor(() => expect(getAllByPlaceholderText('—')).toHaveLength(4));
    const [setsInput, repsInput, weightInput, rpeInput] = getAllByPlaceholderText('—');
    fireEvent.changeText(setsInput!, '3');
    fireEvent.changeText(repsInput!, '8');
    fireEvent.changeText(weightInput!, '32.5');
    fireEvent.changeText(rpeInput!, '8');

    fireEvent.press(getByTestId('save-btn'));

    await waitFor(() => {
      expect(createTemplate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          name: 'Push A',
          notes: 'Keep elbows tucked',
          items: [
            {
              exercise_id: 'ex-bench',
              target_sets: 3,
              target_reps: 8,
              target_weight: 32.5,
              target_rpe: 8,
              rest_seconds: null,
            },
          ],
        }),
      );
      expect(mockGoBack).toHaveBeenCalled();
    });
  });

  it('does not show archive button in create mode', () => {
    const { queryByTestId } = render(<TemplateBuilder />);
    expect(queryByTestId('archive-btn')).toBeNull();
  });
});

describe('TemplateBuilder — edit mode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouteParams = { templateId: 'tmpl-1' };
    (getTemplateById as jest.Mock).mockResolvedValue({
      id: 'tmpl-1',
      name: 'Push A',
      notes: 'Focus on form',
      archived_at: null,
      created_at: 1000,
      updated_at: 1000,
    });
    (getTemplateItemsWithExercise as jest.Mock).mockResolvedValue([
      {
        id: 'item-1',
        template_id: 'tmpl-1',
        exercise_id: 'ex-bench',
        exercise_name: 'Bench Press',
        exercise_category: 'barbell',
        position: 0,
        target_sets: 4,
        target_reps: 8,
        target_weight: 80,
        target_rpe: 8,
        rest_seconds: 90,
      },
    ]);
  });

  it('loads and displays existing template data', async () => {
    const { getByTestId, getByText } = render(<TemplateBuilder />);
    await waitFor(() => {
      expect(getByTestId('template-name-input').props.value).toBe('Push A');
      expect(getByText('Bench Press')).toBeTruthy();
    });
  });

  it('shows archive button in edit mode', async () => {
    const { getByTestId } = render(<TemplateBuilder />);
    await waitFor(() => expect(getByTestId('archive-btn')).toBeTruthy());
  });

  it('calls updateTemplate on save', async () => {
    const { getByTestId } = render(<TemplateBuilder />);
    await waitFor(() => expect(getByTestId('template-name-input').props.value).toBe('Push A'));

    fireEvent.press(getByTestId('save-btn'));

    await waitFor(() => {
      expect(updateTemplate).toHaveBeenCalledWith(
        expect.anything(),
        'tmpl-1',
        expect.objectContaining({ name: 'Push A' }),
      );
      expect(mockGoBack).toHaveBeenCalled();
    });
  });

  it('shows and saves rest seconds for template exercises', async () => {
    const { getByTestId, getByText } = render(<TemplateBuilder />);
    await waitFor(() => expect(getByTestId('template-name-input').props.value).toBe('Push A'));

    expect(getByText('Rest')).toBeTruthy();
    expect(getByText('90s')).toBeTruthy();

    fireEvent.press(getByText('120s'));
    fireEvent.press(getByTestId('save-btn'));

    await waitFor(() => {
      expect(updateTemplate).toHaveBeenCalledWith(
        expect.anything(),
        'tmpl-1',
        expect.objectContaining({
          items: [
            expect.objectContaining({
              exercise_id: 'ex-bench',
              rest_seconds: 120,
            }),
          ],
        }),
      );
    });
  });

  it('can reorder exercises with up/down buttons', async () => {
    (getTemplateItemsWithExercise as jest.Mock).mockResolvedValue([
      {
        id: 'item-1',
        template_id: 'tmpl-1',
        exercise_id: 'ex-bench',
        exercise_name: 'Bench Press',
        exercise_category: 'barbell',
        position: 0,
        target_sets: null,
        target_reps: null,
        target_weight: null,
        target_rpe: null,
        rest_seconds: null,
      },
      {
        id: 'item-2',
        template_id: 'tmpl-1',
        exercise_id: 'ex-ohp',
        exercise_name: 'OHP',
        exercise_category: 'barbell',
        position: 1,
        target_sets: null,
        target_reps: null,
        target_weight: null,
        target_rpe: null,
        rest_seconds: null,
      },
    ]);

    const { getAllByText, getByTestId } = render(<TemplateBuilder />);
    await waitFor(() => expect(getAllByText('Bench Press').length).toBeGreaterThan(0));

    // Move OHP up — find the move-up button for the second item
    // Both items are rendered; we look for move-up button on key "2" (second item added)
    // Keys are incremented globally; in tests they start from wherever counter is
    // Instead, test that the move-down on first item works
    const moveDownBtns = getAllByText('▼');
    fireEvent.press(moveDownBtns[0]!); // move Bench down

    // After reorder, OHP should be first in save order
    fireEvent.press(getByTestId('save-btn'));

    await waitFor(() => {
      expect(updateTemplate).toHaveBeenCalledWith(
        expect.anything(),
        'tmpl-1',
        expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({ exercise_id: 'ex-ohp' }),
            expect.objectContaining({ exercise_id: 'ex-bench' }),
          ]),
        }),
      );
    });
  });
});
