import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import EndWorkoutSummary, { getBestLift, groupPRsByExercise } from '@/screens/EndWorkoutSummary';
import { getWorkoutSummary } from '@/db/repositories/sessionSummary.repo';
import type { WorkoutSummary } from '@/db/repositories/sessionSummary.repo';

const mockReplace = jest.fn();

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    replace: mockReplace,
  }),
  useRoute: () => ({ params: { sessionId: 'session-1' } }),
}));

jest.mock('@/db/client', () => ({
  openDb: jest.fn().mockResolvedValue({}),
}));

jest.mock('@/db/repositories/sessionSummary.repo', () => ({
  getWorkoutSummary: jest.fn(),
}));

const getWorkoutSummaryMock = getWorkoutSummary as jest.MockedFunction<typeof getWorkoutSummary>;

const baseSummary: WorkoutSummary = {
  session: {
    id: 'session-1',
    template_id: null,
    name: null,
    status: 'completed' as const,
    started_at: 1,
    ended_at: 2,
    total_volume_cached: 400,
    created_at: 1,
    updated_at: 2,
  },
  setCount: 1,
  volume: 400,
  durationMin: 30,
  prCount: 0,
  prs: [],
  muscleSummary: {},
  exercises: [],
  tags: [],
  note: null,
};

function set(overrides: Partial<WorkoutSummary['exercises'][number]['sets'][number]>) {
  return {
    id: overrides.id ?? 'set-1',
    session_id: 'session-1',
    exercise_id: overrides.exercise_id ?? 'bench',
    exercise_name: overrides.exercise_name ?? 'Bench Press',
    position: overrides.position ?? 0,
    weight: overrides.weight ?? 80,
    reps: overrides.reps ?? 5,
    rpe: null,
    unit: overrides.unit ?? 'kg',
    is_warmup: overrides.is_warmup ?? 0,
    set_type: overrides.set_type ?? 'working',
    logged_at: overrides.logged_at ?? 1,
    source: 'tap' as const,
    client_set_id: overrides.client_set_id ?? 'client-set-1',
    deleted_at: overrides.deleted_at ?? null,
  };
}

function summaryWithSets(
  exerciseName: string,
  sets: WorkoutSummary['exercises'][number]['sets'],
): WorkoutSummary {
  return {
    ...baseSummary,
    exercises: [
      {
        exerciseId: sets[0]?.exercise_id ?? 'bench',
        name: exerciseName,
        sets,
        volume: 0,
      },
    ],
  };
}

