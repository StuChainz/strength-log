import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import TemplateList, { getTemplateSections } from '@/screens/TemplateList';
import { getAllTemplatesWithCount } from '@/db/repositories/templates.repo';

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

jest.mock('@/db/client', () => ({ openDb: jest.fn() }));
jest.mock('@/db/repositories/templates.repo', () => ({
  getAllTemplatesWithCount: jest.fn(),
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
  },
  {
    id: 'tmpl-2',
    name: 'Pull B',
    notes: 'Focus on rows',
    archived_at: null,
    created_at: 2000,
    updated_at: 2000,
    item_count: 1,
  },
  {
    id: 'tmpl-3',
    name: 'Legs',
    notes: null,
    archived_at: null,
    created_at: 3000,
    updated_at: 3000,
    item_count: 0,
  },
];

describe('TemplateList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseFocusEffect.mockImplementation((cb) => {
      cb();
    });
    (getAllTemplatesWithCount as jest.Mock).mockResolvedValue(mockTemplates);
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

  it('shows correct exercise count labels', async () => {
    const { getByText } = render(<TemplateList />);
    await waitFor(() => expect(getByText('Push A')).toBeTruthy());
    expect(getByText('3 exercises')).toBeTruthy();
    expect(getByText('1 exercise')).toBeTruthy();
    expect(getByText('No exercises')).toBeTruthy();
  });

  it('shows empty state when no templates', async () => {
    (getAllTemplatesWithCount as jest.Mock).mockResolvedValue([]);
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

  it('groups preset templates by program and leaves unmatched templates custom', async () => {
    (getAllTemplatesWithCount as jest.Mock).mockResolvedValue([
      {
        id: 'phul-upper',
        name: 'Upper Power',
        notes: null,
        archived_at: null,
        created_at: 1000,
        updated_at: 1000,
        item_count: 6,
      },
      {
        id: 'gzclp-a',
        name: 'Day A — Squat / Bench / Lat Pulldown',
        notes: null,
        archived_at: null,
        created_at: 2000,
        updated_at: 2000,
        item_count: 3,
      },
      {
        id: 'custom',
        name: 'Hotel Upper',
        notes: null,
        archived_at: null,
        created_at: 3000,
        updated_at: 3000,
        item_count: 4,
      },
    ]);

    const { getByTestId, getByText } = render(<TemplateList />);

    await waitFor(() => expect(getByTestId('template-program-sections')).toBeTruthy());
    expect(getByTestId('template-program-section-gzclp').props.children).toBe('GZCLP');
    expect(getByTestId('template-program-section-phul').props.children).toBe('PHUL');
    expect(getByText('CUSTOM TEMPLATES · 1')).toBeTruthy();
    expect(getByText('Hotel Upper')).toBeTruthy();
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
      },
      {
        id: 'custom',
        name: 'My Friday Lift',
        notes: null,
        archived_at: null,
        created_at: 2000,
        updated_at: 2000,
        item_count: 2,
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
    await waitFor(() => expect(getAllTemplatesWithCount).toHaveBeenCalled());

    const callsBefore = (getAllTemplatesWithCount as jest.Mock).mock.calls.length;

    const cb = mockUseFocusEffect.mock.calls[0][0];
    cb();

    await waitFor(() =>
      expect((getAllTemplatesWithCount as jest.Mock).mock.calls.length).toBeGreaterThan(
        callsBefore,
      ),
    );
  });
});
