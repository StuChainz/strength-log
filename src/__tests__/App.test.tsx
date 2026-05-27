import { render, waitFor } from '@testing-library/react-native';
import App from '../../App';

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
  openDb: jest.fn().mockResolvedValue({}),
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
  it('renders the first screen instead of a blank root', async () => {
    const { getByText } = render(<App />);

    await waitFor(() => expect(getByText('Strength Log')).toBeTruthy());
  });
});
