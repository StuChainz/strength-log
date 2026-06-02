import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import WorkoutDetails from '@/screens/WorkoutDetails';
import { getWorkoutSummary } from '@/db/repositories/sessionSummary.repo';

const mockGoBack = jest.fn();
let mockSessionId = 'session-1';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    goBack: mockGoBack,
  }),
  useRoute: () => ({ params: { sessionId: mockSessionId } }),
}));

jest.mock('@/db/client', () => ({
  openDb: jest.fn().mockResolvedValue({}),
}));

jest.mock('@/db/repositories/sessionSummary.repo', () => ({
  getWorkoutSummary: jest.fn(),
}));

const getWorkoutSummaryMock = getWorkoutSummary as jest.MockedFunction<typeof getWorkoutSummary>;

const set = {
  id: 'set-1',
  session_id: 'session-1',
  exercise_id: 'bench',
  exercise_name: 'Bench Press',
  position: 0,
  weight: 80,
  reps: 5,
  rpe: 8,
  unit: 'kg' as const,
  is_warmup: 0 as const,
  set_type: 'working' as const,
  logged_at: 1,
  source: 'tap' as const,
  client_set_id: 'client-set-1',
  deleted_at: null,
};

const baseSummary = {
  session: {
    id: 'session-1',
    template_id: null,
    name: 'Upper Day',
    status: 'completed' as const,
    started_at: new Date('2026-05-26T15:00:00Z').getTime(),
    ended_at: new Date('2026-05-26T15:45:00Z').getTime(),
    total_volume_cached: 400,
    created_at: new Date('2026-05-26T15:00:00Z').getTime(),
    updated_at: new Date('2026-05-26T15:45:00Z').getTime(),
  },
  setCount: 1,
  volume: 400,
  durationMin: 45,
  prCount: 1,
  prs: [
    {
      id: 'pr-1',
      exercise_id: 'bench',
      exercise_name: 'Bench Press',
      session_id: 'session-1',
      set_id: 'set-1',
      record_type: 'rep_max' as const,
      record_key: 'rep_max:5',
      reps: 5,
      weight: 80,
      value: 80,
      unit: 'kg' as const,
      achieved_at: 1,
      created_at: 2,
    },
  ],
  muscleSummary: {},
  exercises: [
    {
      exerciseId: 'bench',
      name: 'Bench Press',
      sets: [set],
      volume: 400,
    },
  ],
  tags: ['felt_strong' as const],
  note: {
    session_id: 'session-1',
    energy_rating: 8,
    note: 'Moved well',
    updated_at: 2,
  },
};

describe('WorkoutDetails', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSessionId = 'session-1';
  });

  it('opens and renders full completed workout details', async () => {
    getWorkoutSummaryMock.mockResolvedValue(baseSummary);

    const { getAllByText, getByText } = render(<WorkoutDetails />);

    await waitFor(() => expect(getByText('Workout Details')).toBeTruthy());
    expect(getByText('Upper Day')).toBeTruthy();
    expect(getByText('45 min')).toBeTruthy();
    expect(getAllByText('400 kg').length).toBeGreaterThanOrEqual(1);
    expect(getByText('Bench Press')).toBeTruthy();
    expect(getByText('80 kg × 5 · RPE 8')).toBeTruthy();
    expect(getByText('Bench Press: 80kg × 5 rep PR')).toBeTruthy();
    expect(getByText('Energy 8/10')).toBeTruthy();
    expect(getByText('felt strong')).toBeTruthy();
    expect(getByText('Moved well')).toBeTruthy();
  });

  it('handles completed workouts with no logged sets safely', async () => {
    getWorkoutSummaryMock.mockResolvedValue({
      ...baseSummary,
      setCount: 0,
      volume: 0,
      prCount: 0,
      prs: [],
      exercises: [],
      tags: [],
      note: null,
    });

    const { getByTestId, getByText } = render(<WorkoutDetails />);

    await waitFor(() => expect(getByText('Exercises')).toBeTruthy());
    expect(getByTestId('workout-details-empty-sets')).toBeTruthy();
    expect(getByText('No logged sets for this workout.')).toBeTruthy();
    expect(getByText('No PRs recorded.')).toBeTruthy();
  });

  it('handles a missing workout safely', async () => {
    getWorkoutSummaryMock.mockResolvedValue(null);

    const { getByText } = render(<WorkoutDetails />);

    await waitFor(() => expect(getByText('Workout not found')).toBeTruthy());
  });
});
