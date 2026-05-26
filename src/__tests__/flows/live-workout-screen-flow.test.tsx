import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import LiveWorkout from '@/screens/LiveWorkout';
import { getPreviousPRDataForExercises } from '@/db/repositories/prs.repo';
import { getProgressionSuggestion } from '@/domain/progression';
import { useSessionStore, type UseSessionStoreReturn } from '@/state/session.store';

const mockReplace = jest.fn();
const mockPopToTop = jest.fn();
let mockRouteParams: { templateId?: string } = {};
const mockDb = {
  getAllAsync: jest.fn().mockResolvedValue([]),
  getFirstAsync: jest.fn().mockResolvedValue(null),
  runAsync: jest.fn(),
};

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    replace: mockReplace,
    popToTop: mockPopToTop,
  }),
  useRoute: () => ({ params: mockRouteParams }),
}));

jest.mock('@/db/client', () => ({
  openDb: jest.fn().mockResolvedValue(mockDb),
}));

jest.mock('@/state/session.store', () => ({
  useSessionStore: jest.fn(),
}));

jest.mock('@/db/repositories/prs.repo', () => ({
  getPreviousPRDataForExercises: jest.fn(),
}));

jest.mock('@/db/repositories/events.repo', () => ({
  getLatestRestTimerEvent: jest.fn().mockResolvedValue(null),
  insertEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/domain/progression', () => ({
  getProgressionSuggestion: jest.fn(() => ({
    label: 'No suggestion yet.',
    reason: 'No suggestion yet',
    weight: null,
    reps: null,
    rpe: null,
    unit: 'kg',
    source: 'fallback',
    rule: 'none',
  })),
}));

jest.mock('@/components/ExercisePicker', () => ({
  ExercisePicker: () => null,
}));

jest.mock('@/components/MicButton', () => ({
  MicButton: () => null,
}));

jest.mock('@/screens/ExerciseHistorySheet', () => () => null);
jest.mock('@/screens/VoiceConfirm', () => () => null);

const useSessionStoreMock = useSessionStore as jest.MockedFunction<typeof useSessionStore>;
const getPreviousPRDataForExercisesMock = getPreviousPRDataForExercises as jest.MockedFunction<
  typeof getPreviousPRDataForExercises
>;
const getProgressionSuggestionMock = getProgressionSuggestion as jest.MockedFunction<
  typeof getProgressionSuggestion
>;

function activeStore(overrides: Partial<UseSessionStoreReturn> = {}): UseSessionStoreReturn {
  return {
    phase: 'active',
    session: {
      id: 'session-1',
      template_id: null,
      name: null,
      status: 'in_progress',
      started_at: Date.now(),
      ended_at: null,
      total_volume_cached: null,
      created_at: Date.now(),
      updated_at: Date.now(),
    },
    existingSession: null,
    resumedStartedAt: null,
    exercises: [
      {
        id: 'bench',
        name: 'Barbell Bench Press',
        category: 'barbell',
        defaultUnit: 'kg',
        targetSets: 3,
        targetReps: 5,
        targetWeight: 80,
        targetRpe: 8,
        restSeconds: null,
      },
    ],
    sets: [
      {
        id: 'set-1',
        session_id: 'session-1',
        exercise_id: 'bench',
        position: 0,
        weight: 80,
        reps: 5,
        rpe: 8,
        unit: 'kg',
        is_warmup: 0,
        set_type: 'working',
        logged_at: Date.now(),
        source: 'tap',
        client_set_id: 'client-set-1',
        deleted_at: null,
      },
    ],
    activeExerciseId: 'bench',
    setActiveExerciseId: jest.fn(),
    logSet: jest.fn().mockResolvedValue(undefined),
    editSet: jest.fn().mockResolvedValue(undefined),
    deleteSet: jest.fn().mockResolvedValue(undefined),
    undoLastSet: jest.fn().mockResolvedValue(undefined),
    endWorkout: jest.fn().mockResolvedValue(undefined),
    discardWorkout: jest.fn().mockResolvedValue(undefined),
    resumeExisting: jest.fn().mockResolvedValue(undefined),
    endExisting: jest.fn().mockResolvedValue(undefined),
    discardExisting: jest.fn().mockResolvedValue(undefined),
    discardAndStart: jest.fn().mockResolvedValue(undefined),
    addExercise: jest.fn(),
    ...overrides,
  };
}