describe('EndWorkoutSummary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders completed workout stats', async () => {
    getWorkoutSummaryMock.mockResolvedValue({
      ...baseSummary,
      setCount: 24,
      volume: 2400,
      durationMin: 47,
      prCount: 9,
    });

    const { getByText } = render(<EndWorkoutSummary />);

    await waitFor(() => expect(getByText('Workout Complete')).toBeTruthy());
    expect(getByText('47')).toBeTruthy();
    expect(getByText('2.4k')).toBeTruthy();
    expect(getByText('24')).toBeTruthy();
    expect(getByText('9')).toBeTruthy();
  });

  it('groups final PRs by exercise', async () => {
    getWorkoutSummaryMock.mockResolvedValue({
      ...baseSummary,
      prCount: 3,
      prs: [
        {
          id: 'pr-1',
          exercise_id: 'bench',
          exercise_name: 'Bench Press',
          session_id: 'session-1',
          set_id: 'set-1',
          record_type: 'rep_max',
          record_key: 'rep_max:5',
          reps: 5,
          weight: 80,
          value: 80,
          unit: 'kg',
          achieved_at: 1,
          created_at: 2,
        },
        {
          id: 'pr-2',
          exercise_id: 'bench',
          exercise_name: 'Bench Press',
          session_id: 'session-1',
          set_id: 'set-1',
          record_type: 'estimated_1rm',
          record_key: 'estimated_1rm',
          reps: 5,
          weight: 80,
          value: 93.333,
          unit: 'kg',
          achieved_at: 1,
          created_at: 2,
        },
        {
          id: 'pr-3',
          exercise_id: 'fly',
          exercise_name: 'Cable Fly',
          session_id: 'session-1',
          set_id: null,
          record_type: 'session_volume',
          record_key: 'session_volume',
          reps: null,
          weight: null,
          value: 320,
          unit: 'kg',
          achieved_at: 1,
          created_at: 2,
        },
      ],
    });

    const { getByText } = render(<EndWorkoutSummary />);

    await waitFor(() => expect(getByText('Personal Records')).toBeTruthy());
    expect(getByText('Bench Press')).toBeTruthy();
    expect(getByText('2 PRs')).toBeTruthy();
    expect(getByText('Rep PR')).toBeTruthy();
    expect(getByText('Estimated 1RM PR')).toBeTruthy();
    expect(getByText('Cable Fly')).toBeTruthy();
    expect(getByText('Volume PR')).toBeTruthy();
  });

  it('handles sessions with no PRs without crashing', async () => {
    getWorkoutSummaryMock.mockResolvedValue(baseSummary);

    const { getByText } = render(<EndWorkoutSummary />);

    await waitFor(() => expect(getByText('No new PRs today.')).toBeTruthy());
  });

  it('opens feedback from the workout summary header', async () => {
    getWorkoutSummaryMock.mockResolvedValue(baseSummary);

    const { getByTestId, getByText } = render(<EndWorkoutSummary />);

    await waitFor(() => expect(getByText('Workout Complete')).toBeTruthy());
    fireEvent.press(getByTestId('summary-feedback-btn'));

    expect(getByTestId('feedback-modal')).toBeTruthy();
  });

  it('renders collapsible Next Time recommendations', async () => {
    getWorkoutSummaryMock.mockResolvedValue({
      ...baseSummary,
      nextTimePreviews: [
        {
          exerciseId: 'arnold-press',
          exerciseName: 'Arnold Press',
          bestSetLabel: '40 kg × 10',
          status: 'Double: build reps',
          nextTargetLabel: '40 kg × 11',
          reason: 'Double: build reps',
          rule: 'double',
          source: 'template_rule',
          suggestion: {
            label: 'Double: build reps',
            reason: 'Double: build reps',
            weight: 40,
            reps: 11,
            rpe: null,
            unit: 'kg',
            source: 'template_rule',
            rule: 'double',
          },
        },
      ],
    });

    const { getAllByText, getByTestId, getByText, queryByText } = render(<EndWorkoutSummary />);

    await waitFor(() => expect(getByText('Next Time')).toBeTruthy());
    expect(getByTestId('next-time-card-arnold-press')).toBeTruthy();
    expect(getByText('Arnold Press')).toBeTruthy();
    expect(getByText('40 kg × 10')).toBeTruthy();
    expect(getByText('40 kg × 11')).toBeTruthy();
    expect(getAllByText('Double: build reps')).toHaveLength(2);

    fireEvent.press(getByTestId('next-time-toggle'));
    expect(queryByText('40 kg × 11')).toBeNull();

    fireEvent.press(getByTestId('next-time-toggle'));
    expect(getByText('40 kg × 11')).toBeTruthy();
  });

  it('sorts muscles by effective sets and keeps the body map collapsed by default', async () => {
    getWorkoutSummaryMock.mockResolvedValue({
      ...baseSummary,
      muscleSummary: {
        chest: 3,
        lats: 4,
        front_delts: 1.5,
      },
    });

    const { getAllByTestId, getByTestId, getByText, queryByTestId } = render(<EndWorkoutSummary />);

    await waitFor(() => expect(getByText('Muscles Trained')).toBeTruthy());
    expect(queryByTestId('body-map-front')).toBeNull();
    const rows = getAllByTestId(/^muscle-rank-/);
    expect(rows.map((row) => row.props.testID)).toEqual([
      'muscle-rank-lats',
      'muscle-rank-chest',
      'muscle-rank-front_delts',
    ]);
    fireEvent.press(getByTestId('muscle-map-toggle'));
    expect(getByTestId('body-map-front')).toBeTruthy();
    expect(getByTestId('body-map-back')).toBeTruthy();
    expect(getByText('Chest')).toBeTruthy();
    expect(getByText('3')).toBeTruthy();
  });

  it('does not show energy rating boxes on the summary screen', async () => {
    getWorkoutSummaryMock.mockResolvedValue(baseSummary);

    const { queryByText } = render(<EndWorkoutSummary />);

    await waitFor(() => expect(queryByText('Workout Complete')).toBeTruthy());
    expect(queryByText('Energy')).toBeNull();
  });

  it('continues to post-session tags when pressing the top-right Finish action', async () => {
    getWorkoutSummaryMock.mockResolvedValue(baseSummary);

    const { getByTestId, getByText } = render(<EndWorkoutSummary />);

    await waitFor(() => expect(getByText('Workout Complete')).toBeTruthy());
    fireEvent.press(getByTestId('summary-done-btn'));

    expect(mockReplace).toHaveBeenCalledWith('PostSessionTags', { sessionId: 'session-1' });
  });

  it('continues to post-session tags when pressing the bottom Finish Workout action', async () => {
    getWorkoutSummaryMock.mockResolvedValue(baseSummary);

    const { getByTestId, getByText } = render(<EndWorkoutSummary />);

    await waitFor(() => expect(getByText('Workout Complete')).toBeTruthy());
    fireEvent.press(getByTestId('summary-finish-workout-btn'));

    expect(mockReplace).toHaveBeenCalledWith('PostSessionTags', { sessionId: 'session-1' });
  });

  it('guards both finish actions against duplicate navigation', async () => {
    getWorkoutSummaryMock.mockResolvedValue(baseSummary);

    const { getByTestId, getByText } = render(<EndWorkoutSummary />);

    await waitFor(() => expect(getByText('Workout Complete')).toBeTruthy());
    fireEvent.press(getByTestId('summary-done-btn'));
    fireEvent.press(getByTestId('summary-finish-workout-btn'));

    expect(mockReplace).toHaveBeenCalledTimes(1);
  });
});

