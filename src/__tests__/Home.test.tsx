import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import Home from '@/screens/Home';
import { openDb } from '@/db/client';
import { getSessionRecovery } from '@/db/repositories/sessions.repo';

const mockNavigate = jest.fn();
const mockDb = {
  getAllAsync: jest.fn().mockResolvedValue([]),
};

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate }),
  useFocusEffect: (cb: () => void) => {
    cb();
  },
}));

jest.mock('@/db/client', () => ({
  openDb: jest.fn().mockResolvedValue(mockDb),
}));

jest.mock('@/db/repositories/templates.repo', () => ({
  getAllTemplatesWithCount: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/db/repositories/sessions.repo', () => ({
  getSessionRecovery: jest.fn().mockResolvedValue({ status: 'none', sessions: [] }),
}));

jest.mock('@/db/repositories/tags.repo', () => ({
  getUntaggedCompletedSession: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/db/repositories/insights.repo', () => ({
  maybeGenerateWeeklyInsight: jest.fn().mockResolvedValue(null),
}));

const getSessionRecoveryMock = getSessionRecovery as jest.MockedFunction<typeof getSessionRecovery>;
const openDbMock = openDb as jest.MockedFunction<typeof openDb>;

describe('Home screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    openDbMock.mockResolvedValue(mockDb as never);
    mockDb.getAllAsync.mockResolvedValue([]);
    getSessionRecoveryMock.mockResolvedValue({ status: 'none', sessions: [] });
  });

  it('renders the "Strength Log" heading', async () => {
    render(<Home />);
    await waitFor(() => expect(screen.getByText('Strength Log')).toBeTruthy());
  });

  it('renders the hero start button', async () => {
    render(<Home />);
    await waitFor(() => expect(screen.getByTestId('start-workout-btn')).toBeTruthy());
  });

  it('surfaces multiple active workouts without discarding them', async () => {
    const newest = {
      id: 'session-new',
      template_id: null,
      name: null,
      status: 'in_progress' as const,
      started_at: 200,
      ended_at: null,
      total_volume_cached: null,
      created_at: 200,
      updated_at: 200,
    };
    const older = {
      ...newest,
      id: 'session-old',
      started_at: 100,
      created_at: 100,
      updated_at: 100,
    };
    getSessionRecoveryMock.mockResolvedValue({
      status: 'multiple_active',
      session: newest,
      sessions: [newest, older],
    });

    render(<Home />);

    await waitFor(() => expect(screen.getByText('MULTIPLE ACTIVE WORKOUTS')).toBeTruthy());
    expect(screen.getByText('2 workouts need attention')).toBeTruthy();
  });

  it('renders recent workouts as pressable rows that open details', async () => {
    mockDb.getAllAsync.mockResolvedValue([
      {
        id: 'session-1',
        name: 'Upper Day',
        started_at: Date.now(),
        ended_at: Date.now() + 45 * 60_000,
        total_volume_cached: 1500,
      },
    ]);

    render(<Home />);

    await waitFor(() => expect(screen.getByTestId('recent-workout-session-1')).toBeTruthy());
    expect(screen.getByText('Upper Day')).toBeTruthy();
    expect(screen.getAllByText(/1,500 kg/).length).toBeGreaterThanOrEqual(1);

    fireEvent.press(screen.getByTestId('recent-workout-session-1'));

    expect(mockNavigate).toHaveBeenCalledWith('WorkoutDetails', { sessionId: 'session-1' });
  });
});
