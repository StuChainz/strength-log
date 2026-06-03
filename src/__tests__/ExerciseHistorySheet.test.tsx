import { render, waitFor } from '@testing-library/react-native';
import ExerciseHistorySheet from '@/screens/ExerciseHistorySheet';
import { openDb } from '@/db/client';
import { getExerciseHistory } from '@/db/repositories/history.repo';
import { getExerciseIssueSummary } from '@/db/repositories/issues.repo';

const mockDb = {};

jest.mock('@/db/client', () => ({
  openDb: jest.fn().mockResolvedValue(mockDb),
}));

jest.mock('@/db/repositories/history.repo', () => ({
  getExerciseHistory: jest.fn(),
}));

jest.mock('@/db/repositories/issues.repo', () => ({
  getExerciseIssueSummary: jest.fn(),
}));

const openDbMock = openDb as jest.MockedFunction<typeof openDb>;
const getExerciseHistoryMock = getExerciseHistory as jest.MockedFunction<typeof getExerciseHistory>;
const getExerciseIssueSummaryMock = getExerciseIssueSummary as jest.MockedFunction<
  typeof getExerciseIssueSummary
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
      },
    ]);
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
  });
});
