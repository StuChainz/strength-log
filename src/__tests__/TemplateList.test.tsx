import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import TemplateList, { getTemplateSections } from '@/screens/TemplateList';
import {
  archiveTemplate,
  getActiveProgramPresetId,
  getNormalTemplatesWithCount,
  setActiveProgramForTemplates,
} from '@/db/repositories/templates.repo';

const mockNavigate = jest.fn();
const mockSetOptions = jest.fn();
const mockUseFocusEffect = jest.fn((cb: () => (() => void) | void) => {
  cb();
});

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate,
    setOptions: mockSetOptions,
  }),
  useFocusEffect: (cb: Parameters<typeof mockUseFocusEffect>[0]) => mockUseFocusEffect(cb),
}));

jest.mock('@/db/client', () => ({ openDb: jest.fn().mockResolvedValue({ __db: true }) }));
jest.mock('@/db/repositories/templates.repo', () => ({
  archiveTemplate: jest.fn().mockResolvedValue(undefined),
  getActiveProgramPresetId: jest.fn(),
  getNormalTemplatesWithCount: jest.fn(),
  setActiveProgramForTemplates: jest.fn().mockResolvedValue(undefined),
}));

const mockTemplates = [
  {
    id: 'tmpl-1',
    name: 'Push A',
    notes: null,
    archived_at: null,
    created_at: 1000,
    updated_at: 1000,
    item_count: 3,
    working_set_count: 9,
  },
  {
    id: 'tmpl-2',
    name: 'Pull B',
    notes: 'Focus on rows',
    archived_at: null,
    created_at: 2000,
    updated_at: 2000,
    item_count: 1,
    working_set_count: 4,
  },
  {
    id: 'tmpl-3',
    name: 'Legs',
    notes: null,
    archived_at: null,
    created_at: 3000,
    updated_at: 3000,
    item_count: 0,
    working_set_count: 0,
  },
];