describe('LiveWorkout screen core flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    mockRouteParams = {};
    mockDb.getAllAsync.mockResolvedValue([]);
    mockDb.getFirstAsync.mockResolvedValue(null);
    mockDb.runAsync.mockResolvedValue({ changes: 0, lastInsertRowId: 0 });
    getPreviousPRDataForExercisesMock.mockResolvedValue({
      repMaxes: [],
      estimated1RMs: [],
      sessionVolumes: [],
    });
    getProgressionSuggestionMock.mockReturnValue({
      label: 'No suggestion yet.',
      reason: 'No suggestion yet',
      weight: null,
      reps: null,
      rpe: null,
      unit: 'kg',
      source: 'fallback',
      rule: 'none',
    });
    useSessionStoreMock.mockReturnValue(activeStore());
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders today's target with sets, reps, weight, RPE, and completed count", () => {
    const store = activeStore();
    useSessionStoreMock.mockReturnValue(store);

    const { getByText } = render(<LiveWorkout />);

    expect(getByText("TODAY'S TARGET")).toBeTruthy();
    expect(getByText('3 sets × 5 reps @ 80 kg · RPE 8')).toBeTruthy();
    expect(getByText('1 / 3 complete')).toBeTruthy();
  });

  it('renders a clear no-target state', () => {
    const store = activeStore({
      exercises: [
        {
          id: 'bench',
          name: 'Barbell Bench Press',
          category: 'barbell',
          defaultUnit: 'kg',
          targetSets: null,
          targetReps: null,
          targetWeight: null,
          targetRpe: null,
          restSeconds: null,
        },
      ],
      sets: [],
    });
    useSessionStoreMock.mockReturnValue(store);

    const { getByText, queryByText } = render(<LiveWorkout />);

    expect(getByText("TODAY'S TARGET")).toBeTruthy();
    expect(getByText('No programmed target')).toBeTruthy();
    expect(queryByText(/complete/)).toBeNull();
  });

  it('renders suggestion copy with a short reason label', () => {
    getProgressionSuggestionMock.mockReturnValue({
      label: 'Same weight, same reps.',
      reason: 'Repeat target',
      weight: 80,
      reps: 5,
      rpe: null,
      unit: 'kg',
      source: 'template_rule',
      rule: 'linear',
    });
    const store = activeStore({ sets: [] });
    useSessionStoreMock.mockReturnValue(store);

    const { getByText } = render(<LiveWorkout />);

    expect(getByText(/Repeat target/)).toBeTruthy();
    expect(getByText(/Suggest ·/)).toBeTruthy();
  });

  it('renders suggestion reason from a template rule and tapping only fills the logger', async () => {
    getProgressionSuggestionMock.mockReturnValue({
      label: 'Linear: target hit',
      reason: 'Linear: target hit',
      weight: 82.5,
      reps: 5,
      rpe: null,
      unit: 'kg',
      source: 'template_rule',
      rule: 'linear',
    });
    const store = activeStore({ sets: [] });
    useSessionStoreMock.mockReturnValue(store);

    const { getByTestId, getByText } = render(<LiveWorkout />);

    expect(getByText(/Linear: target hit/)).toBeTruthy();
    fireEvent.press(getByTestId('suggestion-row'));

    await waitFor(() => expect(getByText('Log set · 82.5 × 5')).toBeTruthy());
    expect(store.logSet).not.toHaveBeenCalled();
  });

  it('updates live suggestion from current-session sets after a logged overshoot', () => {
    getProgressionSuggestionMock.mockImplementation((input) => {
      const currentSet = input.currentSessionSets?.find((set) => set.deleted_at === null);
      if (currentSet?.reps === 15) {
        return {
          label: 'Target exceeded',
          reason: 'Target exceeded',
          weight: 100,
          reps: 5,
          rpe: null,
          unit: 'kg',
          source: 'current_session',
          rule: 'none',
        };
      }

      return {
        label: 'Back off after missed reps',
        reason: 'Back off after missed reps',
        weight: 95,
        reps: 5,
        rpe: null,
        unit: 'kg',
        source: 'fallback',
        rule: 'none',
      };
    });

    let store = activeStore({
      exercises: [
        {
          ...activeStore().exercises[0]!,
          id: 'squat',
          name: 'Back Squat',
          targetWeight: 100,
          targetReps: 5,
        },
      ],
      sets: [],
      activeExerciseId: 'squat',
    });
    useSessionStoreMock.mockImplementation(() => store);

    const screen = render(<LiveWorkout />);

    expect(screen.getByText(/Back off after missed reps/)).toBeTruthy();

    store = activeStore({
      exercises: [
        {
          ...activeStore().exercises[0]!,
          id: 'squat',
          name: 'Back Squat',
          targetWeight: 100,
          targetReps: 5,
        },
      ],
      sets: [
        {
          ...activeStore().sets[0]!,
          id: 'squat-set-1',
          session_id: 'session-1',
          exercise_id: 'squat',
          weight: 100,
          reps: 15,
          deleted_at: null,
        },
      ],
      activeExerciseId: 'squat',
    });
    screen.rerender(<LiveWorkout />);

    expect(screen.queryByText(/Back off after missed reps/)).toBeNull();
    expect(screen.getByText(/Target exceeded/)).toBeTruthy();
    expect(getProgressionSuggestionMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        currentSessionSets: [expect.objectContaining({ exercise_id: 'squat', reps: 15 })],
      }),
    );
  });

  it('shows the active exercise, set rows, log button, and undo control', async () => {
    const store = activeStore();
    useSessionStoreMock.mockReturnValue(store);
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.text === 'Undo')?.onPress?.();
    });

    const { getByTestId, getByText } = render(<LiveWorkout />);

    await waitFor(() => expect(getByText('Barbell Bench Press')).toBeTruthy());
    expect(getByTestId('set-row-set-1')).toBeTruthy();
    expect(getByTestId('log-set-btn')).toBeTruthy();
    expect(getByText('UNDO')).toBeTruthy();

    fireEvent.press(getByText('UNDO'));
    expect(store.undoLastSet).toHaveBeenCalledTimes(1);

    fireEvent.press(getByTestId('log-set-btn'));
    await waitFor(() =>
      expect(store.logSet).toHaveBeenCalledWith({
        exerciseId: 'bench',
        weight: 80,
        reps: 5,
        rpe: null,
        unit: 'kg',
        setType: 'working',
      }),
    );

    alertSpy.mockRestore();
  });

  it('renders an explicit finish button that opens the end workout dialog', () => {
    const store = activeStore();
    useSessionStoreMock.mockReturnValue(store);
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const { getByTestId, getByText } = render(<LiveWorkout />);

    expect(getByText('Finish')).toBeTruthy();
    fireEvent.press(getByTestId('end-workout-btn'));

    expect(alertSpy).toHaveBeenCalledWith(
      'End Workout',
      'Finish and save this workout?',
      expect.arrayContaining([
        expect.objectContaining({ text: 'Cancel' }),
        expect.objectContaining({ text: 'End Workout' }),
        expect.objectContaining({ text: 'Discard', style: 'destructive' }),
      ]),
    );

    alertSpy.mockRestore();
  });

  it('accepts direct typed weight values before logging a set', async () => {
    const store = activeStore({ sets: [] });
    useSessionStoreMock.mockReturnValue(store);

    const { getByTestId } = render(<LiveWorkout />);

    fireEvent.changeText(getByTestId('weight-input'), '32.5');
    fireEvent.press(getByTestId('log-set-btn'));

    await waitFor(() =>
      expect(store.logSet).toHaveBeenCalledWith({
        exerciseId: 'bench',
        weight: 32.5,
        reps: 5,
        rpe: null,
        unit: 'kg',
        setType: 'working',
      }),
    );
  });

  it('accepts direct typed rep values before logging a set', async () => {
    const store = activeStore({ sets: [] });
    useSessionStoreMock.mockReturnValue(store);

    const { getByTestId } = render(<LiveWorkout />);

    fireEvent.changeText(getByTestId('reps-input'), '8');
    fireEvent.press(getByTestId('log-set-btn'));

    await waitFor(() =>
      expect(store.logSet).toHaveBeenCalledWith({
        exerciseId: 'bench',
        weight: 80,
        reps: 8,
        rpe: null,
        unit: 'kg',
        setType: 'working',
      }),
    );
  });

  it('auto-starts the configured rest timer after logging a set', async () => {
    const store = activeStore({
      exercises: [{ ...activeStore().exercises[0]!, restSeconds: 90 }],
      sets: [],
    });
    useSessionStoreMock.mockReturnValue(store);

    const { getByTestId } = render(<LiveWorkout />);

    fireEvent.press(getByTestId('log-set-btn'));

    await waitFor(() => expect(store.logSet).toHaveBeenCalledTimes(1));
    expect(getByTestId('rest-timer-remaining').props.children).toBe('01:30');
  });

  it('does not auto-start a rest timer when no rest is configured', async () => {
    const store = activeStore({ sets: [] });
    useSessionStoreMock.mockReturnValue(store);

    const { getByTestId, queryByTestId } = render(<LiveWorkout />);

    fireEvent.press(getByTestId('log-set-btn'));

    await waitFor(() => expect(store.logSet).toHaveBeenCalledTimes(1));
    expect(queryByTestId('rest-timer-remaining')).toBeNull();
    expect(getByTestId('manual-rest-60')).toBeTruthy();
  });

  it('starts, extends, and stops a manual rest timer without logging sets', async () => {
    const store = activeStore({ sets: [] });
    useSessionStoreMock.mockReturnValue(store);

    const { getByTestId, queryByTestId } = render(<LiveWorkout />);

    fireEvent.press(getByTestId('manual-rest-60'));
    expect(getByTestId('rest-timer-remaining').props.children).toBe('01:00');

    fireEvent.press(getByTestId('rest-add-15'));
    expect(getByTestId('rest-timer-remaining').props.children).toBe('01:15');

    fireEvent.press(getByTestId('rest-subtract-15'));
    expect(getByTestId('rest-timer-remaining').props.children).toBe('01:00');

    fireEvent.press(getByTestId('rest-stop'));
    expect(queryByTestId('rest-timer-remaining')).toBeNull();
    expect(getByTestId('manual-rest-60')).toBeTruthy();
    expect(store.logSet).not.toHaveBeenCalled();
  });

  it('uses the selected manual rest for future sets of the active exercise', async () => {
    const store = activeStore({ sets: [] });
    useSessionStoreMock.mockReturnValue(store);

    const { getByTestId } = render(<LiveWorkout />);

    fireEvent.press(getByTestId('manual-rest-90'));
    expect(getByTestId('rest-timer-remaining').props.children).toBe('01:30');

    fireEvent.press(getByTestId('rest-stop'));
    fireEvent.press(getByTestId('log-set-btn'));

    await waitFor(() => expect(store.logSet).toHaveBeenCalledTimes(1));
    expect(getByTestId('rest-timer-remaining').props.children).toBe('01:30');
  });

  it('shows rest done when the foreground timer reaches zero', async () => {
    jest.useFakeTimers({ now: 1_000_000 });
    const store = activeStore({ sets: [] });
    useSessionStoreMock.mockReturnValue(store);

    const { getByTestId, getByText } = render(<LiveWorkout />);

    fireEvent.press(getByTestId('manual-rest-60'));
    act(() => {
      jest.advanceTimersByTime(60_000);
    });

    await waitFor(() => expect(getByText('Rest done')).toBeTruthy());
    expect(getByTestId('rest-timer-remaining').props.children).toBe('00:00');
    jest.useRealTimers();
  });

  it('commits typed edits from completed set weight and reps fields', async () => {
    const store = activeStore();
    useSessionStoreMock.mockReturnValue(store);

    const { getByTestId } = render(<LiveWorkout />);

    fireEvent.changeText(getByTestId('set-weight-input-set-1'), '82.5');
    fireEvent(getByTestId('set-weight-input-set-1'), 'submitEditing');

    await waitFor(() =>
      expect(store.editSet).toHaveBeenCalledWith('set-1', { weight: 82.5, unit: 'kg' }),
    );

    fireEvent.changeText(getByTestId('set-reps-input-set-1'), '6');
    fireEvent(getByTestId('set-reps-input-set-1'), 'submitEditing');

    await waitFor(() =>
      expect(store.editSet).toHaveBeenCalledWith('set-1', { reps: 6, unit: 'kg' }),
    );
  });

  it('edits a completed set type from the edit modal', async () => {
    const store = activeStore();
    useSessionStoreMock.mockReturnValue(store);

    const { getByTestId } = render(<LiveWorkout />);

    fireEvent.press(getByTestId('edit-set-btn-set-1'));
    fireEvent.press(getByTestId('edit-set-type-option-drop'));
    fireEvent.press(getByTestId('save-edit-set-btn'));

    await waitFor(() =>
      expect(store.editSet).toHaveBeenCalledWith('set-1', {
        weight: 80,
        reps: 5,
        rpe: 8,
        unit: 'kg',
        set_type: 'drop',
      }),
    );
  });

  it('opens a workout summary with completed sets and remaining target sets', () => {
    const store = activeStore({
      session: {
        ...activeStore().session!,
        template_id: 'template-1',
      },
      exercises: [
        {
          id: 'bench',
          name: 'Barbell Bench Press',
          category: 'barbell',
          defaultUnit: 'kg',
          targetSets: 3,
          targetReps: 5,
          targetWeight: 80,
          targetRpe: 8,
          restSeconds: null,
        },
        {
          id: 'row',
          name: 'Cable Row',
          category: 'machine',
          defaultUnit: 'kg',
          targetSets: null,
          targetReps: null,
          targetWeight: null,
          targetRpe: null,
          restSeconds: null,
        },
      ],
      sets: [
        {
          id: 'set-1',
          session_id: 'session-1',
          exercise_id: 'bench',
          position: 0,
          weight: 80,
          reps: 5,
          rpe: 8,
          unit: 'kg',
          is_warmup: 0,
          set_type: 'working',
          logged_at: Date.now(),
          source: 'tap',
          client_set_id: 'client-set-1',
          deleted_at: null,
        },
        {
          id: 'set-2',
          session_id: 'session-1',
          exercise_id: 'row',
          position: 0,
          weight: 50,
          reps: 10,
          rpe: 8,
          unit: 'kg',
          is_warmup: 0,
          set_type: 'working',
          logged_at: Date.now(),
          source: 'tap',
          client_set_id: 'client-set-2',
          deleted_at: null,
        },
      ],
    });
    useSessionStoreMock.mockReturnValue(store);

    const { getAllByText, getByTestId, getByText } = render(<LiveWorkout />);

    fireEvent.press(getByTestId('summary-btn'));

    expect(getByTestId('workout-summary-modal')).toBeTruthy();
    expect(getByTestId('summary-total-sets').props.children).toBe(2);
    expect(getByTestId('summary-working-sets').props.children).toBe(2);
    expect(getByTestId('summary-total-volume').props.children).toEqual(['900', ' kg']);
    expect(getByTestId('summary-working-volume').props.children).toEqual(['900', ' kg']);
    expect(getAllByText('Barbell Bench Press').length).toBeGreaterThanOrEqual(1);
    expect(getByText('Cable Row')).toBeTruthy();
    expect(getByText('Target: 3 × 5 @ 80 kg RPE 8')).toBeTruthy();
    expect(getByText(/1\. 80 × 5 working/)).toBeTruthy();
    expect(getByTestId('summary-left-bench').props.children).toEqual([
      'Left: ',
      2,
      ' working ',
      'sets',
    ]);
  });

  it('opens the custom workout summary without template targets', () => {
    const store = activeStore({
      exercises: [],
      sets: [],
      activeExerciseId: null,
    });
    useSessionStoreMock.mockReturnValue(store);

    const { getByTestId, getByText } = render(<LiveWorkout />);

    fireEvent.press(getByTestId('summary-btn'));

    expect(getByTestId('workout-summary-modal')).toBeTruthy();
    expect(getByText('No sets logged yet.')).toBeTruthy();
  });

  it('logs warm-up sets from the compact set type selector', async () => {
    const store = activeStore({ sets: [] });
    useSessionStoreMock.mockReturnValue(store);

    const { getByTestId } = render(<LiveWorkout />);

    fireEvent.press(getByTestId('set-type-option-warmup'));
    fireEvent.press(getByTestId('log-set-btn'));

    await waitFor(() =>
      expect(store.logSet).toHaveBeenCalledWith({
        exerciseId: 'bench',
        weight: 80,
        reps: 5,
        rpe: null,
        unit: 'kg',
        setType: 'warmup',
      }),
    );
  });

  it('displays warm-up and drop set types on completed rows', () => {
    const store = activeStore({
      sets: [
        {
          ...activeStore().sets[0]!,
          id: 'warmup-set',
          set_type: 'warmup',
          is_warmup: 1,
        },
        {
          ...activeStore().sets[0]!,
          id: 'drop-set',
          position: 1,
          set_type: 'drop',
        },
      ],
    });
    useSessionStoreMock.mockReturnValue(store);

    const { getByTestId } = render(<LiveWorkout />);

    expect(getByTestId('set-type-warmup-set').props.children).toBe('WARM-UP');
    expect(getByTestId('set-type-drop-set').props.children).toBe('DROP');
  });

  it('shows a subtle live potential PR indicator after a qualifying set', async () => {
    const store = activeStore();
    useSessionStoreMock.mockReturnValue(store);

    const { getAllByText, getByTestId, getByText } = render(<LiveWorkout />);

    await waitFor(() => expect(getByTestId('potential-pr-set-1')).toBeTruthy());
    expect(getByText(/Potential rep PR/)).toBeTruthy();
    expect(getAllByText(/PR pending until workout is saved/).length).toBeGreaterThan(0);
  });

  it('does not show live potential PR indicators for warm-up sets', () => {
    const store = activeStore({
      sets: [{ ...activeStore().sets[0]!, set_type: 'warmup', is_warmup: 1 }],
    });
    useSessionStoreMock.mockReturnValue(store);

    const { queryByText } = render(<LiveWorkout />);

    expect(queryByText(/Potential rep PR/)).toBeNull();
    expect(queryByText(/PR pending until workout is saved/)).toBeNull();
  });

  it('removes live potential PR indicators when a set is edited lower, deleted, or changed to warm-up', async () => {
    getPreviousPRDataForExercisesMock.mockResolvedValue({
      repMaxes: [{ exerciseId: 'bench', reps: 5, weight: 80 }],
      estimated1RMs: [{ exerciseId: 'bench', value: 90 }],
      sessionVolumes: [{ exerciseId: 'bench', value: 400 }],
    });

    const strongStore = activeStore({
      sets: [{ ...activeStore().sets[0]!, weight: 85, reps: 5 }],
    });
    useSessionStoreMock.mockReturnValue(strongStore);
    const screen = render(<LiveWorkout />);

    await waitFor(() => expect(screen.getByText(/Potential rep PR/)).toBeTruthy());

    const weakerStore = activeStore({
      sets: [{ ...activeStore().sets[0]!, weight: 75, reps: 5 }],
    });
    useSessionStoreMock.mockReturnValue(weakerStore);
    screen.rerender(<LiveWorkout />);
    await waitFor(() => expect(screen.queryByText(/Potential rep PR/)).toBeNull());

    const deletedStore = activeStore({
      sets: [{ ...activeStore().sets[0]!, weight: 85, reps: 5, deleted_at: 123 }],
    });
    useSessionStoreMock.mockReturnValue(deletedStore);
    screen.rerender(<LiveWorkout />);
    expect(screen.queryByText(/Potential rep PR/)).toBeNull();

    const warmupStore = activeStore({
      sets: [{ ...activeStore().sets[0]!, weight: 85, reps: 5, set_type: 'warmup', is_warmup: 1 }],
    });
    useSessionStoreMock.mockReturnValue(warmupStore);
    screen.rerender(<LiveWorkout />);
    expect(screen.queryByText(/Potential rep PR/)).toBeNull();
  });

  it('does not write final PR rows from the live workout screen', () => {
    const store = activeStore();
    useSessionStoreMock.mockReturnValue(store);

    render(<LiveWorkout />);

    expect(mockDb.runAsync).not.toHaveBeenCalled();
  });

  it('commits supported typed voice parser output into workout actions', async () => {
    const store = activeStore({ sets: [] });
    useSessionStoreMock.mockReturnValue(store);

    const { getByPlaceholderText } = render(<LiveWorkout />);
    const input = getByPlaceholderText('Typed voice debug');

    fireEvent.changeText(input, '80 for 5');
    fireEvent(input, 'submitEditing');

    await waitFor(() =>
      expect(store.logSet).toHaveBeenCalledWith({
        exerciseId: 'bench',
        weight: 80,
        reps: 5,
        rpe: null,
        unit: 'kg',
        source: 'voice',
      }),
    );
  });

  it('starts the real timer from typed rest commands', async () => {
    const store = activeStore({ sets: [] });
    useSessionStoreMock.mockReturnValue(store);

    const { getByPlaceholderText, getByTestId } = render(<LiveWorkout />);
    const input = getByPlaceholderText('Typed voice debug');

    fireEvent.changeText(input, 'rest 3 minutes');
    fireEvent(input, 'submitEditing');

    await waitFor(() => expect(getByTestId('rest-timer-remaining').props.children).toBe('03:00'));
    expect(store.logSet).not.toHaveBeenCalled();
  });
});