describe('EndWorkoutSummary helpers', () => {
  it('calculates Best Lift with Epley', () => {
    const bestLift = getBestLift(
      summaryWithSets('Barbell Back Squat', [set({ weight: 120, reps: 5 })]),
    );

    expect(bestLift).toEqual({
      exerciseName: 'Barbell Back Squat',
      weight: 120,
      reps: 5,
      unit: 'kg',
      estimated1RM: 140,
    });
  });

  it('ignores sets over 10 reps for Best Lift', () => {
    const bestLift = getBestLift(
      summaryWithSets('Lat Pulldown', [
        set({ id: 'set-heavy-volume', weight: 200, reps: 11 }),
        set({ id: 'set-eligible', weight: 100, reps: 5 }),
      ]),
    );

    expect(bestLift?.weight).toBe(100);
    expect(bestLift?.reps).toBe(5);
  });

  it('hides Best Lift when there are no eligible sets', () => {
    const bestLift = getBestLift(
      summaryWithSets('Lat Pulldown', [
        set({ reps: 11 }),
        set({ id: 'warmup', weight: 80, reps: 5, set_type: 'warmup', is_warmup: 1 }),
      ]),
    );

    expect(bestLift).toBeNull();
  });

  it('uses Best Lift tie-breakers in order', () => {
    const bestLift = getBestLift(
      summaryWithSets('Tie Lift', [
        set({ id: 'lighter-same-estimate', weight: 90, reps: 10, logged_at: 3 }),
        set({ id: 'heavier-same-estimate', weight: 100, reps: 6, logged_at: 2 }),
        set({ id: 'latest-identical', weight: 100, reps: 6, logged_at: 4 }),
      ]),
    );

    expect(bestLift).toEqual({
      exerciseName: 'Tie Lift',
      weight: 100,
      reps: 6,
      unit: 'kg',
      estimated1RM: 120,
    });
  });

  it('groups PRs by exercise', () => {
    const groups = groupPRsByExercise([
      {
        id: 'pr-1',
        exercise_id: 'bench',
        exercise_name: 'Bench Press',
        session_id: 'session-1',
        set_id: 'set-1',
        record_type: 'rep_max',
        record_key: 'rep_max:5',
        reps: 5,
        weight: 80,
        value: 80,
        unit: 'kg',
        achieved_at: 1,
        created_at: 2,
      },
      {
        id: 'pr-2',
        exercise_id: 'bench',
        exercise_name: 'Bench Press',
        session_id: 'session-1',
        set_id: 'set-1',
        record_type: 'estimated_1rm',
        record_key: 'estimated_1rm',
        reps: 5,
        weight: 80,
        value: 93.333,
        unit: 'kg',
        achieved_at: 1,
        created_at: 2,
      },
    ]);

    expect(groups).toEqual([
      {
        exerciseId: 'bench',
        exerciseName: 'Bench Press',
        rows: [
          { key: 'rep_max', label: 'Rep PR', detail: '80kg x 5' },
          { key: 'estimated_1rm', label: 'Estimated 1RM PR', detail: '93.3kg' },
        ],
      },
    ]);
  });

  it('labels 1-rep max records as Weight PRs when available', () => {
    const groups = groupPRsByExercise([
      {
        id: 'pr-1',
        exercise_id: 'squat',
        exercise_name: 'Back Squat',
        session_id: 'session-1',
        set_id: 'set-1',
        record_type: 'rep_max',
        record_key: 'rep_max:1',
        reps: 1,
        weight: 140,
        value: 140,
        unit: 'kg',
        achieved_at: 1,
        created_at: 2,
      },
    ]);

    expect(groups[0].rows).toEqual([{ key: 'rep_max', label: 'Weight PR', detail: '140kg x 1' }]);
  });
});
