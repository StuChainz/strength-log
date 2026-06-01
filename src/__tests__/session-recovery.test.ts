import {
  getInProgressSession,
  getSessionRecovery,
  STALE_IN_PROGRESS_SESSION_MS,
} from '@/db/repositories/sessions.repo';
import type { WorkoutSession } from '@/domain/types';

function session(id: string, startedAt: number): WorkoutSession {
  return {
    id,
    template_id: null,
    name: null,
    status: 'in_progress',
    started_at: startedAt,
    ended_at: null,
    total_volume_cached: null,
    created_at: startedAt,
    updated_at: startedAt,
  };
}

describe('session recovery', () => {
  it('returns the newest in-progress session without mutating older duplicates', async () => {
    const rows = [session('new', 200), session('old', 100)];
    const writes: string[] = [];
    const db = {
      getFirstAsync: jest.fn(async () => rows[0]),
      runAsync: jest.fn(async (sql: string) => {
        writes.push(sql);
        return { lastInsertRowId: 0, changes: 1 };
      }),
      withTransactionAsync: jest.fn(async (task: () => Promise<void>) => task()),
    };

    const recovered = await getInProgressSession(db as never);

    expect(recovered?.id).toBe('new');
    expect(writes).toEqual([]);
  });

  it('classifies no active session', async () => {
    const db = { getAllAsync: jest.fn(async () => []) };

    await expect(getSessionRecovery(db as never, 1_000)).resolves.toEqual({
      status: 'none',
      sessions: [],
    });
  });

  it('classifies a fresh active session', async () => {
    const active = session('active', 1_000);
    const db = { getAllAsync: jest.fn(async () => [active]) };

    await expect(getSessionRecovery(db as never, 2_000)).resolves.toEqual({
      status: 'active',
      session: active,
      sessions: [active],
    });
  });

  it('classifies a stale session older than 12 hours', async () => {
    const stale = session('stale', 1_000);
    const db = { getAllAsync: jest.fn(async () => [stale]) };

    await expect(
      getSessionRecovery(db as never, 1_000 + STALE_IN_PROGRESS_SESSION_MS + 1),
    ).resolves.toEqual({
      status: 'stale',
      session: stale,
      sessions: [stale],
    });
  });

  it('classifies multiple active sessions without discarding any', async () => {
    const newest = session('new', 200);
    const older = session('old', 100);
    const db = {
      getAllAsync: jest.fn(async () => [newest, older]),
      runAsync: jest.fn(),
    };

    await expect(getSessionRecovery(db as never, 1_000)).resolves.toEqual({
      status: 'multiple_active',
      session: newest,
      sessions: [newest, older],
    });
    expect(db.runAsync).not.toHaveBeenCalled();
  });
});
