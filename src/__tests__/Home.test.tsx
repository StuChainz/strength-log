import { render, screen, waitFor } from '@testing-library/react-native';
import Home from '@/screens/Home';

// Mock navigation so we don't need a NavigationContainer in tests.
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: jest.fn() }),
}));

// Prevent native SQLite from being called in tests.
jest.mock('@/db/client', () => ({
  openDb: jest.fn().mockResolvedValue({}),
}));

jest.mock('@/db/repositories/exercises.repo', () => ({
  getExerciseCount: jest.fn().mockResolvedValue(35),
}));

describe('Home screen', () => {
  it('renders the "Strength Log" heading', async () => {
    render(<Home />);
    // waitFor flushes pending promises (the async DB count) and wraps in act.
    await waitFor(() => expect(screen.getByText('Strength Log')).toBeTruthy());
  });

  it('shows the exercise count after DB loads', async () => {
    render(<Home />);
    await waitFor(() => expect(screen.getByTestId('exercise-count')).toBeTruthy());
    expect(screen.getByText('35 exercises loaded')).toBeTruthy();
  });
});
