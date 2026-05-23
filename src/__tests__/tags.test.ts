import { savePostSessionDetails } from '@/db/repositories/tags.repo';

describe('savePostSessionDetails', () => {
  it('replaces tags and writes summary metrics', async () => {
    const writes: { sql: string; params: unknown[] }[] = [];
    const db = {
      runAsync: jest.fn(async (sql: string, params: unknown[] = []) => {
        writes.push({ sql, params });
        return { lastInsertRowId: 0, changes: 1 };
      }),
      withTransactionAsync: jest.fn(async (task: () => Promise<void>) => task()),
    };

    await savePostSessionDetails(db as never, {
      sessionId: 'session-1',
      tags: ['evening_session', 'felt_strong'],
      energyRating: 8,
      note: 'Good day',
      metrics: {
        volume: 1200,
        durationMin: 45,
        setCount: 9,
        sampledAt: 123,
      },
    });

    expect(writes[0].sql).toMatch(/DELETE FROM post_session_tags/i);
    expect(writes.some((write) => write.params.includes('tag.evening_session'))).toBe(true);
    expect(writes.some((write) => write.params.includes('session_volume'))).toBe(true);
    expect(writes.some((write) => write.params.includes('energy_rating'))).toBe(true);
  });
});
