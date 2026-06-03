import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import ExerciseHistorySheet from '@/screens/ExerciseHistorySheet';
import { openDb } from '@/db/client';
import { getExerciseHistory } from '@/db/repositories/history.repo';
import {
  deleteExerciseIssueEvent,
  getExerciseIssueSummary,
  updateExerciseIssueEvent,
} from '@/db/repositories/issues.repo';

const mockDb = {};

jest.mock('@/db/client', () => ({
  openDb: jest.fn().mockResolvedValue(mockDb),
}));

jest.mock('@/db/repositories/history.repo', () => ({
  getExerciseHistory: jest.fn(),
}));

jest.mock('@/db/repositories/issues.repo', () => ({
  deleteExerciseIssueEvent: jest.fn(),
  getExerciseIssueSummary: jest.fn(),
  updateExerciseIssueEvent: jest.fn(),
}));

const openDbMock = openDb as jest.MockedFunction<typeof openDb>;
const getExerciseHistoryMock = getExerciseHistory as jest.MockedFunction<typeof getExerciseHistory>;
const getExerciseIssueSummaryMock = getExerciseIssueSummary as jest.MockedFunction<
  typeof getExerciseIssueSummary
>;
const updateExerciseIssueEventMock = updateExerciseIssueEvent as jest.MockedFunction<
  typeof updateExerciseIssueEvent
>;
const deleteExerciseIssueEventMock = deleteExerciseIssueEvent as jest.MockedFunction<
  typeof deleteExerciseIssueEvent
>;

describe('ExerciseHistorySheet Issue history', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    openDbMock.mockResolvedValue(mockDb as never);
    getExerciseHistoryMock.mockResolvedValue([]);
    getExerciseIssueSummaryMock.mockResolvedValue([
      {
        issueId: 'issue-1',
        issueName: 'Shoulder Pain',
        aggravatedCount: 3,
        helpedCount: 1,
        lastNote: 'Tingling after set 2',
        lastCreatedAt: 1_900_000_000_000,
        latestEvent: {
          id: 'event-1',
          issue_id: 'issue-1',
          exercise_id: 'bench',
          session_id: 'session-1',
          reaction_type: 'aggravated',
          severity: 3,
          note: 'Tingling after set 2',
          created_at: 1_900_000_000_000,
        },
      },
    ]);
    updateExerciseIssueEventMock.mockResolvedValue(undefined);
    deleteExerciseIssueEventMock.mockResolvedValue(undefined);
  });

  it('shows compact Issue reaction summary when records exist', async () => {
    const { getByText } = render(
      <ExerciseHistorySheet
        visible
        exerciseId="bench"
        exerciseName="Bench Press"
        category="barbell"
        defaultUnit="kg"
        targetSets={null}
        targetReps={null}
        targetWeight={null}
        progressionRule={{ rule: 'none' }}
        progressionExercise={{ category: 'barbell' }}
        onClose={jest.fn()}
      />,
    );

    await waitFor(() => expect(getByText('Issue history')).toBeTruthy());
    expect(getByText('Shoulder Pain')).toBeTruthy();
    expect(getByText('Aggravated 3 times')).toBeTruthy();
    expect(getByText('Helped 1 time')).toBeTruthy();
    expect(getByText('Last note: Tingling after set 2')).toBeTruthy();
    expect(getByText('Latest Aggravated · 3/5')).toBeTruthy();
  });

  it('edits the latest Issue reaction from Exercise History', async () => {
    const { getByTestId } = render(
      <ExerciseHistorySheet
        visible
        exerciseId="bench"
        exerciseName="Bench Press"
        category="barbell"
        defaultUnit="kg"
        targetSets={null}
        targetReps={null}
        targetWeight={null}
        progressionRule={{ rule: 'none' }}
        progressionExercise={{ category: 'barbell' }}
        onClose={jest.fn()}
      />,
    );

    await waitFor(() => expect(getByTestId('exercise-history-issue-row-issue-1')).toBeTruthy());
    fireEvent.press(getByTestId('exercise-history-issue-row-issue-1'));
    fireEvent.press(getByTestId('edit-issue-reaction-helped'));
    fireEvent.press(getByTestId('edit-issue-severity-2'));
    fireEvent.changeText(getByTestId('edit-issue-note-input'), 'Felt better after warmup');
    fireEvent.press(getByTestId('save-issue-reaction-edit-btn'));

    await waitFor(() =>
      expect(updateExerciseIssueEventMock).toHaveBeenCalledWith(mockDb, 'event-1', {
        reactionType: 'helped',
        severity: 2,
        note: 'Felt better after warmup',
      }),
    );
  });

  it('deletes the latest Issue reaction from Exercise History and refreshes the summary', async () => {
    getExerciseIssueSummaryMock
      .mockResolvedValueOnce([
        {
          issueId: 'issue-1',
          issueName: 'Shoulder Pain',
          aggravatedCount: 1,
          helpedCount: 0,
          lastNote: 'Delete me',
          lastCreatedAt: 1_900_000_000_000,
          latestEvent: {
            id: 'event-1',
            issue_id: 'issue-1',
            exercise_id: 'bench',
            session_id: 'session-1',
            reaction_type: 'aggravated',
            severity: 3,
            note: 'Delete me',
            created_at: 1_900_000_000_000,
          },
        },
      ])
      .mockResolvedValueOnce([]);
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.text === 'Delete')?.onPress?.();
    });

    const { getByTestId, queryByText } = render(
      <ExerciseHistorySheet
        visible
        exerciseId="bench"
        exerciseName="Bench Press"
        category="barbell"
        defaultUnit="kg"
        targetSets={null}
        targetReps={null}
        targetWeight={null}
        progressionRule={{ rule: 'none' }}
        progressionExercise={{ category: 'barbell' }}
        onClose={jest.fn()}
      />,
    );

    await waitFor(() => expect(getByTestId('exercise-history-issue-row-issue-1')).toBeTruthy());
    fireEvent.press(getByTestId('exercise-history-issue-row-issue-1'));
    fireEvent.press(getByTestId('delete-issue-reaction-btn'));

    await waitFor(() => expect(deleteExerciseIssueEventMock).toHaveBeenCalledWith(mockDb, 'event-1'));
    await waitFor(() => expect(queryByText('Shoulder Pain')).toBeNull());
    alertSpy.mockRestore();
  });
});
