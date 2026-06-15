import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import ExerciseHistorySheet from '@/screens/ExerciseHistorySheet';
import { openDb } from '@/db/client';
import { getExerciseHistory } from '@/db/repositories/history.repo';
import {
  deleteExerciseIssueEvent,
  getActiveIssueExerciseLinksForExercise,
  getExerciseIssueEventsForExercise,
  getExerciseIssueSummary,
  updateExerciseIssueEvent,
} from '@/db/repositories/issues.repo';
import { getFinalPRsByExercise } from '@/db/repositories/prs.repo';
import { toLocalDateKey } from '@/domain/exerciseHistory';

const mockDb = {};

jest.mock('@/db/client', () => ({
  openDb: jest.fn().mockResolvedValue(mockDb),
}));

jest.mock('@/db/repositories/history.repo', () => ({
  getExerciseHistory: jest.fn(),
}));

jest.mock('@/db/repositories/issues.repo', () => ({
  deleteExerciseIssueEvent: jest.fn(),
  getActiveIssueExerciseLinksForExercise: jest.fn(),
  getExerciseIssueEventsForExercise: jest.fn(),
  getExerciseIssueSummary: jest.fn(),
  updateExerciseIssueEvent: jest.fn(),
}));

jest.mock('@/db/repositories/prs.repo', () => ({
  getFinalPRsByExercise: jest.fn(),
}));

const openDbMock = openDb as jest.MockedFunction<typeof openDb>;
const getExerciseHistoryMock = getExerciseHistory as jest.MockedFunction<typeof getExerciseHistory>;
const getActiveIssueExerciseLinksForExerciseMock =
  getActiveIssueExerciseLinksForExercise as jest.MockedFunction<
    typeof getActiveIssueExerciseLinksForExercise
  >;
const getExerciseIssueSummaryMock = getExerciseIssueSummary as jest.MockedFunction<
  typeof getExerciseIssueSummary
>;
const getExerciseIssueEventsForExerciseMock =
  getExerciseIssueEventsForExercise as jest.MockedFunction<typeof getExerciseIssueEventsForExercise>;
const getFinalPRsByExerciseMock = getFinalPRsByExercise as jest.MockedFunction<
  typeof getFinalPRsByExercise
>;
const updateExerciseIssueEventMock = updateExerciseIssueEvent as jest.MockedFunction<
  typeof updateExerciseIssueEvent
>;
const deleteExerciseIssueEventMock = deleteExerciseIssueEvent as jest.MockedFunction<
  typeof deleteExerciseIssueEvent
>;

const baseProps = {
  visible: true,
  exerciseId: 'bench',
  exerciseName: 'Bench Press',
  primaryMuscle: 'chest',
  category: 'barbell' as const,
  defaultUnit: 'kg' as const,
  targetSets: null,
  targetReps: null,
  targetWeight: null,
  progressionRule: { rule: 'none' as const },
  progressionExercise: { category: 'barbell' as const },
  onClose: jest.fn(),
};

function historySession(id: string, startedAt: number, weight = 100, reps = 5) {
  return {
    sessionId: id,
    startedAt,
    endedAt: startedAt + 60_000,
    sets: [
      {
        id: `${id}-set-1`,
        weight,
        reps,
        rpe: null,
        unit: 'kg' as const,
        set_type: 'working' as const,
        logged_at: startedAt,
        position: 0,
      },
    ],
    volume: weight * reps,
    topSetWeight: weight,
    topSetReps: reps,
    est1rm: weight * (1 + reps / 30),
  };
}

