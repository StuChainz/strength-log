import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import TrainingDashboard from '@/screens/TrainingDashboard';
import { getTrainingDashboardData } from '@/db/repositories/trainingDashboard.repo';
import type { TrainingDashboardSession } from '@/domain/trainingDashboard';

const NOW = new Date(2026, 5, 4, 12).getTime();
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockCanGoBack = jest.fn();
const mockDb = {};

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
    canGoBack: mockCanGoBack,
  }),
  useFocusEffect: (cb: () => void) => {
    const ReactActual = jest.requireActual('react') as typeof import('react');
    ReactActual.useEffect(() => cb(), [cb]);
  },
}));

jest.mock('@/db/client', () => ({
  openDb: jest.fn().mockResolvedValue(mockDb),
}));

jest.mock('@/db/repositories/trainingDashboard.repo', () => ({
  getTrainingDashboardData: jest.fn(),
}));

const getTrainingDashboardDataMock = getTrainingDashboardData as jest.MockedFunction<
  typeof getTrainingDashboardData
>;

function session(
  id: string,
  completedAt: number,
  overrides: Partial<TrainingDashboardSession> = {},
): TrainingDashboardSession {
  return {
    id,
    name: `Workout ${id}`,
    templateName: null,
    startedAt: completedAt - 45 * 60_000,
    completedAt,
    durationMin: 45,
    setCount: 5,
    totalVolume: 1000,
    prCount: 0,
    energyRating: null,
    ...overrides,
  };
}

describe('TrainingDashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    mockCanGoBack.mockReturnValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows the empty state when there are no completed workouts', async () => {
    getTrainingDashboardDataMock.mockResolvedValue({ sessions: [] });

    render(<TrainingDashboard />);

    await waitFor(() => expect(screen.getByTestId('training-dashboard-empty')).toBeTruthy());
    expect(
      screen.getByText('No completed workouts yet. Finish a workout and it’ll appear here.'),
    ).toBeTruthy();
  });

  it('shows calendar, current week summary, consistency stats, and recent workouts', async () => {
    getTrainingDashboardDataMock.mockResolvedValue({
      sessions: [
        session('latest', new Date(2026, 5, 4, 10).getTime(), {
          name: null,
          templateName: 'Push A',
          durationMin: 50,
          setCount: 6,
          totalVolume: 2200,
          prCount: 2,
          energyRating: 8,
        }),
        session('previous', new Date(2026, 5, 3, 10).getTime(), {
          durationMin: 40,
          setCount: 4,
          totalVolume: 1300,
          prCount: 1,
          energyRating: 6,
        }),
      ],
    });

    render(<TrainingDashboard />);

    await waitFor(() => expect(screen.getByTestId('training-dashboard-heatmap')).toBeTruthy());
    expect(screen.getByText('Training Calendar')).toBeTruthy();
    expect(screen.getByText('This Week')).toBeTruthy();
    expect(screen.getByText('Consistency')).toBeTruthy();
    expect(screen.getByText('Recent Workouts')).toBeTruthy();
    expect(screen.getAllByText('Push A').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('50m').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('6 sets').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('2,200 kg').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('2 PRs').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Energy 8/10').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('2 days').length).toBeGreaterThanOrEqual(1);
  });

  it('selects a calendar day and opens a selected workout in details', async () => {
    const selectedAt = new Date(2026, 5, 2, 10).getTime();
    getTrainingDashboardDataMock.mockResolvedValue({
      sessions: [
        session('latest', new Date(2026, 5, 4, 10).getTime()),
        session('selected', selectedAt, { name: 'Pull Day' }),
      ],
    });

    render(<TrainingDashboard />);

    await waitFor(() => expect(screen.getByTestId('calendar-day-2026-06-02')).toBeTruthy());
    fireEvent.press(screen.getByTestId('calendar-day-2026-06-02'));

    await waitFor(() => expect(screen.getByTestId('selected-day-workout-selected')).toBeTruthy());
    expect(screen.getAllByText('Pull Day').length).toBeGreaterThanOrEqual(1);

    fireEvent.press(screen.getByTestId('selected-day-workout-selected'));
    expect(mockNavigate).toHaveBeenCalledWith('WorkoutDetails', { sessionId: 'selected' });
  });

  it('opens recent workouts in the existing details view', async () => {
    getTrainingDashboardDataMock.mockResolvedValue({
      sessions: [session('recent', new Date(2026, 5, 4, 10).getTime())],
    });

    render(<TrainingDashboard />);

    await waitFor(() =>
      expect(screen.getByTestId('training-dashboard-workout-recent')).toBeTruthy(),
    );
    fireEvent.press(screen.getByTestId('training-dashboard-workout-recent'));

    expect(mockNavigate).toHaveBeenCalledWith('WorkoutDetails', { sessionId: 'recent' });
  });
});
