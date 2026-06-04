import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import Home from '@/screens/Home';
import { openDb } from '@/db/client';
import { getNormalTemplatesWithCount } from '@/db/repositories/templates.repo';
import { discardSession, getSessionRecovery } from '@/db/repositories/sessions.repo';
import { getTrainingVolumeReport } from '@/db/repositories/trainingVolume.repo';
import { dismissInsightCard, maybeGenerateWeeklyInsight } from '@/db/repositories/insights.repo';

const NOW = new Date('2026-06-02T12:00:00Z').getTime();
const mockNavigate = jest.fn();
const mockDb = {
  getAllAsync: jest.fn(),
};

type QueryRow = Record<string, unknown>;

let recentRows: QueryRow[] = [];
let templateLastUsedRows: QueryRow[] = [];
let trainingTotalsRows: QueryRow[] = [];
let activeExerciseRows: QueryRow[] = [];
let activeTemplateRows: QueryRow[] = [];
let recentMuscleRows: QueryRow[] = [];

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate }),
  useFocusEffect: (cb: () => void) => {
    const ReactActual = jest.requireActual('react') as typeof import('react');
    ReactActual.useEffect(() => cb(), [cb]);
  },
}));

jest.mock('@/db/client', () => ({
  openDb: jest.fn().mockResolvedValue(mockDb),
}));

jest.mock('@/db/repositories/templates.repo', () => ({
  getNormalTemplatesWithCount: jest.fn(),
}));

jest.mock('@/db/repositories/sessions.repo', () => ({
  getSessionRecovery: jest.fn(),
  discardSession: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/db/repositories/tags.repo', () => ({
  getUntaggedCompletedSession: jest.fn().mockResolvedValue(null),
}));

jest.mock('@/db/repositories/trainingVolume.repo', () => ({
  ...jest.requireActual('@/db/repositories/trainingVolume.repo'),
  getTrainingVolumeReport: jest.fn(),
}));

jest.mock('@/db/repositories/insights.repo', () => ({
  dismissInsightCard: jest.fn().mockResolvedValue(undefined),
  maybeGenerateWeeklyInsight: jest.fn().mockResolvedValue(null),
}));

const openDbMock = openDb as jest.MockedFunction<typeof openDb>;
const getNormalTemplatesWithCountMock = getNormalTemplatesWithCount as jest.MockedFunction<
  typeof getNormalTemplatesWithCount
>;
const getSessionRecoveryMock = getSessionRecovery as jest.MockedFunction<typeof getSessionRecovery>;
const discardSessionMock = discardSession as jest.MockedFunction<typeof discardSession>;
const getTrainingVolumeReportMock = getTrainingVolumeReport as jest.MockedFunction<
  typeof getTrainingVolumeReport
>;
const dismissInsightCardMock = dismissInsightCard as jest.MockedFunction<typeof dismissInsightCard>;
const maybeGenerateWeeklyInsightMock = maybeGenerateWeeklyInsight as jest.MockedFunction<
  typeof maybeGenerateWeeklyInsight
>;

const activeSession = {
  id: 'active-session',
  template_id: 'template-push',
  name: 'Push Day A',
  status: 'in_progress' as const,
  started_at: NOW - 90 * 60_000,
  ended_at: null,
  total_volume_cached: null,
  created_at: NOW - 90 * 60_000,
  updated_at: NOW - 24 * 60_000,
};

const weeklyInsightCard = {
  id: 'insight-week-1',
  generated_for_week_start: NOW - 24 * 60 * 60_000,
  title: 'Sleep changed your sessions',
  body: 'Workouts tagged after poor sleep had lower volume than your other recent workouts.',
  sample_size: 12,
  confidence_label: 'medium' as const,
  payload_json: null,
  dismissed_at: null,
  created_at: NOW,
};

function collectTestIds(node: unknown): string[] {
  if (!node || typeof node !== 'object') return [];
  const record = node as {
    props?: { testID?: string };
    children?: unknown[];
  };
  return [
    ...(record.props?.testID ? [record.props.testID] : []),
    ...(record.children?.flatMap(collectTestIds) ?? []),
  ];
}