describe('ExerciseHistorySheet Issue history', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    openDbMock.mockResolvedValue(mockDb as never);
    getExerciseHistoryMock.mockResolvedValue([]);
    getActiveIssueExerciseLinksForExerciseMock.mockResolvedValue([
      {
        id: 'link-1',
        issue_id: 'issue-1',
        exercise_id: 'bench',
        issue_name: 'Shoulder Pain',
        link_type: 'helpful',
        note: 'Use lighter setup',
        created_at: 1,
        updated_at: 1,
      },
      {
        id: 'link-2',
        issue_id: 'issue-2',
        exercise_id: 'bench',
        issue_name: 'Lower Back Pain',
        link_type: 'aggravating',
        note: null,
        created_at: 1,
        updated_at: 1,
      },
    ]);
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
          set_id: null,
          client_event_id: null,
          reaction_type: 'aggravated',
          severity: 3,
          note: 'Tingling after set 2',
          created_at: 1_900_000_000_000,
        },
      },
    ]);
    getExerciseIssueEventsForExerciseMock.mockResolvedValue([]);
    getFinalPRsByExerciseMock.mockResolvedValue([]);
    updateExerciseIssueEventMock.mockResolvedValue(undefined);
    deleteExerciseIssueEventMock.mockResolvedValue(undefined);
  });

  it('shows compact tolerance summary when issue records exist', async () => {
    getActiveIssueExerciseLinksForExerciseMock.mockResolvedValueOnce([]);
    const { getByTestId, getByText } = render(
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
    expect(getByTestId('exercise-history-tolerance-summary')).toBeTruthy();
    expect(getByText('4 issue records noted.')).toBeTruthy();
    expect(getByText(/Latest: Aggravated 3\/5 · /)).toBeTruthy();
    expect(getByText('Marked aggravated 3 times.')).toBeTruthy();
    expect(getByText('Also marked helped 1 time.')).toBeTruthy();
    expect(getByText('Sample: 4 issue records')).toBeTruthy();
    expect(getByText('Shoulder Pain')).toBeTruthy();
    expect(getByText('Aggravated 3 times')).toBeTruthy();
    expect(getByText('Helped 1 time')).toBeTruthy();
    expect(getByText('Last note: Tingling after set 2')).toBeTruthy();
    expect(getByText('Latest Aggravated · 3/5')).toBeTruthy();
  });

  it('shows the recent session sample size for tolerance notes', async () => {
    getActiveIssueExerciseLinksForExerciseMock.mockResolvedValueOnce([]);
    getExerciseHistoryMock.mockResolvedValueOnce([
      historySession('session-1', 1_900_000_000_000),
      historySession('session-2', 1_899_900_000_000),
    ]);
    getExerciseIssueEventsForExerciseMock.mockResolvedValueOnce([
      {
        id: 'event-2',
        issue_id: 'issue-1',
        issue_name: 'Shoulder Pain',
        exercise_id: 'bench',
        session_id: 'session-2',
        set_id: null,
        client_event_id: null,
        reaction_type: 'helped',
        severity: 2,
        note: null,
        created_at: 1_899_900_000_000,
      },
      {
        id: 'event-1',
        issue_id: 'issue-1',
        issue_name: 'Shoulder Pain',
        exercise_id: 'bench',
        session_id: 'session-1',
        set_id: null,
        client_event_id: null,
        reaction_type: 'aggravated',
        severity: 3,
        note: null,
        created_at: 1_900_000_000_000,
      },
    ]);

    const { getByText } = render(<ExerciseHistorySheet {...baseProps} />);

    await waitFor(() => expect(getByText('Sample: 2 recent sessions')).toBeTruthy());
    expect(getByText('Issue notes co-occurred with 2 of last 2 sessions.')).toBeTruthy();
  });

  it('shows only the last 5 recent sessions', async () => {
    getExerciseHistoryMock.mockResolvedValue([
      historySession('s1', 1_900_000_005_000),
      historySession('s2', 1_900_000_004_000),
      historySession('s3', 1_900_000_003_000),
      historySession('s4', 1_900_000_002_000),
      historySession('s5', 1_900_000_001_000),
      historySession('s6', 1_900_000_000_000),
    ]);

    const { getByTestId, queryByTestId } = render(<ExerciseHistorySheet {...baseProps} />);

    await waitFor(() => expect(getByTestId('exercise-history-session-s1')).toBeTruthy());
    expect(getByTestId('exercise-history-session-s5')).toBeTruthy();
    expect(queryByTestId('exercise-history-session-s6')).toBeNull();
  });

  it('hides graph sections with insufficient data', async () => {
    getExerciseHistoryMock.mockResolvedValue([historySession('s1', 1_900_000_000_000)]);

    const { getByTestId, queryByTestId } = render(<ExerciseHistorySheet {...baseProps} />);

    await waitFor(() => expect(getByTestId('exercise-history-session-s1')).toBeTruthy());
    expect(queryByTestId('exercise-history-estimated-1rm-graph')).toBeNull();
    expect(queryByTestId('exercise-history-volume-graph')).toBeNull();
  });

  it('marks calendar days only for performed sessions in range', async () => {
    const today = Date.now();
    const trainedToday = today - 60_000;
    const trainedYesterday = today - 24 * 60 * 60 * 1000;
    const oldSession = today - 90 * 24 * 60 * 60 * 1000;
    getExerciseHistoryMock.mockResolvedValue([
      historySession('today', trainedToday),
      historySession('yesterday', trainedYesterday),
      historySession('old', oldSession),
    ]);

    const { getByTestId, queryByTestId } = render(<ExerciseHistorySheet {...baseProps} />);

    await waitFor(() =>
      expect(
        getByTestId(`exercise-history-calendar-mark-${toLocalDateKey(trainedToday)}`),
      ).toBeTruthy(),
    );
    expect(
      getByTestId(`exercise-history-calendar-mark-${toLocalDateKey(trainedYesterday)}`),
    ).toBeTruthy();
    expect(
      queryByTestId(`exercise-history-calendar-mark-${toLocalDateKey(oldSession)}`),
    ).toBeNull();
  });

  it('shows issue reactions and notes on matching recent sessions', async () => {
    getExerciseHistoryMock.mockResolvedValue([historySession('session-1', 1_900_000_000_000)]);
    getExerciseIssueEventsForExerciseMock.mockResolvedValue([
      {
        id: 'event-session-1',
        issue_id: 'issue-1',
        issue_name: 'Shoulder Pain',
        exercise_id: 'bench',
        session_id: 'session-1',
        set_id: null,
        client_event_id: null,
        reaction_type: 'aggravated',
        severity: 4,
        note: 'Pinch after top set',
        created_at: 1_900_000_000_000,
      },
    ]);

    const { getByText } = render(<ExerciseHistorySheet {...baseProps} />);

    await waitFor(() => expect(getByText('Shoulder Pain: Aggravated 4/5')).toBeTruthy());
    expect(getByText('Pinch after top set')).toBeTruthy();
  });

  it('shows set-level issue context on matching recent sessions', async () => {
    getExerciseHistoryMock.mockResolvedValue([
      {
        ...historySession('session-1', 1_900_000_000_000),
        sets: [
          {
            id: 'set-1',
            weight: 90,
            reps: 5,
            rpe: null,
            unit: 'kg' as const,
            set_type: 'working' as const,
            logged_at: 1_900_000_000_000,
            position: 0,
          },
          {
            id: 'set-2',
            weight: 100,
            reps: 5,
            rpe: null,
            unit: 'kg' as const,
            set_type: 'working' as const,
            logged_at: 1_900_000_010_000,
            position: 1,
          },
        ],
      },
    ]);
    getExerciseIssueEventsForExerciseMock.mockResolvedValue([
      {
        id: 'event-session-1',
        issue_id: 'issue-1',
        issue_name: 'Shoulder Pain',
        exercise_id: 'bench',
        session_id: 'session-1',
        set_id: 'set-2',
        client_event_id: null,
        reaction_type: 'aggravated',
        severity: 3,
        note: null,
        created_at: 1_900_000_010_000,
      },
    ]);

    const { getByText } = render(<ExerciseHistorySheet {...baseProps} />);

    await waitFor(() =>
      expect(getByText('Set 2: Shoulder Pain · Aggravated 3/5')).toBeTruthy(),
    );
  });

  it('does not show tolerance summary when there is no issue data', async () => {
    getActiveIssueExerciseLinksForExerciseMock.mockResolvedValueOnce([]);
    getExerciseIssueSummaryMock.mockResolvedValueOnce([]);
    getExerciseIssueEventsForExerciseMock.mockResolvedValueOnce([]);
    getExerciseHistoryMock.mockResolvedValueOnce([historySession('session-1', 1_900_000_000_000)]);

    const { getByTestId, queryByTestId } = render(<ExerciseHistorySheet {...baseProps} />);

    await waitFor(() => expect(getByTestId('exercise-history-session-session-1')).toBeTruthy());
    expect(queryByTestId('exercise-history-tolerance-summary')).toBeNull();
  });

  it('shows issue-suppressed suggestion reason in the suggestion card', async () => {
    getExerciseHistoryMock.mockResolvedValueOnce([historySession('session-1', 1_900_000_000_000)]);
    getExerciseIssueEventsForExerciseMock.mockResolvedValueOnce([
      {
        id: 'event-session-1',
        issue_id: 'issue-1',
        issue_name: 'Shoulder',
        exercise_id: 'bench',
        session_id: 'session-1',
        set_id: null,
        client_event_id: null,
        reaction_type: 'aggravated',
        severity: 4,
        note: null,
        created_at: 1_900_000_000_000,
      },
    ]);

    const { getByText } = render(
      <ExerciseHistorySheet
        {...baseProps}
        targetReps={5}
        targetWeight={100}
        progressionRule={{ rule: 'linear' }}
      />,
    );

    await waitFor(() =>
      expect(
        getByText('High issue aggravation noted recently: consider an easier set.'),
      ).toBeTruthy(),
    );
  });

  it('shows manual Issue links separately from reaction history', async () => {
    const { getAllByText, getByText } = render(
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

    await waitFor(() => expect(getByText('Issue links')).toBeTruthy());
    expect(getAllByText('Shoulder Pain').length).toBeGreaterThanOrEqual(1);
    expect(getByText('Helpful')).toBeTruthy();
    expect(getByText('Use lighter setup')).toBeTruthy();
    expect(getByText('Lower Back Pain')).toBeTruthy();
    expect(getByText('Aggravating')).toBeTruthy();
    expect(getByText('Issue history')).toBeTruthy();
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
    getActiveIssueExerciseLinksForExerciseMock.mockResolvedValue([]);
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
            set_id: null,
            client_event_id: null,
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

    await waitFor(() =>
      expect(deleteExerciseIssueEventMock).toHaveBeenCalledWith(mockDb, 'event-1'),
    );
    await waitFor(() => expect(queryByText('Shoulder Pain')).toBeNull());
    alertSpy.mockRestore();
  });
});
