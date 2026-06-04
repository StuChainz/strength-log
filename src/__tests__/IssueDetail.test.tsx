import { Alert } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import IssueDetail from '@/screens/IssueDetail';
import { openDb } from '@/db/client';
import {
  createIssue,
  createIssueCheckin,
  createIssueRoutine,
  createIssueExerciseLink,
  deleteExerciseIssueEvent,
  deleteIssueExerciseLink,
  getIssueCheckinTrend,
  getIssueById,
  getIssueExerciseLinks,
  getIssueRecentCheckins,
  getIssueRoutine,
  getIssueRoutineCompletionContext,
  getIssueRoutineItems,
  getIssueRecentEvents,
  removeIssueRoutine,
  updateIssueExerciseLink,
  updateExerciseIssueEvent,
  updateIssueRoutine,
} from '@/db/repositories/issues.repo';

const mockDb = {};
const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
let mockRouteParams: { issueId?: string } | undefined = { issueId: 'issue-1' };

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ goBack: mockGoBack, navigate: mockNavigate }),
  useRoute: () => ({ params: mockRouteParams }),
}));

jest.mock('@/db/client', () => ({
  openDb: jest.fn().mockResolvedValue(mockDb),
}));

jest.mock('@/db/repositories/issues.repo', () => ({
  archiveIssue: jest.fn(),
  createIssueCheckin: jest.fn(),
  createIssue: jest.fn(),
  createIssueExerciseLink: jest.fn(),
  createIssueRoutine: jest.fn(),
  deleteExerciseIssueEvent: jest.fn(),
  deleteIssueExerciseLink: jest.fn(),
  getIssueCheckinTrend: jest.fn(),
  getIssueById: jest.fn(),
  getIssueExerciseLinks: jest.fn(),
  getIssueRecentCheckins: jest.fn(),
  getIssueRoutine: jest.fn(),
  getIssueRoutineCompletionContext: jest.fn(),
  getIssueRoutineItems: jest.fn(),
  getIssueRecentEvents: jest.fn(),
  removeIssueRoutine: jest.fn(),
  updateIssueExerciseLink: jest.fn(),
  updateExerciseIssueEvent: jest.fn(),
  updateIssueRoutine: jest.fn(),
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
const createIssueMock = createIssue as jest.MockedFunction<typeof createIssue>;
const createIssueCheckinMock = createIssueCheckin as jest.MockedFunction<typeof createIssueCheckin>;
const getIssueByIdMock = getIssueById as jest.MockedFunction<typeof getIssueById>;
const getIssueCheckinTrendMock = getIssueCheckinTrend as jest.MockedFunction<
  typeof getIssueCheckinTrend
>;
const getIssueRecentCheckinsMock = getIssueRecentCheckins as jest.MockedFunction<
  typeof getIssueRecentCheckins
>;
const getIssueRoutineCompletionContextMock =
  getIssueRoutineCompletionContext as jest.MockedFunction<typeof getIssueRoutineCompletionContext>;
const getIssueRecentEventsMock = getIssueRecentEvents as jest.MockedFunction<
  typeof getIssueRecentEvents
>;
const getIssueExerciseLinksMock = getIssueExerciseLinks as jest.MockedFunction<
  typeof getIssueExerciseLinks
>;
const createIssueExerciseLinkMock = createIssueExerciseLink as jest.MockedFunction<
  typeof createIssueExerciseLink
>;
const createIssueRoutineMock = createIssueRoutine as jest.MockedFunction<typeof createIssueRoutine>;
const getIssueRoutineMock = getIssueRoutine as jest.MockedFunction<typeof getIssueRoutine>;
const getIssueRoutineItemsMock = getIssueRoutineItems as jest.MockedFunction<
  typeof getIssueRoutineItems
>;
const updateIssueRoutineMock = updateIssueRoutine as jest.MockedFunction<typeof updateIssueRoutine>;
const removeIssueRoutineMock = removeIssueRoutine as jest.MockedFunction<typeof removeIssueRoutine>;
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

const checkin = {
  id: 'checkin-1',
  issue_id: 'issue-1',
  severity: 3,
  note: 'Less sharp pain on bench',
  created_at: 1_900_000_000_000,
  updated_at: 1_900_000_000_000,
};

let recentEvents = [event];
let recentCheckins: Awaited<ReturnType<typeof getIssueRecentCheckins>> = [checkin];
let trend: Awaited<ReturnType<typeof getIssueCheckinTrend>> = { status: 'insufficient', count: 1 };
let routineCompletionContext: Awaited<ReturnType<typeof getIssueRoutineCompletionContext>> = null;
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
let routine: {
  id: string;
  issue_id: string;
  template_id: string;
  created_at: number;
  updated_at: number;
  routine_name: string;
  routine_note: string | null;
  exercise_count: number;
  last_completed_at: number | null;
} | null = null;
let routineItems: {
  id: string;
  template_id: string;
  exercise_id: string;
  exercise_name: string;
  exercise_category: 'cable';
  exercise_default_unit: 'kg';
  exercise_movement_pattern: null;
  exercise_body_region: null;
  exercise_mechanics: null;
  exercise_equipment_json: null;
  position: number;
  target_sets: number | null;
  target_reps: number | null;
  target_weight: number | null;
  target_rpe: number | null;
  rest_seconds: number | null;
  note: string | null;
  progression_rule: 'none';
  increment_kg: null;
  increment_lb: null;
  rep_range_min: null;
  rep_range_max: null;
  rpe_cap: null;
  amrap_last_set: 0;
}[] = [];

describe('IssueDetail reaction correction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(1_900_000_000_000);
    mockRouteParams = { issueId: 'issue-1' };
    routine = null;
    routineItems = [];
    recentEvents = [event];
    recentCheckins = [checkin];
    trend = { status: 'insufficient', count: 1 };
    routineCompletionContext = null;
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
    createIssueMock.mockResolvedValue({
      id: 'issue-created',
      name: 'Knee Pain',
      note: 'Front of knee',
      active: 1,
      created_at: 1,
      updated_at: 1,
    });
    createIssueCheckinMock.mockImplementation(async (_db, input) => {
      const nextCheckin = {
        id: `checkin-${recentCheckins.length + 1}`,
        issue_id: input.issueId,
        severity: input.severity,
        note: input.note?.trim() ? input.note.trim() : null,
        created_at: Date.now(),
        updated_at: Date.now(),
      };
      recentCheckins = [nextCheckin, ...recentCheckins];
      trend =
        recentCheckins.length < 3
          ? { status: 'insufficient', count: recentCheckins.length }
          : {
              status: 'improving',
              count: recentCheckins.length,
              firstThreeAverage: 4.3,
              latestThreeAverage: 2.7,
            };
      return nextCheckin;
    });
    getIssueByIdMock.mockResolvedValue(issue);
    getIssueCheckinTrendMock.mockImplementation(async () => trend);
    getIssueRecentCheckinsMock.mockImplementation(async () => recentCheckins);
    getIssueRoutineCompletionContextMock.mockImplementation(async () => routineCompletionContext);
    getIssueRecentEventsMock.mockImplementation(async () => recentEvents);
    getIssueExerciseLinksMock.mockImplementation(async () => exerciseLinks);
    getIssueRoutineMock.mockImplementation(async () => routine);
    getIssueRoutineItemsMock.mockImplementation(async () => routineItems);
    createIssueExerciseLinkMock.mockResolvedValue(exerciseLinks[0]);
    createIssueRoutineMock.mockResolvedValue({
      id: 'routine-1',
      issue_id: 'issue-1',
      template_id: 'template-routine',
      created_at: 1,
      updated_at: 1,
    });
    updateIssueRoutineMock.mockResolvedValue(undefined);
    removeIssueRoutineMock.mockResolvedValue(undefined);
    updateIssueExerciseLinkMock.mockResolvedValue(undefined);
    deleteIssueExerciseLinkMock.mockResolvedValue(undefined);
    updateExerciseIssueEventMock.mockResolvedValue(undefined);
    deleteExerciseIssueEventMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
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

  it('records an Issue check-in with an optional note', async () => {
    recentCheckins = [];
    const { getByTestId, getByText } = render(<IssueDetail />);

    await waitFor(() => expect(getByTestId('issue-checkin-area')).toBeTruthy());
    fireEvent.press(getByTestId('issue-checkin-severity-3'));
    fireEvent.changeText(getByTestId('issue-checkin-note-input'), ' Less sharp pain on bench ');
    fireEvent.press(getByTestId('save-issue-checkin-btn'));

    await waitFor(() =>
      expect(createIssueCheckinMock).toHaveBeenCalledWith(mockDb, {
        issueId: 'issue-1',
        severity: 3,
        note: ' Less sharp pain on bench ',
      }),
    );
    await waitFor(() => expect(getByText('3/5 · Today · "Less sharp pain on bench"')).toBeTruthy());
  });

  it('shows recent check-ins and insufficient trend copy', async () => {
    const { getByTestId, getByText } = render(<IssueDetail />);

    await waitFor(() => expect(getByTestId('issue-checkin-checkin-1')).toBeTruthy());
    expect(getByText('3/5 · Today · "Less sharp pain on bench"')).toBeTruthy();
    expect(getByText('Not enough check-ins for a trend yet.')).toBeTruthy();
  });

  it('shows a cautious improving trend summary without causal wording', async () => {
    trend = {
      status: 'improving',
      count: 6,
      firstThreeAverage: 4.3,
      latestThreeAverage: 2.7,
    };
    const { getByTestId, getByText, toJSON } = render(<IssueDetail />);

    await waitFor(() => expect(getByTestId('issue-checkin-trend-improving')).toBeTruthy());
    expect(getByText('Reported severity is lower recently.')).toBeTruthy();
    expect(getByText('First 3-check-in average: 4.3')).toBeTruthy();
    expect(getByText('Latest 3-check-in average: 2.7')).toBeTruthy();
    expect(getByText('Small sample: 6 check-ins')).toBeTruthy();
    expect(JSON.stringify(toJSON())).not.toMatch(
      /\b(caused|fixed|cured|solved|proved|you should|you must|definitely)\b/i,
    );
  });

  it('shows linked routine completion context only when supported', async () => {
    routineCompletionContext = {
      routineId: 'routine-1',
      templateId: 'template-routine',
      completedLast30Days: 4,
    };
    const { getByTestId, getByText } = render(<IssueDetail />);

    await waitFor(() => expect(getByTestId('issue-routine-completion-context')).toBeTruthy());
    expect(getByText('Linked routine completed:')).toBeTruthy();
    expect(getByText('4 times in the last 30 days')).toBeTruthy();
  });

  it('creates an Issue Routine from the shared exercise picker', async () => {
    createIssueRoutineMock.mockImplementationOnce(async () => {
      routine = {
        id: 'routine-1',
        issue_id: 'issue-1',
        template_id: 'template-routine',
        routine_name: 'Shoulder Pain Routine',
        routine_note: null,
        exercise_count: 1,
        last_completed_at: null,
        created_at: 1,
        updated_at: 1,
      };
      routineItems = [
        {
          id: 'routine-item-1',
          template_id: 'template-routine',
          exercise_id: 'face-pull',
          exercise_name: 'Face Pull',
          exercise_category: 'cable',
          exercise_default_unit: 'kg',
          exercise_movement_pattern: null,
          exercise_body_region: null,
          exercise_mechanics: null,
          exercise_equipment_json: null,
          position: 0,
          target_sets: 2,
          target_reps: 15,
          target_weight: null,
          target_rpe: null,
          rest_seconds: null,
          note: 'Light',
          progression_rule: 'none',
          increment_kg: null,
          increment_lb: null,
          rep_range_min: null,
          rep_range_max: null,
          rpe_cap: null,
          amrap_last_set: 0,
        },
      ];
      return {
        id: 'routine-1',
        issue_id: 'issue-1',
        template_id: 'template-routine',
        created_at: 1,
        updated_at: 1,
      };
    });

    const { getByTestId, getByText } = render(<IssueDetail />);

    await waitFor(() => expect(getByTestId('create-issue-routine-btn')).toBeTruthy());
    expect(getByText('No routine linked')).toBeTruthy();
    fireEvent.press(getByTestId('create-issue-routine-btn'));
    fireEvent.press(getByTestId('add-routine-exercise-btn'));
    fireEvent.press(getByTestId('mock-picker-select-face-pull'));
    fireEvent.changeText(getByTestId(/^routine-target-sets-/), '2');
    fireEvent.changeText(getByTestId(/^routine-target-reps-/), '15');
    fireEvent.changeText(getByTestId(/^routine-note-/), 'Light');
    fireEvent.press(getByTestId('save-issue-routine-btn'));

    await waitFor(() =>
      expect(createIssueRoutineMock).toHaveBeenCalledWith(mockDb, {
        issueId: 'issue-1',
        name: 'Shoulder Pain Routine',
        items: [{ exerciseId: 'face-pull', targetSets: 2, targetReps: 15, note: 'Light' }],
      }),
    );
    await waitFor(() => expect(getByTestId('run-issue-routine-btn')).toBeTruthy());
    expect(getByText('Shoulder Pain Routine')).toBeTruthy();
  });

  it('creates a new Issue with routine options before the first save', async () => {
    mockRouteParams = undefined;
    createIssueMock.mockImplementationOnce(async (_db, input) => ({
      id: 'issue-created',
      name: input.name,
      note: input.note?.trim() ? input.note.trim() : null,
      active: 1,
      created_at: 1,
      updated_at: 1,
    }));

    const { getByTestId } = render(<IssueDetail />);

    fireEvent.changeText(getByTestId('issue-name-input'), ' Knee Pain ');
    fireEvent.changeText(getByTestId('issue-note-input'), ' Front of knee ');
    fireEvent.press(getByTestId('initial-issue-severity-4'));
    fireEvent.press(getByTestId('create-issue-routine-btn'));
    fireEvent.press(getByTestId('add-routine-exercise-btn'));
    fireEvent.press(getByTestId('mock-picker-select-face-pull'));
    fireEvent.changeText(getByTestId(/^routine-target-sets-/), '3');
    fireEvent.changeText(getByTestId(/^routine-target-reps-/), '12');
    fireEvent.changeText(getByTestId(/^routine-note-/), 'Pain-free range');
    fireEvent.press(getByTestId('save-issue-routine-btn'));

    await waitFor(() => expect(getByTestId('issue-routine-summary')).toBeTruthy());
    fireEvent.press(getByTestId('save-issue-btn'));

    await waitFor(() =>
      expect(createIssueMock).toHaveBeenCalledWith(mockDb, {
        name: 'Knee Pain',
        note: ' Front of knee ',
      }),
    );
    expect(createIssueCheckinMock).toHaveBeenCalledWith(mockDb, {
      issueId: 'issue-created',
      severity: 4,
      note: null,
    });
    expect(createIssueRoutineMock).toHaveBeenCalledWith(mockDb, {
      issueId: 'issue-created',
      name: 'Knee Pain Routine',
      items: [
        {
          exerciseId: 'face-pull',
          targetSets: 3,
          targetReps: 12,
          note: 'Pain-free range',
        },
      ],
    });
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });

  it('keeps the existing Issue Routine edit flow working', async () => {
    routine = {
      id: 'routine-1',
      issue_id: 'issue-1',
      template_id: 'template-routine',
      routine_name: 'Shoulder Pain Routine',
      routine_note: null,
      exercise_count: 1,
      last_completed_at: null,
      created_at: 1,
      updated_at: 1,
    };
    routineItems = [
      {
        id: 'routine-item-1',
        template_id: 'template-routine',
        exercise_id: 'face-pull',
        exercise_name: 'Face Pull',
        exercise_category: 'cable',
        exercise_default_unit: 'kg',
        exercise_movement_pattern: null,
        exercise_body_region: null,
        exercise_mechanics: null,
        exercise_equipment_json: null,
        position: 0,
        target_sets: 2,
        target_reps: 15,
        target_weight: null,
        target_rpe: null,
        rest_seconds: null,
        note: 'Light',
        progression_rule: 'none',
        increment_kg: null,
        increment_lb: null,
        rep_range_min: null,
        rep_range_max: null,
        rpe_cap: null,
        amrap_last_set: 0,
      },
    ];

    const { getByTestId } = render(<IssueDetail />);

    await waitFor(() => expect(getByTestId('edit-issue-routine-btn')).toBeTruthy());
    fireEvent.press(getByTestId('edit-issue-routine-btn'));
    fireEvent.changeText(getByTestId('routine-name-input'), 'Updated Shoulder Routine');
    fireEvent.changeText(getByTestId(/^routine-target-sets-/), '3');
    fireEvent.changeText(getByTestId(/^routine-target-reps-/), '12');
    fireEvent.changeText(getByTestId(/^routine-note-/), 'Slow tempo');
    fireEvent.press(getByTestId('save-issue-routine-btn'));

    await waitFor(() =>
      expect(updateIssueRoutineMock).toHaveBeenCalledWith(mockDb, 'issue-1', {
        name: 'Updated Shoulder Routine',
        items: [
          {
            exerciseId: 'face-pull',
            targetSets: 3,
            targetReps: 12,
            note: 'Slow tempo',
          },
        ],
      }),
    );
  });

  it('runs an Issue Routine through LiveWorkout with the linked template', async () => {
    routine = {
      id: 'routine-1',
      issue_id: 'issue-1',
      template_id: 'template-routine',
      routine_name: 'Shoulder Pain Routine',
      routine_note: null,
      exercise_count: 1,
      last_completed_at: null,
      created_at: 1,
      updated_at: 1,
    };

    const { getByTestId } = render(<IssueDetail />);

    await waitFor(() => expect(getByTestId('run-issue-routine-btn')).toBeTruthy());
    fireEvent.press(getByTestId('run-issue-routine-btn'));

    expect(mockNavigate).toHaveBeenCalledWith('LiveWorkout', { templateId: 'template-routine' });
  });

  it('removes an Issue Routine from Issue detail without deleting the Issue', async () => {
    routine = {
      id: 'routine-1',
      issue_id: 'issue-1',
      template_id: 'template-routine',
      routine_name: 'Shoulder Pain Routine',
      routine_note: null,
      exercise_count: 1,
      last_completed_at: null,
      created_at: 1,
      updated_at: 1,
    };
    removeIssueRoutineMock.mockImplementationOnce(async () => {
      routine = null;
      routineItems = [];
    });
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      buttons?.find((button) => button.text === 'Remove')?.onPress?.();
    });

    const { getByTestId, queryByText } = render(<IssueDetail />);

    await waitFor(() => expect(getByTestId('remove-issue-routine-btn')).toBeTruthy());
    fireEvent.press(getByTestId('remove-issue-routine-btn'));

    expect(alertSpy).toHaveBeenCalledWith(
      'Remove this routine?',
      'This removes the routine from this Issue.\nIt does not delete your logged workouts or exercise history.',
      expect.any(Array),
    );
    await waitFor(() => expect(removeIssueRoutineMock).toHaveBeenCalledWith(mockDb, 'issue-1'));
    await waitFor(() => expect(queryByText('Shoulder Pain Routine')).toBeNull());
    expect(getIssueByIdMock).toHaveBeenCalledWith(mockDb, 'issue-1');

    alertSpy.mockRestore();
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
