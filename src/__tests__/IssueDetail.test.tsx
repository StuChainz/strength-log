import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import IssueDetail from '@/screens/IssueDetail';
import { openDb } from '@/db/client';
import {
  deleteExerciseIssueEvent,
  getIssueById,
  getIssueRecentEvents,
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
  deleteExerciseIssueEvent: jest.fn(),
  getIssueById: jest.fn(),
  getIssueRecentEvents: jest.fn(),
  updateExerciseIssueEvent: jest.fn(),
  updateIssue: jest.fn(),
}));

const openDbMock = openDb as jest.MockedFunction<typeof openDb>;
const getIssueByIdMock = getIssueById as jest.MockedFunction<typeof getIssueById>;
const getIssueRecentEventsMock = getIssueRecentEvents as jest.MockedFunction<
  typeof getIssueRecentEvents
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

describe('IssueDetail reaction correction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouteParams = { issueId: 'issue-1' };
    recentEvents = [event];
    openDbMock.mockResolvedValue(mockDb as never);
    getIssueByIdMock.mockResolvedValue(issue);
    getIssueRecentEventsMock.mockImplementation(async () => recentEvents);
    updateExerciseIssueEventMock.mockResolvedValue(undefined);
    deleteExerciseIssueEventMock.mockResolvedValue(undefined);
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

    await waitFor(() => expect(deleteExerciseIssueEventMock).toHaveBeenCalledWith(mockDb, 'event-1'));
    await waitFor(() => expect(queryByText('Bench Press')).toBeNull());
    expect(getIssueByIdMock).toHaveBeenCalledWith(mockDb, 'issue-1');

    alertSpy.mockRestore();
  });
});
