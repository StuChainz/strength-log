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
  it('returns the newest in-progress session and discards older duplicates', async () => {
    const rows = [session('new', 200), session('old', 100)];
    const writes: string[] = [];
    const db = {
      getAllAsync: jest.fn(async () => rows),
      runAsync: jest.fn(async (sql: string) => {
        writes.push(sql);
        return { lastInsertRowId: 0, changes: 1 };
      }),
      withTransactionAsync: jest.fn(async (task: () => Promise<void>) => task()),
    };

    const recovered = await getInProgressSession(db as never);

    expect(recovered?.id).toBe('new');
    expect(writes.some((sql) => sql.includes("status = 'discarded'"))).toBe(true);
    expect(writes.some((sql) => sql.includes("'session_discarded'"))).toBe(true);
  });
});
