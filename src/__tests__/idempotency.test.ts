/**
 * Idempotency constraint tests.
 *
 * Verifies that the sets and events repositories use INSERT OR IGNORE,
 * ensuring that retrying a write after a crash never produces duplicate rows.
 */

import { insertSet } from '@/db/repositories/sets.repo';
import { insertEvent } from '@/db/repositories/events.repo';
import { newId } from '@/domain/ids';

// ─── Minimal mock DB ──────────────────────────────────────────────────────────

function createMockDb() {
  const rows: { sql: string; params: unknown[] }[] = [];

  return {
    _rows: rows,
    runAsync: jest.fn(async (sql: string, params: unknown[] = []) => {
      rows.push({ sql, params });
      return { lastInsertRowId: 1, changes: 1 };
    }),
    getFirstAsync: jest.fn(async () => null),
    getAllAsync: jest.fn(async () => []),
    execAsync: jest.fn(async () => {}),
    withTransactionAsync: jest.fn(async (task: () => Promise<void>) => task()),
  };
}

// ─── Sets repo ────────────────────────────────────────────────────────────────

describe('insertSet — idempotency', () => {
  it('uses INSERT OR IGNORE (not plain INSERT)', async () => {
    const db = createMockDb();
    await insertSet(db as never, {
      id: newId(),
      session_id: newId(),
      exercise_id: newId(),
      position: 0,
      weight: 100,
      reps: 5,
      rpe: null,
      unit: 'kg',
      is_warmup: 0,
      logged_at: Date.now(),
      source: 'tap',
      client_set_id: newId(),
    });

    const call = db._rows[0];
    expect(call).toBeDefined();
    expect(call.sql).toMatch(/INSERT OR IGNORE/i);
    expect(call.sql).toMatch(/workout_sets/i);
  });

  it('includes client_set_id as the last bound parameter', async () => {
    const db = createMockDb();
    const clientSetId = newId();

    await insertSet(db as never, {
      id: newId(),
      session_id: newId(),
      exercise_id: newId(),
      position: 0,
      weight: 80,
      reps: 8,
      rpe: 7,
      unit: 'kg',
      is_warmup: 0,
      logged_at: Date.now(),
      source: 'tap',
      client_set_id: clientSetId,
    });

    const params = db._rows[0].params as string[];
    expect(params[params.length - 1]).toBe(clientSetId);
  });

  it('calling twice with the same client_set_id produces two DB calls but both use OR IGNORE', async () => {
    const db = createMockDb();
    const sharedClientSetId = newId();

    const input = {
      id: newId(),
      session_id: newId(),
      exercise_id: newId(),
      position: 0,
      weight: 100,
      reps: 5,
      rpe: null,
      unit: 'kg' as const,
      is_warmup: 0 as const,
      logged_at: Date.now(),
      source: 'tap' as const,
      client_set_id: sharedClientSetId,
    };

    await insertSet(db as never, input);
    await insertSet(db as never, input);

    expect(db._rows).toHaveLength(2);
    db._rows.forEach((row) => {
      expect(row.sql).toMatch(/INSERT OR IGNORE/i);
    });
    // In a real SQLite DB, only the first insert would produce a row —
    // OR IGNORE silently discards the duplicate.
  });
});

// ─── Events repo ─────────────────────────────────────────────────────────────

describe('insertEvent — idempotency', () => {
  it('uses INSERT OR IGNORE (not plain INSERT)', async () => {
    const db = createMockDb();
    await insertEvent(db as never, {
      id: newId(),
      session_id: newId(),
      event_type: 'set_added',
      payload_json: '{}',
      client_event_id: newId(),
    });

    const call = db._rows[0];
    expect(call).toBeDefined();
    expect(call.sql).toMatch(/INSERT OR IGNORE/i);
    expect(call.sql).toMatch(/workout_events/i);
  });

  it('includes client_event_id in the bound parameters', async () => {
    const db = createMockDb();
    const clientEventId = newId();

    await insertEvent(db as never, {
      id: newId(),
      session_id: newId(),
      event_type: 'set_added',
      payload_json: '{}',
      client_event_id: clientEventId,
    });

    const params = db._rows[0].params as string[];
    expect(params).toContain(clientEventId);
  });
});
