import { getInProgressSession } from '@/db/repositories/sessions.repo';
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
  it('returns the newest in-progress session and leaves older sessions untouched', async () => {
    const rows = [session('new', 200), session('old', 100)];
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const db = {
      getAllAsync: jest.fn(async () => rows),
      runAsync: jest.fn(),
      withTransactionAsync: jest.fn(async (task: () => Promise<void>) => task()),
    };

    const recovered = await getInProgressSession(db as never);

    expect(recovered?.id).toBe('new');
    expect(db.runAsync).not.toHaveBeenCalled();
    expect(db.withTransactionAsync).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      '[sessions] Multiple in-progress sessions found; leaving older sessions intact',
      { keptSessionId: 'new', olderSessionIds: ['old'] },
    );
    warnSpy.mockRestore();
  });
});
