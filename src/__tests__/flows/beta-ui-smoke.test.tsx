import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Linking } from 'react-native';
import PostSessionTags from '@/screens/PostSessionTags';
import Settings from '@/screens/Settings';
import { openDb } from '@/db/client';
import { getWorkoutSummary } from '@/db/repositories/sessionSummary.repo';
import { getAppSettings } from '@/db/repositories/settings.repo';
import { getSavedTags, savePostSessionDetails } from '@/db/repositories/tags.repo';

const mockPopToTop = jest.fn();
const mockDb = {};

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    popToTop: mockPopToTop,
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
    openDbMock.mockResolvedValue(mockDb as never);
    getAppSettingsMock.mockResolvedValue({
      unit: 'kg',
      weekStartDay: 'monday',
      voiceMode: false,
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

  it('Settings opens the beta feedback issue form', async () => {
    const canOpenURLSpy = jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true);
    const openURLSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);

    const { getByText } = render(<Settings />);

    await waitFor(() => expect(getByText('Beta feedback')).toBeTruthy());
    fireEvent.press(getByText('Beta feedback'));

    await waitFor(() =>
      expect(openURLSpy).toHaveBeenCalledWith(
        expect.stringContaining('https://github.com/StuChainz/strength-log/issues/new'),
      ),
    );

    canOpenURLSpy.mockRestore();
    openURLSpy.mockRestore();
  });
});