describe('TemplateList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseFocusEffect.mockImplementation((cb) => {
      cb();
    });
    (getNormalTemplatesWithCount as jest.Mock).mockResolvedValue(mockTemplates);
    (getActiveProgramPresetId as jest.Mock).mockResolvedValue(null);
    (archiveTemplate as jest.Mock).mockResolvedValue(undefined);
    (setActiveProgramForTemplates as jest.Mock).mockResolvedValue(undefined);
  });

  it('renders templates after load', async () => {
    const { getByTestId, getByText } = render(<TemplateList />);
    await waitFor(() => {
      expect(getByTestId('template-row-tmpl-1')).toBeTruthy();
      expect(getByTestId('template-row-tmpl-2')).toBeTruthy();
    });
    expect(getByText('Push A')).toBeTruthy();
    expect(getByText('Pull B')).toBeTruthy();
  });

  it('does not render archived templates in the normal list', async () => {
    (getNormalTemplatesWithCount as jest.Mock).mockResolvedValue([
      ...mockTemplates,
      {
        id: 'archived-template',
        name: 'Old Test Copy',
        notes: null,
        archived_at: 1234,
        created_at: 1000,
        updated_at: 1000,
        item_count: 2,
        working_set_count: 6,
      },
    ]);

    const { getByTestId, queryByText } = render(<TemplateList />);

    await waitFor(() => expect(getByTestId('template-row-tmpl-1')).toBeTruthy());
    expect(queryByText('Old Test Copy')).toBeNull();
  });

  it('shows correct exercise count labels', async () => {
    const { getByText } = render(<TemplateList />);
    await waitFor(() => expect(getByText('Push A')).toBeTruthy());
    expect(getByText('3 exercises · 9 sets')).toBeTruthy();
    expect(getByText('1 exercise · 4 sets')).toBeTruthy();
    expect(getByText('No exercises')).toBeTruthy();
  });

  it('shows empty state when no templates', async () => {
    (getNormalTemplatesWithCount as jest.Mock).mockResolvedValue([]);
    const { getByText } = render(<TemplateList />);
    await waitFor(() => {
      expect(getByText('No templates yet')).toBeTruthy();
    });
  });

  it('navigates to TemplateBuilder (edit) when the row name is pressed', async () => {
    const { getByText } = render(<TemplateList />);
    await waitFor(() => expect(getByText('Push A')).toBeTruthy());

    fireEvent.press(getByText('Push A'));

    expect(mockNavigate).toHaveBeenCalledWith('TemplateBuilder', { templateId: 'tmpl-1' });
  });

  it('navigates to LiveWorkout when Start is pressed', async () => {
    const { getByTestId } = render(<TemplateList />);
    await waitFor(() => expect(getByTestId('start-template-tmpl-1')).toBeTruthy());

    fireEvent.press(getByTestId('start-template-tmpl-1'));

    expect(mockNavigate).toHaveBeenCalledWith('LiveWorkout', { templateId: 'tmpl-1' });
  });

  it('shows confirmation before removing a template from the list', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { getByTestId } = render(<TemplateList />);
    await waitFor(() => expect(getByTestId('template-actions-tmpl-1')).toBeTruthy());

    fireEvent.press(getByTestId('template-actions-tmpl-1'));
    fireEvent.press(getByTestId('archive-template-tmpl-1'));

    expect(alertSpy).toHaveBeenCalledWith(
      'Remove template?',
      'This hides the template from your list. Completed workouts stay in your history.',
      expect.arrayContaining([
        expect.objectContaining({ text: 'Cancel' }),
        expect.objectContaining({ text: 'Remove' }),
      ]),
    );
    expect(archiveTemplate).not.toHaveBeenCalled();

    alertSpy.mockRestore();
  });

  it('hides a template after confirming remove from list', async () => {
    let visibleTemplates = [...mockTemplates];
    (getNormalTemplatesWithCount as jest.Mock).mockImplementation(() =>
      Promise.resolve(visibleTemplates),
    );
    (archiveTemplate as jest.Mock).mockImplementation(async (_db, templateId: string) => {
      visibleTemplates = visibleTemplates.filter((template) => template.id !== templateId);
    });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    const { getByTestId, queryByTestId } = render(<TemplateList />);
    await waitFor(() => expect(getByTestId('template-row-tmpl-1')).toBeTruthy());

    fireEvent.press(getByTestId('template-actions-tmpl-1'));
    fireEvent.press(getByTestId('archive-template-tmpl-1'));

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    const buttons = alertSpy.mock.calls.at(-1)?.[2];
    const removeBtn = buttons?.find((button) => button.text === 'Remove');
    removeBtn?.onPress?.();

    await waitFor(() => expect(archiveTemplate).toHaveBeenCalled());
    await waitFor(() => expect(queryByTestId('template-row-tmpl-1')).toBeNull());
    expect(archiveTemplate).toHaveBeenCalledWith(expect.objectContaining({ __db: true }), 'tmpl-1');

    alertSpy.mockRestore();
  });

  it('navigates to TemplateBuilder (new) when "+ New" is pressed', async () => {
    const { getByTestId } = render(<TemplateList />);
    await waitFor(() => expect(getByTestId('template-row-tmpl-1')).toBeTruthy());

    fireEvent.press(getByTestId('add-template-btn'));

    expect(mockNavigate).toHaveBeenCalledWith('TemplateBuilder', {});
  });

  it('navigates to ProgramLibrary when "Browse programmes" is pressed', async () => {
    const { getByTestId } = render(<TemplateList />);
    await waitFor(() => expect(getByTestId('browse-presets-btn')).toBeTruthy());

    fireEvent.press(getByTestId('browse-presets-btn'));

    expect(mockNavigate).toHaveBeenCalledWith('ProgramLibrary');
  });

  it('navigates to Issues from the visible shortcut', async () => {
    const { getByTestId } = render(<TemplateList />);
    await waitFor(() => expect(getByTestId('browse-injuries-btn')).toBeTruthy());

    fireEvent.press(getByTestId('browse-injuries-btn'));

    expect(mockNavigate).toHaveBeenCalledWith('Issues');
  });

  it('groups preset templates by program and leaves unmatched templates custom', async () => {
    (getNormalTemplatesWithCount as jest.Mock).mockResolvedValue([
      {
        id: 'phul-upper',
        name: 'Upper Power',
        notes: null,
        archived_at: null,
        created_at: 1000,
        updated_at: 1000,
        item_count: 6,
        working_set_count: 18,
      },
      {
        id: 'gzclp-a',
        name: 'Day A — Squat / Bench / Lat Pulldown',
        notes: null,
        archived_at: null,
        created_at: 2000,
        updated_at: 2000,
        item_count: 3,
        working_set_count: 11,
      },
      {
        id: 'custom',
        name: 'Hotel Upper',
        notes: null,
        archived_at: null,
        created_at: 3000,
        updated_at: 3000,
        item_count: 4,
        working_set_count: 12,
      },
    ]);

    const { getByTestId, getByText } = render(<TemplateList />);

    await waitFor(() => expect(getByTestId('template-program-sections')).toBeTruthy());
    expect(getByTestId('template-program-section-gzclp').props.children).toBe('GZCLP');
    expect(getByTestId('template-program-section-phul').props.children).toBe('PHUL');
    expect(getByText('11 sets/wk')).toBeTruthy();
    expect(getByText('18 sets/wk')).toBeTruthy();
    expect(getByText('CUSTOM TEMPLATES · 1')).toBeTruthy();
    expect(getByText('Hotel Upper')).toBeTruthy();
  });

  it('marks one programme as active', async () => {
    (getNormalTemplatesWithCount as jest.Mock).mockResolvedValue([
      {
        id: 'phul-upper',
        name: 'Upper Power',
        notes: null,
        program_preset_id: 'phul',
        archived_at: null,
        created_at: 1000,
        updated_at: 1000,
        item_count: 6,
        working_set_count: 18,
      },
      {
        id: 'phul-lower',
        name: 'Lower Power',
        notes: null,
        program_preset_id: 'phul',
        archived_at: null,
        created_at: 1000,
        updated_at: 1000,
        item_count: 6,
        working_set_count: 18,
      },
    ]);

    const { getByTestId } = render(<TemplateList />);

    await waitFor(() => expect(getByTestId('set-active-program-phul')).toBeTruthy());
    fireEvent.press(getByTestId('set-active-program-phul'));

    await waitFor(() =>
      expect(setActiveProgramForTemplates).toHaveBeenCalledWith(
        expect.objectContaining({ __db: true }),
        'phul',
        ['phul-upper', 'phul-lower'],
      ),
    );
  });

  it('shows the active programme badge', async () => {
    (getActiveProgramPresetId as jest.Mock).mockResolvedValue('phul');
    (getNormalTemplatesWithCount as jest.Mock).mockResolvedValue([
      {
        id: 'phul-upper',
        name: 'Upper Power',
        notes: null,
        program_preset_id: 'phul',
        archived_at: null,
        created_at: 1000,
        updated_at: 1000,
        item_count: 6,
        working_set_count: 18,
      },
    ]);

    const { getByTestId, getByText } = render(<TemplateList />);

    await waitFor(() => expect(getByTestId('active-program-phul')).toBeTruthy());
    expect(getByText('Active programme')).toBeTruthy();
  });

  it('builds deterministic template groups from existing preset workout names', () => {
    const sections = getTemplateSections([
      {
        id: 'a',
        name: 'Workout A',
        notes: null,
        archived_at: null,
        created_at: 1000,
        updated_at: 1000,
        item_count: 3,
        working_set_count: 15,
      },
      {
        id: 'custom',
        name: 'My Friday Lift',
        notes: null,
        archived_at: null,
        created_at: 2000,
        updated_at: 2000,
        item_count: 2,
        working_set_count: 6,
      },
    ]);

    expect(sections.programs).toEqual([
      expect.objectContaining({
        id: 'linear-5x5',
        title: '5x5 Linear Strength',
        templates: [expect.objectContaining({ id: 'a' })],
      }),
    ]);
    expect(sections.custom).toEqual([expect.objectContaining({ id: 'custom' })]);
  });

  it('reloads on focus', async () => {
    render(<TemplateList />);
    await waitFor(() => expect(getNormalTemplatesWithCount).toHaveBeenCalled());

    const callsBefore = (getNormalTemplatesWithCount as jest.Mock).mock.calls.length;

    const cb = mockUseFocusEffect.mock.calls[0][0];
    cb();

    await waitFor(() =>
      expect((getNormalTemplatesWithCount as jest.Mock).mock.calls.length).toBeGreaterThan(
        callsBefore,
      ),
    );
  });
});
