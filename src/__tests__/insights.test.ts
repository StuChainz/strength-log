import { generateWeeklyInsight, type InsightSession } from '@/insights/generator';

function session(id: string, tagged: boolean, volume: number): InsightSession {
  return {
    id,
    startedAt: 1,
    tags: tagged ? ['evening_session'] : [],
    metrics: { session_volume: volume, energy_rating: null },
  };
}

describe('generateWeeklyInsight', () => {
  it('creates deterministic copy for synthetic evening-session data', () => {
    const sessions = [
      session('t1', true, 120),
      session('t2', true, 122),
      session('t3', true, 124),
      session('t4', true, 126),
      session('o1', false, 100),
      session('o2', false, 102),
      session('o3', false, 104),
      session('o4', false, 106),
    ];

    const card = generateWeeklyInsight(sessions, 1000);

    expect(card?.title).toBe('Evening volume pattern');
    expect(card?.body).toContain('evening sessions averaged 19% higher volume');
    expect(card?.sampleSize).toBe(8);
  });

  it('skips when there is insufficient data', () => {
    expect(generateWeeklyInsight([
      session('t1', true, 120),
      session('o1', false, 100),
    ], 1000)).toBeNull();
  });

  it('keeps generated copy free of banned causal or advice words', () => {
    const sessions = [
      session('t1', true, 120),
      session('t2', true, 122),
      session('t3', true, 124),
      session('t4', true, 126),
      session('o1', false, 100),
      session('o2', false, 102),
      session('o3', false, 104),
      session('o4', false, 106),
    ];
    const card = generateWeeklyInsight(sessions, 1000);
    const banned = /\b(cause|causes|causing|should|must|try)\b/i;

    expect(card?.body).not.toMatch(banned);
    expect((card?.body.match(/[.!?]/g) ?? []).length).toBeLessThanOrEqual(3);
  });
});
