import { render, screen, waitFor } from '@testing-library/react-native';
import Home from '@/screens/Home';
import { getSessionRecovery } from '@/db/repositories/sessions.repo';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: jest.fn() }),
  useFocusEffect: (cb: () => void) => { cb(); },
}));

jest.mock('@/db/client', () => ({
  openDb: jest.fn().mockResolvedValue({
    getAllAsync: jest.fn().mockResolvedValue([]),
  }),
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

describe('Home screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    const older = { ...newest, id: 'session-old', started_at: 100, created_at: 100, updated_at: 100 };
    getSessionRecoveryMock.mockResolvedValue({
      status: 'multiple_active',
      session: newest,
      sessions: [newest, older],
    });

    render(<Home />);

    await waitFor(() => expect(screen.getByText('MULTIPLE ACTIVE WORKOUTS')).toBeTruthy());
    expect(screen.getByText('2 workouts need attention')).toBeTruthy();
  });
});
