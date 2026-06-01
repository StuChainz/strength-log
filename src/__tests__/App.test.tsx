import { fireEvent, render, waitFor } from '@testing-library/react-native';
import App from '../../App';
import { openDb } from '@/db/client';

jest.mock('react-native-safe-area-context', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  const frame = { x: 0, y: 0, width: 390, height: 844 };

  return {
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
    SafeAreaView: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
    SafeAreaInsetsContext: React.createContext(insets),
    SafeAreaFrameContext: React.createContext(frame),
    initialWindowMetrics: { insets, frame },
    useSafeAreaInsets: () => insets,
    useSafeAreaFrame: () => frame,
  };
});

jest.mock('@/db/client', () => ({
  openDb: jest.fn(),
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
  getAllInsightCards: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/db/repositories/exercises.repo', () => ({
  getExerciseLibraryDiagnostics: jest.fn().mockResolvedValue(null),
  getExercisesWithMetadata: jest.fn().mockResolvedValue([]),
}));

describe('App startup', () => {
  const openDbMock = openDb as jest.MockedFunction<typeof openDb>;
  const mockDb = {} as Awaited<ReturnType<typeof openDb>>;

  beforeEach(() => {
    jest.clearAllMocks();
    openDbMock.mockReset();
    openDbMock.mockResolvedValue(mockDb);
  });

  it('renders the first screen instead of a blank root', async () => {
    const { getByText } = render(<App />);

    await waitFor(() => expect(getByText('Strength Log')).toBeTruthy());
  });

  it('does not render navigation until database startup completes', async () => {
    let resolveOpenDb: (value: Awaited<ReturnType<typeof openDb>>) => void = () => {};
    openDbMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOpenDb = resolve;
      }),
    );

    const { getByText, queryByText } = render(<App />);

    expect(getByText('Starting Set')).toBeTruthy();
    expect(queryByText('Strength Log')).toBeNull();

    resolveOpenDb(mockDb);

    await waitFor(() => expect(getByText('Strength Log')).toBeTruthy());
  });

  it('shows a retry state when database startup fails', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    openDbMock.mockRejectedValueOnce(new Error('migration failed')).mockResolvedValueOnce(mockDb);

    try {
      const { getByText } = render(<App />);

      await waitFor(() => expect(getByText('Set could not start')).toBeTruthy());
      expect(openDbMock).toHaveBeenCalledTimes(1);
      fireEvent.press(getByText('Try Again'));

      await waitFor(() => expect(getByText('Strength Log')).toBeTruthy());
      expect(openDbMock.mock.results[0]?.type).toBe('return');
      expect(openDbMock.mock.results[1]?.type).toBe('return');
    } finally {
      consoleError.mockRestore();
    }
  });
});
