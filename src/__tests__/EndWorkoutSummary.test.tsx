import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import EndWorkoutSummary from '@/screens/EndWorkoutSummary';
import { getWorkoutSummary } from '@/db/repositories/sessionSummary.repo';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    replace: jest.fn(),
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

const baseSummary = {
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
};

describe('EndWorkoutSummary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows final PRs for the session', async () => {
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

    await waitFor(() => expect(getByText('NEW PRs')).toBeTruthy());
    expect(getByText('Bench Press: 80kg × 5 rep PR')).toBeTruthy();
    expect(getByText('Bench Press: 93.3kg estimated 1RM')).toBeTruthy();
    expect(getByText('Cable Fly: 320kg session volume')).toBeTruthy();
  });

  it('handles sessions with no PRs without crashing', async () => {
    getWorkoutSummaryMock.mockResolvedValue(baseSummary);

    const { getByText } = render(<EndWorkoutSummary />);

    await waitFor(() => expect(getByText('No new PRs')).toBeTruthy());
  });

  it('renders the muscles worked section from summary data', async () => {
    getWorkoutSummaryMock.mockResolvedValue({
      ...baseSummary,
      muscleSummary: {
        chest: 3,
        triceps: 1.5,
        front_delts: 1.5,
      },
    });

    const { getByTestId, getByText } = render(<EndWorkoutSummary />);

    await waitFor(() => expect(getByText('Muscles Worked')).toBeTruthy());
    expect(getByTestId('body-map-front')).toBeTruthy();
    expect(getByTestId('body-map-back')).toBeTruthy();
    expect(getByText('Chest')).toBeTruthy();
    expect(getByText('3')).toBeTruthy();
  });
});