function configureDbMock() {
  mockDb.getAllAsync.mockImplementation((sql: string) => {
    if (sql.includes('FROM workout_sessions sess') && sql.includes('LIMIT 5')) {
      return Promise.resolve(recentRows);
    }
    if (sql.includes('MAX(ended_at) AS last_used_at')) {
      return Promise.resolve(templateLastUsedRows);
    }
    if (sql.includes('COUNT(DISTINCT sess.id) AS session_count')) {
      return Promise.resolve(trainingTotalsRows);
    }
    if (sql.includes('GROUP BY ws.exercise_id')) {
      return Promise.resolve(activeExerciseRows);
    }
    if (sql.includes('FROM template_items ti')) {
      return Promise.resolve(activeTemplateRows);
    }
    if (sql.includes('ws.session_id IN') && sql.includes('em.primary_muscles_json')) {
      return Promise.resolve(recentMuscleRows);
    }
    return Promise.resolve([]);
  });
}

describe('Home screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Date, 'now').mockReturnValue(NOW);
    openDbMock.mockResolvedValue(mockDb as never);
    getNormalTemplatesWithCountMock.mockResolvedValue([
      {
        id: 'template-push',
        name: 'Push A',
        notes: null,
        archived_at: null,
        created_at: 1,
        updated_at: 1,
        item_count: 5,
        working_set_count: 16,
      },
      {
        id: 'template-pull',
        name: 'Pull B',
        notes: null,
        archived_at: null,
        created_at: 1,
        updated_at: 1,
        item_count: 6,
        working_set_count: 18,
      },
    ]);
    getSessionRecoveryMock.mockResolvedValue({ status: 'none', sessions: [] });
    getTrainingVolumeReportMock.mockResolvedValue({
      window: {
        id: '7d',
        title: 'Training Volume (Last 7 Days)',
        label: '7D',
        days: 7,
        startAt: NOW - 7 * 24 * 60 * 60 * 1000,
        endAt: NOW,
      },
      muscles: [
        {
          muscle: 'chest',
          totalExposure: 18,
          directContribution: 18,
          indirectContribution: 0,
          directSources: [],
          indirectSources: [],
        },
        {
          muscle: 'triceps',
          totalExposure: 12,
          directContribution: 6,
          indirectContribution: 6,
          directSources: [],
          indirectSources: [],
        },
      ],
    });
    maybeGenerateWeeklyInsightMock.mockResolvedValue(null);
    recentRows = [];
    templateLastUsedRows = [{ template_id: 'template-push', last_used_at: NOW - 24 * 60 * 60_000 }];
    trainingTotalsRows = [{ session_count: 3, set_count: 56, total_volume: 23_500 }];
    activeExerciseRows = [];
    activeTemplateRows = [];
    recentMuscleRows = [];
    configureDbMock();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the no active workout state with the large Start Workout action', async () => {
    render(<Home />);

    await waitFor(() => expect(screen.getByText('Set')).toBeTruthy());
    expect(screen.queryByTestId('active-workout-card')).toBeNull();
    expect(screen.getByTestId('start-workout-btn')).toBeTruthy();
    expect(screen.getByTestId('home-injuries-btn')).toBeTruthy();
    expect(screen.getByTestId('home-settings-btn')).toBeTruthy();
    expect(screen.queryByText('Resume Workout')).toBeNull();
  });

  it('places the weekly What Changed card below Start Workout and above secondary cards', async () => {
    maybeGenerateWeeklyInsightMock.mockResolvedValue(weeklyInsightCard);

    const { toJSON } = render(<Home />);

    await waitFor(() => expect(screen.getByTestId('weekly-what-changed-card')).toBeTruthy());
    expect(screen.getByText('What Changed?')).toBeTruthy();
    expect(screen.getByText('Sleep changed your sessions')).toBeTruthy();

    const testIds = collectTestIds(toJSON());
    expect(testIds.indexOf('start-workout-btn')).toBeLessThan(
      testIds.indexOf('weekly-what-changed-card'),
    );
    expect(testIds.indexOf('weekly-what-changed-card')).toBeLessThan(
      testIds.indexOf('template-card-template-push'),
    );
    expect(screen.getAllByTestId('weekly-what-changed-card')).toHaveLength(1);
  });

  it('keeps the active workout card first when the weekly What Changed card is visible', async () => {
    maybeGenerateWeeklyInsightMock.mockResolvedValue(weeklyInsightCard);
    getSessionRecoveryMock.mockResolvedValue({
      status: 'active',
      session: activeSession,
      sessions: [activeSession],
    });

    const { toJSON } = render(<Home />);

    await waitFor(() => expect(screen.getByTestId('active-workout-card')).toBeTruthy());
    await waitFor(() => expect(screen.getByTestId('weekly-what-changed-card')).toBeTruthy());

    const testIds = collectTestIds(toJSON());
    expect(testIds.indexOf('active-workout-card')).toBeLessThan(
      testIds.indexOf('start-workout-btn'),
    );
    expect(testIds.indexOf('start-workout-btn')).toBeLessThan(
      testIds.indexOf('weekly-what-changed-card'),
    );
  });

  it('hides the weekly What Changed card when there is insufficient insight data', async () => {
    maybeGenerateWeeklyInsightMock.mockResolvedValue(null);

    render(<Home />);

    await waitFor(() => expect(screen.getByTestId('start-workout-btn')).toBeTruthy());
    expect(screen.queryByTestId('weekly-what-changed-card')).toBeNull();
    expect(screen.queryByText('What Changed?')).toBeNull();
  });

  it('dismisses the weekly What Changed card without deleting source data', async () => {
    maybeGenerateWeeklyInsightMock.mockResolvedValue(weeklyInsightCard);

    render(<Home />);

    await waitFor(() => expect(screen.getByTestId('weekly-what-changed-card')).toBeTruthy());
    fireEvent.press(screen.getByTestId('dismiss-weekly-what-changed'));

    await waitFor(() =>
      expect(dismissInsightCardMock).toHaveBeenCalledWith(
        mockDb,
        'insight-week-1',
        expect.any(Number),
      ),
    );
    expect(screen.queryByTestId('weekly-what-changed-card')).toBeNull();
  });

  it('renders active workout details in a compact card', async () => {
    getSessionRecoveryMock.mockResolvedValue({
      status: 'active',
      session: activeSession,
      sessions: [activeSession],
    });
    activeExerciseRows = [
      {
        exercise_id: 'bench',
        exercise_name: 'Bench Press',
        logged_sets: 3,
        last_logged_at: NOW - 24 * 60_000,
        first_position: 2,
      },
    ];
    activeTemplateRows = [
      { exercise_id: 'incline', exercise_name: 'Incline Press' },
      { exercise_id: 'fly', exercise_name: 'Cable Fly' },
      { exercise_id: 'bench', exercise_name: 'Bench Press' },
      { exercise_id: 'press', exercise_name: 'Shoulder Press' },
      { exercise_id: 'pushdown', exercise_name: 'Pushdown' },
      { exercise_id: 'raise', exercise_name: 'Lateral Raise' },
    ];

    render(<Home />);

    await waitFor(() => expect(screen.getByTestId('active-workout-card')).toBeTruthy());
    expect(screen.getByText('Push Day A')).toBeTruthy();
    expect(screen.getByText('Exercise 3 of 6 · Bench Press')).toBeTruthy();
    expect(screen.getByText('3 sets logged')).toBeTruthy();
    expect(screen.getByText(/24m ago/)).toBeTruthy();
  });

  it('navigates to the active session from Resume Workout', async () => {
    getSessionRecoveryMock.mockResolvedValue({
      status: 'active',
      session: activeSession,
      sessions: [activeSession],
    });

    render(<Home />);

    await waitFor(() => expect(screen.getByTestId('resume-workout-btn')).toBeTruthy());
    fireEvent.press(screen.getByTestId('resume-workout-btn'));

    expect(mockNavigate).toHaveBeenCalledWith('LiveWorkout', { sessionId: 'active-session' });
  });

  it('keeps Start Workout available and starts from the next template', async () => {
    getSessionRecoveryMock.mockResolvedValue({
      status: 'active',
      session: activeSession,
      sessions: [activeSession],
    });

    render(<Home />);

    await waitFor(() => expect(screen.getByTestId('start-workout-btn')).toBeTruthy());
    fireEvent.press(screen.getByTestId('start-workout-btn'));

    expect(mockNavigate).toHaveBeenCalledWith('LiveWorkout', { templateId: 'template-push' });
  });

  it('renders Training Volume with sessions, sets, tonnes, and coloured muscle rows', async () => {
    render(<Home />);

    await waitFor(() => expect(screen.getByTestId('training-volume-card')).toBeTruthy());
    expect(screen.getByText('TRAINING VOLUME · PAST 7 DAYS')).toBeTruthy();
    expect(screen.getByText('Sessions')).toBeTruthy();
    expect(screen.getByText('Sets')).toBeTruthy();
    expect(screen.getByText('23.5 tonnes')).toBeTruthy();
    expect(screen.queryByText('23.5k')).toBeNull();
    expect(screen.getByText('Chest')).toBeTruthy();
    expect(screen.getByText('Triceps')).toBeTruthy();
  });

  it('renders recent workouts with summary metrics, PR badge, and muscle chips', async () => {
    recentRows = [
      {
        id: 'session-1',
        name: 'Push A',
        started_at: NOW - 24 * 60 * 60_000,
        ended_at: NOW - 24 * 60 * 60_000 + 47 * 60_000,
        total_volume_cached: 7420,
        set_count: 17,
        pr_count: 2,
      },
    ];
    recentMuscleRows = [
      {
        session_id: 'session-1',
        exercise_id: 'bench',
        exercise_name: 'Bench Press',
        set_type: 'working',
        is_warmup: 0,
        deleted_at: null,
        primary_muscles_json: '["chest"]',
        secondary_muscles_json: '["triceps","front_delts"]',
        tertiary_muscles_json: null,
      },
      {
        session_id: 'session-1',
        exercise_id: 'bench',
        exercise_name: 'Bench Press',
        set_type: 'working',
        is_warmup: 0,
        deleted_at: null,
        primary_muscles_json: '["chest"]',
        secondary_muscles_json: '["triceps","front_delts"]',
        tertiary_muscles_json: null,
      },
    ];
    configureDbMock();

    render(<Home />);

    await waitFor(() => expect(screen.getByTestId('recent-workout-session-1')).toBeTruthy());
    expect(screen.getAllByText('Push A').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Yesterday · 47m')).toBeTruthy();
    expect(screen.getByText('7,420 kg')).toBeTruthy();
    expect(screen.getByText('17 sets')).toBeTruthy();
    expect(screen.getByText(/2 PRs/)).toBeTruthy();
    expect(screen.getByText('Chest 2')).toBeTruthy();
    expect(screen.getByText('Triceps 1')).toBeTruthy();

    fireEvent.press(screen.getByTestId('recent-workout-session-1'));
    expect(mockNavigate).toHaveBeenCalledWith('WorkoutDetails', { sessionId: 'session-1' });
  });

  it('renders templates with exercise count, last used, and tap navigation', async () => {
    render(<Home />);

    await waitFor(() => expect(screen.getByTestId('template-card-template-push')).toBeTruthy());
    expect(screen.getByText('Push A')).toBeTruthy();
    expect(screen.getByText('5 exercises')).toBeTruthy();
    expect(screen.getByText('Used yesterday')).toBeTruthy();

    fireEvent.press(screen.getByTestId('template-card-template-push'));
    expect(mockNavigate).toHaveBeenCalledWith('LiveWorkout', { templateId: 'template-push' });
  });

  it('opens Injuries and Settings from the home header actions', async () => {
    render(<Home />);

    await waitFor(() => expect(screen.getByTestId('home-injuries-btn')).toBeTruthy());

    fireEvent.press(screen.getByTestId('home-injuries-btn'));
    fireEvent.press(screen.getByTestId('home-settings-btn'));

    expect(mockNavigate).toHaveBeenCalledWith('Issues');
    expect(mockNavigate).toHaveBeenCalledWith('Settings');
  });

  it('opens feedback from the home overflow menu', async () => {
    render(<Home />);

    await waitFor(() => expect(screen.getByTestId('home-overflow-btn')).toBeTruthy());
    fireEvent.press(screen.getByTestId('home-overflow-btn'));
    fireEvent.press(screen.getByTestId('home-overflow-feedback'));

    expect(screen.getByTestId('feedback-modal')).toBeTruthy();
  });

  it('discards the active workout through the secondary action', async () => {
    getSessionRecoveryMock.mockResolvedValue({
      status: 'active',
      session: activeSession,
      sessions: [activeSession],
    });

    render(<Home />);

    await waitFor(() => expect(screen.getByTestId('discard-workout-btn')).toBeTruthy());
    fireEvent.press(screen.getByTestId('discard-workout-btn'));

    await waitFor(() => expect(discardSessionMock).toHaveBeenCalledWith(mockDb, 'active-session'));
  });
});
