import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import IssueDetail from '@/screens/IssueDetail';
import { openDb } from '@/db/client';
import {
  createIssueExerciseLink,
  deleteExerciseIssueEvent,
  deleteIssueExerciseLink,
  getIssueById,
  getIssueExerciseLinks,
  getIssueRecentEvents,
  updateIssueExerciseLink,
  updateExerciseIssueEvent,
} from '@/db/repositories/issues.repo';

const mockDb = {};
const mockGoBack = jest.fn();
let mockRouteParams: { issueId?: string } | undefined = { issueId: 'issue-1' };

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ goBack: mockGoBack }),
  useRoute: () => ({ params: mockRouteParams }),
}));

jest.mock('@/db/client', () => ({
  openDb: jest.fn().mockResolvedValue(mockDb),
}));

jest.mock('@/db/repositories/issues.repo', () => ({
  archiveIssue: jest.fn(),
  createIssue: jest.fn(),
  createIssueExerciseLink: jest.fn(),
  deleteExerciseIssueEvent: jest.fn(),
  deleteIssueExerciseLink: jest.fn(),
  getIssueById: jest.fn(),
  getIssueExerciseLinks: jest.fn(),
  getIssueRecentEvents: jest.fn(),
  updateIssueExerciseLink: jest.fn(),
  updateExerciseIssueEvent: jest.fn(),
  updateIssue: jest.fn(),
}));

jest.mock('@/components/ExercisePicker', () => {
  const React = jest.requireActual('react');
  const { Text, TouchableOpacity } = jest.requireActual('react-native');
  return {
    ExercisePicker: ({
      visible,
      onSelect,
    }: {
      visible: boolean;
      onSelect: (exercise: {
        id: string;
        name: string;
        normalized_name: string;
        category: 'cable';
        primary_muscle: null;
        default_unit: 'kg';
        is_custom: 1;
        archived_at: null;
        created_at: number;
        updated_at: number;
      }) => void;
    }) =>
      visible
        ? React.createElement(
            TouchableOpacity,
            {
              testID: 'mock-picker-select-face-pull',
              onPress: () =>
                onSelect({
                  id: 'face-pull',
                  name: 'Face Pull',
                  normalized_name: 'face pull',
                  category: 'cable',
                  primary_muscle: null,
                  default_unit: 'kg',
                  is_custom: 1,
                  archived_at: null,
                  created_at: 1,
                  updated_at: 1,
                }),
            },
            React.createElement(Text, null, 'Select Face Pull'),
          )
        : null,
  };
});

const openDbMock = openDb as jest.MockedFunction<typeof openDb>;
const getIssueByIdMock = getIssueById as jest.MockedFunction<typeof getIssueById>;
const getIssueRecentEventsMock = getIssueRecentEvents as jest.MockedFunction<
  typeof getIssueRecentEvents
>;
const getIssueExerciseLinksMock = getIssueExerciseLinks as jest.MockedFunction<
  typeof getIssueExerciseLinks
>;
const createIssueExerciseLinkMock = createIssueExerciseLink as jest.MockedFunction<
  typeof createIssueExerciseLink
>;
const updateIssueExerciseLinkMock = updateIssueExerciseLink as jest.MockedFunction<
  typeof updateIssueExerciseLink
>;
const deleteIssueExerciseLinkMock = deleteIssueExerciseLink as jest.MockedFunction<
  typeof deleteIssueExerciseLink
>;
const updateExerciseIssueEventMock = updateExerciseIssueEvent as jest.MockedFunction<
  typeof updateExerciseIssueEvent
>;
const deleteExerciseIssueEventMock = deleteExerciseIssueEvent as jest.MockedFunction<
  typeof deleteExerciseIssueEvent
>;

const issue = {
  id: 'issue-1',
  name: 'Shoulder Pain',
  note: null,
  active: 1 as const,
  created_at: 1,
  updated_at: 1,
};

const event = {
  id: 'event-1',
  issue_id: 'issue-1',
  exercise_id: 'bench',
  session_id: 'session-1',
  reaction_type: 'aggravated' as const,
  severity: 3,
  note: 'Tingling after set 2',
  created_at: 1_900_000_000_000,
  issue_name: 'Shoulder Pain',
  exercise_name: 'Bench Press',
};

let recentEvents = [event];
let exerciseLinks = [
  {
    id: 'link-helpful',
    issue_id: 'issue-1',
    exercise_id: 'face-pull',
    exercise_name: 'Face Pull',
    link_type: 'helpful' as const,
    note: null,
    created_at: 1,
    updated_at: 1,
  },
  {
    id: 'link-aggravating',
    issue_id: 'issue-1',
    exercise_id: 'ohp',
    exercise_name: 'Overhead Press',
    link_type: 'aggravating' as const,
    note: 'Pinches at lockout',
    created_at: 1,
    updated_at: 1,
  },
];

