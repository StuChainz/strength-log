import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import PostSessionTags from '@/screens/PostSessionTags';
import Settings from '@/screens/Settings';
import { openDb } from '@/db/client';
import { getWorkoutSummary } from '@/db/repositories/sessionSummary.repo';
import { getAppSettings } from '@/db/repositories/settings.repo';
import { getSavedTags, savePostSessionDetails } from '@/db/repositories/tags.repo';

const mockPopToTop = jest.fn();
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockDb = {
  getAllAsync: jest.fn(),
  getFirstAsync: jest.fn(),
};

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    popToTop: mockPopToTop,
    navigate: mockNavigate,
    goBack: mockGoBack,
  }),
  useRoute: () => ({ params: { sessionId: 'session-1' } }),
}));

jest.mock('@/db/client', () => ({
  openDb: jest.fn().mockResolvedValue(mockDb),
}));

jest.mock('@/db/repositories/sessionSummary.repo', () => ({
  getWorkoutSummary: jest.fn(),
}));

jest.mock('@/db/repositories/settings.repo', () => ({
  getAppSettings: jest.fn(),
  setAppSetting: jest.fn(),
}));

jest.mock('@/db/repositories/tags.repo', () => ({
  getSavedTags: jest.fn(),
  savePostSessionDetails: jest.fn(),
  SESSION_TAGS: [
    'sleep_short',
    'sleep_long',
    'stressed',
    'sore',
    'fasted',
    'caffeinated',
    'ill',
    'traveled',
    'alcohol_prev_night',
    'evening_session',
    'morning_session',
    'felt_strong',
    'felt_weak',
  ],
}));

const openDbMock = openDb as jest.MockedFunction<typeof openDb>;
const getWorkoutSummaryMock = getWorkoutSummary as jest.MockedFunction<typeof getWorkoutSummary>;
const getAppSettingsMock = getAppSettings as jest.MockedFunction<typeof getAppSettings>;
const getSavedTagsMock = getSavedTags as jest.MockedFunction<typeof getSavedTags>;
const savePostSessionDetailsMock = savePostSessionDetails as jest.MockedFunction<
  typeof savePostSessionDetails
>;

describe('beta UI smoke tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.getAllAsync.mockResolvedValue([]);
    mockDb.getFirstAsync.mockImplementation((sql: string) => {
      const normalized = sql.replace(/\s+/g, ' ');
      if (normalized.includes("WHERE status = 'completed' ORDER BY ended_at DESC")) {
        return Promise.resolve({ id: 'session-1' });
      }
      return Promise.resolve({ value: 0 });
    });
    openDbMock.mockResolvedValue(mockDb as never);
    getAppSettingsMock.mockResolvedValue({
      unit: 'kg',
      weekStartDay: 'monday',
      voiceMode: false,
      onboardingCompleted: true,
    });
    getSavedTagsMock.mockResolvedValue([]);
    getWorkoutSummaryMock.mockResolvedValue({
      session: {
        id: 'session-1',
        template_id: null,
        name: null,
        status: 'completed',
        started_at: new Date('2026-05-26T15:00:00Z').getTime(),
        ended_at: new Date('2026-05-26T15:45:00Z').getTime(),
        total_volume_cached: 1200,
        created_at: new Date('2026-05-26T15:00:00Z').getTime(),
        updated_at: new Date('2026-05-26T15:45:00Z').getTime(),
      },
      setCount: 6,
      volume: 1200,
      durationMin: 45,
      prCount: 0,
      prs: [],
      muscleSummary: {},
      exercises: [],
      tags: [],
      note: null,
    });
    savePostSessionDetailsMock.mockResolvedValue(undefined);
  });

  it('PostSessionTags saves selected tags, energy, and trimmed note', async () => {
    const { getByPlaceholderText, getByText } = render(<PostSessionTags />);

    await waitFor(() => expect(getByText('How did it go?')).toBeTruthy());

    fireEvent.press(getByText('Felt strong'));
    fireEvent.press(getByText('7'));
    fireEvent.changeText(getByPlaceholderText('Optional'), '  Beta felt smooth  ');
    fireEvent.press(getByText('Save'));

    await waitFor(() =>
      expect(savePostSessionDetailsMock).toHaveBeenCalledWith(mockDb, {
        sessionId: 'session-1',
        tags: ['felt_strong'],
        energyRating: 7,
        note: 'Beta felt smooth',
        metrics: {
          volume: 1200,
          durationMin: 45,
          setCount: 6,
          sampledAt: new Date('2026-05-26T15:45:00Z').getTime(),
        },
      }),
    );
    expect(mockPopToTop).toHaveBeenCalledTimes(1);
  });

  it('Settings shares a local feedback payload', async () => {
    const shareSpy = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: Share.sharedAction });
    const setStringAsyncMock = Clipboard.setStringAsync as jest.MockedFunction<
      typeof Clipboard.setStringAsync
    >;
    setStringAsyncMock.mockClear();

    const { getByTestId, getByText } = render(<Settings />);

    await waitFor(() => expect(getByText('Send Feedback')).toBeTruthy());
    fireEvent.press(getByText('Send Feedback'));
    await waitFor(() => expect(getByTestId('feedback-modal')).toBeTruthy());
    fireEvent.press(getByTestId('feedback-type-suggestion'));
    fireEvent.changeText(getByTestId('feedback-message-input'), '  Make timers louder  ');
    fireEvent.press(getByTestId('feedback-submit-btn'));

    await waitFor(() => expect(setStringAsyncMock).toHaveBeenCalledTimes(1));
    const json = setStringAsyncMock.mock.calls[0][0];
    expect(JSON.parse(json)).toMatchObject({
      feedbackType: 'Suggestion',
      message: 'Make timers louder',
      context: { currentRoute: 'Settings', source: 'settings' },
      workout: { lastCompletedWorkoutId: 'session-1' },
    });
    expect(shareSpy).toHaveBeenCalledWith({
      title: 'Set feedback',
      message: json,
    });

    shareSpy.mockRestore();
  });

  it('Settings can reopen onboarding', async () => {
    const { getByText, queryByText } = render(<Settings />);

    await waitFor(() => expect(getByText('View Onboarding')).toBeTruthy());
    expect(queryByText('Voice mode')).toBeNull();
    expect(queryByText('Typed parser only; real ASR stays off.')).toBeNull();

    fireEvent.press(getByText('View Onboarding'));

    expect(mockNavigate).toHaveBeenCalledWith('Onboarding', { mode: 'revisit' });
  });

  it('Settings opens the Issues area', async () => {
    const { getByText } = render(<Settings />);

    await waitFor(() => expect(getByText('Issues')).toBeTruthy());
    fireEvent.press(getByText('Issues'));

    expect(mockNavigate).toHaveBeenCalledWith('Issues');
  });

  it('Settings has a working back action', async () => {
    const { getByTestId } = render(<Settings />);

    await waitFor(() => expect(getByTestId('settings-back-btn')).toBeTruthy());
    fireEvent.press(getByTestId('settings-back-btn'));

    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });
});
