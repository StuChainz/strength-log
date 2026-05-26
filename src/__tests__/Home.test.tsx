import { render, screen, waitFor } from '@testing-library/react-native';
import Home from '@/screens/Home';

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: jest.fn() }),
  useFocusEffect: (cb: () => void) => {
    cb();
  },
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
  getInProgressSession: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/db/repositories/tags.repo', () => ({
  getUntaggedCompletedSession: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/db/repositories/insights.repo', () => ({
  maybeGenerateWeeklyInsight: jest.fn().mockResolvedValue(null),
}));

describe('Home screen', () => {
  it('renders the "Strength Log" heading', async () => {
    render(<Home />);
    await waitFor(() => expect(screen.getByText('Strength Log')).toBeTruthy());
  });

  it('renders the hero start button', async () => {
    render(<Home />);
    await waitFor(() => expect(screen.getByTestId('start-workout-btn')).toBeTruthy());
  });
});