describe('IssueDetail reaction correction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouteParams = { issueId: 'issue-1' };
    recentEvents = [event];
    exerciseLinks = [
      {
        id: 'link-helpful',
        issue_id: 'issue-1',
        exercise_id: 'face-pull',
        exercise_name: 'Face Pull',
        link_type: 'helpful',
        note: null,
        created_at: 1,
        updated_at: 1,
      },
      {
        id: 'link-aggravating',
        issue_id: 'issue-1',
        exercise_id: 'ohp',
        exercise_name: 'Overhead Press',
        link_type: 'aggravating',
        note: 'Pinches at lockout',
        created_at: 1,
        updated_at: 1,
      },
    ];
    openDbMock.mockResolvedValue(mockDb as never);
    getIssueByIdMock.mockResolvedValue(issue);
    getIssueRecentEventsMock.mockImplementation(async () => recentEvents);
    getIssueExerciseLinksMock.mockImplementation(async () => exerciseLinks);
    createIssueExerciseLinkMock.mockResolvedValue(exerciseLinks[0]);
    updateIssueExerciseLinkMock.mockResolvedValue(undefined);
    deleteIssueExerciseLinkMock.mockResolvedValue(undefined);
    updateExerciseIssueEventMock.mockResolvedValue(undefined);
    deleteExerciseIssueEventMock.mockResolvedValue(undefined);
  });

  it('shows helpful and aggravating exercise links on Issue detail', async () => {
    const { getByText, getByDisplayValue } = render(<IssueDetail />);

    await waitFor(() => expect(getByText('Helpful Exercises')).toBeTruthy());
    expect(getByText('Face Pull')).toBeTruthy();
    expect(getByText('Aggravating Exercises')).toBeTruthy();
    expect(getByText('Overhead Press')).toBeTruthy();
    expect(getByDisplayValue('Pinches at lockout')).toBeTruthy();
  });

  it('adds a helpful exercise link from the shared picker', async () => {
    exerciseLinks = [];
    createIssueExerciseLinkMock.mockImplementationOnce(async () => {
      exerciseLinks = [
        {
          id: 'link-helpful',
          issue_id: 'issue-1',
          exercise_id: 'face-pull',
          exercise_name: 'Face Pull',
          link_type: 'helpful',
          note: null,
          created_at: 1,
          updated_at: 1,
        },
      ];
      return exerciseLinks[0];
    });

    const { getByTestId, getByText } = render(<IssueDetail />);

    await waitFor(() => expect(getByTestId('add-helpful-exercise-link-btn')).toBeTruthy());
    fireEvent.press(getByTestId('add-helpful-exercise-link-btn'));
    fireEvent.press(getByTestId('mock-picker-select-face-pull'));

    await waitFor(() =>
      expect(createIssueExerciseLinkMock).toHaveBeenCalledWith(mockDb, {
        issueId: 'issue-1',
        exerciseId: 'face-pull',
        linkType: 'helpful',
      }),
    );
    await waitFor(() => expect(getByText('Face Pull')).toBeTruthy());
  });

  it('removes an exercise link from Issue detail', async () => {
    deleteIssueExerciseLinkMock.mockImplementationOnce(async () => {
      exerciseLinks = exerciseLinks.filter((link) => link.id !== 'link-aggravating');
    });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.text === 'Remove')?.onPress?.();
    });

    const { getByTestId, queryByText } = render(<IssueDetail />);

    await waitFor(() =>
      expect(getByTestId('remove-issue-exercise-link-link-aggravating')).toBeTruthy(),
    );
    fireEvent.press(getByTestId('remove-issue-exercise-link-link-aggravating'));

    await waitFor(() =>
      expect(deleteIssueExerciseLinkMock).toHaveBeenCalledWith(mockDb, 'link-aggravating'),
    );
    await waitFor(() => expect(queryByText('Overhead Press')).toBeNull());
    alertSpy.mockRestore();
  });

  it('edits a recent Issue reaction from Issue detail', async () => {
    const { getByTestId } = render(<IssueDetail />);

    await waitFor(() => expect(getByTestId('issue-reaction-row-event-1')).toBeTruthy());
    fireEvent.press(getByTestId('issue-reaction-row-event-1'));
    fireEvent.press(getByTestId('edit-issue-reaction-helped'));
    fireEvent.press(getByTestId('edit-issue-severity-5'));
    fireEvent.changeText(getByTestId('edit-issue-note-input'), 'Updated note');
    fireEvent.press(getByTestId('save-issue-reaction-edit-btn'));

    await waitFor(() =>
      expect(updateExerciseIssueEventMock).toHaveBeenCalledWith(mockDb, 'event-1', {
        reactionType: 'helped',
        severity: 5,
        note: 'Updated note',
      }),
    );
  });

  it('deletes a recent Issue reaction from Issue detail without deleting the Issue', async () => {
    deleteExerciseIssueEventMock.mockImplementationOnce(async () => {
      recentEvents = [];
    });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.text === 'Delete')?.onPress?.();
    });

    const { getByTestId, queryByText } = render(<IssueDetail />);

    await waitFor(() => expect(getByTestId('issue-reaction-row-event-1')).toBeTruthy());
    fireEvent.press(getByTestId('issue-reaction-row-event-1'));
    fireEvent.press(getByTestId('delete-issue-reaction-btn'));

    await waitFor(() =>
      expect(deleteExerciseIssueEventMock).toHaveBeenCalledWith(mockDb, 'event-1'),
    );
    await waitFor(() => expect(queryByText('Bench Press')).toBeNull());
    expect(getIssueByIdMock).toHaveBeenCalledWith(mockDb, 'issue-1');

    alertSpy.mockRestore();
  });
});
