import { createFeedbackPayload, formatFeedbackPayload } from '@/feedback/payload';

const NOW = new Date('2026-06-04T16:30:00Z').getTime();

const activeSession = {
  id: 'active-session',
  template_id: 'template-private',
  name: "Stu's private push day",
  status: 'in_progress' as const,
  started_at: NOW - 42 * 60_000,
  ended_at: null,
  total_volume_cached: null,
  created_at: NOW - 42 * 60_000,
  updated_at: NOW - 3 * 60_000,
};

function createMockDb(activeSessions = [activeSession]) {
  return {
    getAllAsync: jest.fn((sql: string) => {
      if (sql.includes("WHERE status = 'in_progress'")) {
        return Promise.resolve(activeSessions);
      }
      return Promise.resolve([]);
    }),
    getFirstAsync: jest.fn((sql: string) => {
      const normalized = sql.replace(/\s+/g, ' ');

      if (normalized.includes('COUNT(id) AS setCount')) {
        return Promise.resolve({
          setCount: 5,
          exerciseCount: 2,
          lastSetLoggedAt: NOW - 4 * 60_000,
        });
      }

      if (normalized.includes("WHERE status = 'completed' ORDER BY ended_at DESC")) {
        return Promise.resolve({ id: 'completed-session-9' });
      }

      if (normalized.includes('FROM workout_events WHERE created_at >= ?')) {
        return Promise.resolve({ value: 7 });
      }

      if (normalized.includes("FROM workout_sessions WHERE status = 'in_progress'")) {
        return Promise.resolve({ value: activeSessions.length });
      }

      if (normalized.includes("FROM workout_sessions WHERE status = 'completed'")) {
        return Promise.resolve({ value: 12 });
      }

      if (normalized.includes('FROM workout_sessions')) return Promise.resolve({ value: 14 });
      if (normalized.includes('FROM workout_sets')) return Promise.resolve({ value: 128 });
      if (normalized.includes('FROM workout_events')) return Promise.resolve({ value: 211 });
      if (normalized.includes('FROM templates')) return Promise.resolve({ value: 6 });
      if (normalized.includes('FROM exercises')) return Promise.resolve({ value: 94 });

      return Promise.resolve(null);
    }),
  };
}

describe('feedback payload', () => {
  it('generates useful app, device, route, workout, and diagnostic JSON', async () => {
    const db = createMockDb();

    const payload = await createFeedbackPayload(
      db as never,
      {
        feedbackType: 'Bug',
        message: '  Save button froze  ',
        currentRoute: 'LiveWorkout',
        source: 'home_overflow',
      },
      NOW,
    );

    expect(payload).toMatchObject({
      schemaVersion: 1,
      createdAt: '2026-06-04T16:30:00.000Z',
      feedbackType: 'Bug',
      message: 'Save button froze',
      app: {
        version: '1.0.0',
        buildNumber: '10',
      },
      device: {
        model: 'Apple iPhone',
        isDevice: true,
      },
      context: {
        currentRoute: 'LiveWorkout',
        source: 'home_overflow',
      },
      workout: {
        lastCompletedWorkoutId: 'completed-session-9',
      },
      recentDiagnosticReport: {
        databaseReachable: true,
        activeRecoveryStatus: 'active',
        recentWorkoutEventCount: 7,
      },
    });
    expect(JSON.parse(formatFeedbackPayload(payload))).toEqual(payload);
  });

  it('does not leak automatic names, notes, tags, or exercise labels', async () => {
    const db = createMockDb();

    const payload = await createFeedbackPayload(
      db as never,
      {
        feedbackType: 'Suggestion',
        message: '',
        currentRoute: 'Settings',
        source: 'settings',
      },
      NOW,
    );

    const json = formatFeedbackPayload(payload);
    expect(json).not.toContain("Stu's private push day");
    expect(json).not.toContain('Bench Press');
    expect(json).not.toContain('felt weak');
    expect(json).not.toContain('sleep_short');
  });

  it('includes active workout state without requiring workout content', async () => {
    const db = createMockDb();

    const payload = await createFeedbackPayload(
      db as never,
      {
        feedbackType: 'Question',
        message: 'Where did my set go?',
        currentRoute: 'LiveWorkout',
        source: 'workout_summary',
      },
      NOW,
    );

    expect(payload.workout.activeWorkoutState).toMatchObject({
      status: 'active',
      activeSessionCount: 1,
      sessionId: 'active-session',
      templateId: 'template-private',
      sessionStatus: 'in_progress',
      elapsedMinutes: 42,
      setCount: 5,
      exerciseCount: 2,
      lastSetLoggedAt: '2026-06-04T16:26:00.000Z',
    });
  });

  it('allows an empty message', async () => {
    const db = createMockDb([]);

    const payload = await createFeedbackPayload(
      db as never,
      {
        feedbackType: 'Bug',
        message: '',
        currentRoute: 'Settings',
        source: 'settings',
      },
      NOW,
    );

    expect(payload.message).toBe('');
    expect(payload.workout.activeWorkoutState.status).toBe('none');
    expect(formatFeedbackPayload(payload)).toContain('"message": ""');
  });
});
