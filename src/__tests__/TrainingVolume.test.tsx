import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import TrainingVolume from '@/screens/TrainingVolume';
import { getTrainingVolumeReport } from '@/db/repositories/trainingVolume.repo';

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
let mockCanGoBack = true;

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    canGoBack: () => mockCanGoBack,
    goBack: mockGoBack,
    navigate: mockNavigate,
  }),
  useFocusEffect: (effect: () => void | (() => void)) => {
    const ReactActual = jest.requireActual('react') as typeof import('react');
    ReactActual.useEffect(() => effect(), [effect]);
  },
}));

jest.mock('@/db/client', () => ({
  openDb: jest.fn().mockResolvedValue({}),
}));

jest.mock('@/db/repositories/trainingVolume.repo', () => ({
  ...jest.requireActual('@/db/repositories/trainingVolume.repo'),
  getTrainingVolumeReport: jest.fn(),
}));

const getTrainingVolumeReportMock = getTrainingVolumeReport as jest.MockedFunction<
  typeof getTrainingVolumeReport
>;

describe('TrainingVolume', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCanGoBack = true;
  });

  it('has a visible back action that returns to the previous screen', async () => {
    getTrainingVolumeReportMock.mockResolvedValue({
      window: {
        id: '7d',
        title: 'Training Volume (Last 7 Days)',
        label: '7D',
        days: 7,
        startAt: 1,
        endAt: 2,
      },
      muscles: [],
    });

    const { getByTestId, getByText } = render(<TrainingVolume />);

    await waitFor(() => expect(getByText('Training Volume (Last 7 Days)')).toBeTruthy());
    fireEvent.press(getByTestId('training-volume-back-btn'));

    expect(mockGoBack).toHaveBeenCalledTimes(1);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('falls back to the main app when opened without stack history', async () => {
    mockCanGoBack = false;
    getTrainingVolumeReportMock.mockResolvedValue({
      window: {
        id: '7d',
        title: 'Training Volume (Last 7 Days)',
        label: '7D',
        days: 7,
        startAt: 1,
        endAt: 2,
      },
      muscles: [],
    });

    const { getByTestId, getByText } = render(<TrainingVolume />);

    await waitFor(() => expect(getByText('Training Volume (Last 7 Days)')).toBeTruthy());
    fireEvent.press(getByTestId('training-volume-back-btn'));

    expect(mockNavigate).toHaveBeenCalledWith('Main', { screen: 'Home' });
  });

  it('shows expandable direct and indirect exercise breakdowns', async () => {
    getTrainingVolumeReportMock.mockResolvedValue({
      window: {
        id: '7d',
        title: 'Training Volume (Last 7 Days)',
        label: '7D',
        days: 7,
        startAt: 1,
        endAt: 2,
      },
      muscles: [
        {
          muscle: 'triceps',
          totalExposure: 16,
          directSets: 8,
          indirectSets: 8,
          directSources: [
            { exercise_id: 'skull-crusher', exercise_name: 'Skull Crusher', sets: 3 },
            { exercise_id: 'pushdown', exercise_name: 'Pushdown', sets: 3 },
            { exercise_id: 'overhead-ext', exercise_name: 'Overhead Ext', sets: 2 },
          ],
          indirectSources: [
            { exercise_id: 'bench', exercise_name: 'Bench Press', sets: 3 },
            { exercise_id: 'incline-db', exercise_name: 'Incline DB Press', sets: 3 },
            { exercise_id: 'dips', exercise_name: 'Dips', sets: 2 },
          ],
        },
      ],
    });

    const { getByTestId, getByText, queryByText } = render(<TrainingVolume />);

    await waitFor(() => expect(getByText('Triceps')).toBeTruthy());
    expect(queryByText('Skull Crusher')).toBeNull();

    fireEvent.press(getByTestId('training-volume-toggle-triceps'));

    expect(getByText('Total Exposure')).toBeTruthy();
    expect(getByText('Direct Sets')).toBeTruthy();
    expect(getByText('Indirect Sets')).toBeTruthy();
    expect(getByText('Direct Sources')).toBeTruthy();
    expect(getByText('Indirect Sources')).toBeTruthy();
    expect(getByText('Skull Crusher')).toBeTruthy();
    expect(getByText('Pushdown')).toBeTruthy();
    expect(getByText('Overhead Ext')).toBeTruthy();
    expect(getByText('Bench Press')).toBeTruthy();
    expect(getByText('Incline DB Press')).toBeTruthy();
    expect(getByText('Dips')).toBeTruthy();
  });

  it('handles empty history safely', async () => {
    getTrainingVolumeReportMock.mockResolvedValue({
      window: {
        id: '7d',
        title: 'Training Volume (Last 7 Days)',
        label: '7D',
        days: 7,
        startAt: 1,
        endAt: 2,
      },
      muscles: [],
    });

    const { getByText } = render(<TrainingVolume />);

    await waitFor(() =>
      expect(getByText('No completed working sets in the last 7 days.')).toBeTruthy(),
    );
  });

  it('reloads the report for 14, 30, and 90 day windows', async () => {
    getTrainingVolumeReportMock.mockResolvedValue({
      window: {
        id: '7d',
        title: 'Training Volume (Last 7 Days)',
        label: '7D',
        days: 7,
        startAt: 1,
        endAt: 2,
      },
      muscles: [],
    });

    const { getByTestId, getByText } = render(<TrainingVolume />);

    await waitFor(() => expect(getByText('Training Volume (Last 7 Days)')).toBeTruthy());

    fireEvent.press(getByTestId('training-volume-window-14d'));
    fireEvent.press(getByTestId('training-volume-window-30d'));
    fireEvent.press(getByTestId('training-volume-window-90d'));

    await waitFor(() => expect(getTrainingVolumeReportMock).toHaveBeenCalledTimes(4));
    expect(getTrainingVolumeReportMock.mock.calls[1]?.[1]?.window).toMatchObject({
      id: '14d',
      days: 14,
    });
    expect(getTrainingVolumeReportMock.mock.calls[2]?.[1]?.window).toMatchObject({
      id: '30d',
      days: 30,
    });
    expect(getTrainingVolumeReportMock.mock.calls[3]?.[1]?.window).toMatchObject({
      id: '90d',
      days: 90,
    });
  });
});
