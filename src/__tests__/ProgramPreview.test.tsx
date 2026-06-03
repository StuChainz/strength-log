import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import ProgramPreview from '@/screens/ProgramPreview';
import { LINEAR_5X5 } from '@/programs/presets';
import { importPreset } from '@/programs/importPreset';
import { getNormalTemplatesWithCount } from '@/db/repositories/templates.repo';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

let mockRouteParams: { presetId: string } = { presetId: LINEAR_5X5.id };

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useRoute: () => ({ params: mockRouteParams }),
}));

jest.mock('@/db/client', () => ({ openDb: jest.fn(async () => ({})) }));
jest.mock('@/db/repositories/templates.repo', () => ({
  getNormalTemplatesWithCount: jest.fn(),
}));
jest.mock('@/programs/importPreset', () => {
  const actual = jest.requireActual('@/programs/importPreset');
  return {
    ...actual,
    importPreset: jest.fn(),
  };
});

async function pressAlertButton(label: string) {
  const spy = Alert.alert as unknown as jest.Mock;
  const lastCall = spy.mock.calls[spy.mock.calls.length - 1];
  const buttons = lastCall[2] as { text: string; onPress?: () => void }[] | undefined;
  const btn = buttons?.find((b) => b.text === label);
  await act(async () => {
    btn?.onPress?.();
  });
}

describe('ProgramPreview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouteParams = { presetId: LINEAR_5X5.id };
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    (getNormalTemplatesWithCount as jest.Mock).mockResolvedValue([]);
    (importPreset as jest.Mock).mockResolvedValue({
      presetId: LINEAR_5X5.id,
      templates: LINEAR_5X5.workouts.map((w, i) => ({
        id: `tmpl-${i}`,
        name: w.name,
        notes: w.notes ?? null,
        archived_at: null,
        created_at: 1,
        updated_at: 1,
      })),
    });
  });

  it('renders the preset name and all workouts', () => {
    const { getByText, getByTestId } = render(<ProgramPreview />);
    expect(getByText(LINEAR_5X5.name)).toBeTruthy();
    for (const workout of LINEAR_5X5.workouts) {
      expect(getByTestId(`workout-card-${workout.key}`)).toBeTruthy();
      expect(getByText(workout.name)).toBeTruthy();
    }
  });

  it('renders an exercise scheme line per exercise', () => {
    const { getAllByText } = render(<ProgramPreview />);
    // 5x5 across multiple exercises — at least one row with "5×5" exists.
    expect(getAllByText(/5×5/).length).toBeGreaterThan(0);
  });

  it('calls importPreset when "Use this program" is pressed and no collisions', async () => {
    const { getByTestId } = render(<ProgramPreview />);
    fireEvent.press(getByTestId('program-preview-import'));

    await waitFor(() => expect(importPreset).toHaveBeenCalledTimes(1));
    const [, presetArg] = (importPreset as jest.Mock).mock.calls[0];
    expect(presetArg.id).toBe(LINEAR_5X5.id);
  });

  it('shows duplicate-warning alert when a workout name already exists, and only imports on confirm', async () => {
    (getNormalTemplatesWithCount as jest.Mock).mockResolvedValue([
      {
        id: 'pre-existing',
        name: LINEAR_5X5.workouts[0]!.name,
        notes: null,
        archived_at: null,
        created_at: 1,
        updated_at: 1,
        item_count: 3,
      },
    ]);

    const { getByTestId } = render(<ProgramPreview />);
    fireEvent.press(getByTestId('program-preview-import'));

    await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
    const lastCall = (Alert.alert as unknown as jest.Mock).mock.calls.at(-1);
    expect(lastCall?.[0]).toBe('Already imported?');
    expect(importPreset).not.toHaveBeenCalled();

    await pressAlertButton('Import anyway');
    await waitFor(() => expect(importPreset).toHaveBeenCalledTimes(1));
  });

  it('does not call importPreset when user cancels duplicate alert', async () => {
    (getNormalTemplatesWithCount as jest.Mock).mockResolvedValue([
      {
        id: 'pre-existing',
        name: LINEAR_5X5.workouts[0]!.name,
        notes: null,
        archived_at: null,
        created_at: 1,
        updated_at: 1,
        item_count: 3,
      },
    ]);

    const { getByTestId } = render(<ProgramPreview />);
    fireEvent.press(getByTestId('program-preview-import'));

    await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
    await pressAlertButton('Cancel');
    // Allow microtasks to flush.
    await new Promise((r) => setTimeout(r, 0));
    expect(importPreset).not.toHaveBeenCalled();
  });

  it('renders a not-found state for an unknown presetId', () => {
    mockRouteParams = { presetId: 'does-not-exist' };
    const { getByText } = render(<ProgramPreview />);
    expect(getByText('Preset not found')).toBeTruthy();
  });
});
