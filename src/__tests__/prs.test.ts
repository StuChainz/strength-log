import {
  calculateEstimated1RM,
  detectFinalSessionPRs,
  detectLivePotentialPRs,
  getSessionExerciseVolume,
  type PreviousPRData,
} from '@/domain/prs';
import type { SetType, WorkoutSet } from '@/domain/types';

function set(
  overrides: Partial<WorkoutSet> & {
    id: string;
    exercise_id?: string;
    weight?: number | null;
    reps?: number | null;
    set_type?: SetType;
  },
): WorkoutSet {
  const setType = overrides.set_type ?? 'working';
  const weight = Object.prototype.hasOwnProperty.call(overrides, 'weight') ? overrides.weight! : 80;
  const reps = Object.prototype.hasOwnProperty.call(overrides, 'reps') ? overrides.reps! : 5;
  return {
    id: overrides.id,
    session_id: overrides.session_id ?? 'session-1',
    exercise_id: overrides.exercise_id ?? 'bench',
    position: overrides.position ?? 0,
    weight,
    reps,
    rpe: overrides.rpe ?? null,
    unit: overrides.unit ?? 'kg',
    is_warmup: overrides.is_warmup ?? (setType === 'warmup' ? 1 : 0),
    set_type: setType,
    logged_at: overrides.logged_at ?? 1,
    source: overrides.source ?? 'tap',
    client_set_id: overrides.client_set_id ?? `client-${overrides.id}`,
    deleted_at: overrides.deleted_at ?? null,
  };
}

const emptyPrevious: PreviousPRData = {
  repMaxes: [],
  estimated1RMs: [],
  sessionVolumes: [],
};

describe('PR domain logic', () => {
  it('uses Epley for estimated 1RM and skips reps above 10', () => {
    expect(calculateEstimated1RM(100, 5)).toBeCloseTo(116.67, 2);
    expect(calculateEstimated1RM(100, 10)).toBeCloseTo(133.33, 2);
    expect(calculateEstimated1RM(100, 11)).toBeNull();
  });

  it('excludes warm-up, missing, and deleted sets from final PRs', () => {
    const records = detectFinalSessionPRs(
      [
        set({ id: 'warmup', weight: 120, reps: 5, set_type: 'warmup' }),
        set({ id: 'missing-weight', weight: null, reps: 5 }),
        set({ id: 'missing-reps', weight: 100, reps: null }),
        set({ id: 'deleted', weight: 100, reps: 5, deleted_at: 99 }),
        set({ id: 'working', weight: 80, reps: 5 }),
      ],
      emptyPrevious,
    );

    expect(records.map((record) => record.set_id)).toEqual(expect.arrayContaining(['working']));
    expect(records.some((record) => record.set_id === 'warmup')).toBe(false);
    expect(records.some((record) => record.set_id === 'deleted')).toBe(false);
    expect(records.some((record) => record.set_id === 'missing-weight')).toBe(false);
    expect(records.some((record) => record.set_id === 'missing-reps')).toBe(false);
  });

  it('includes working and drop sets for rep and estimated 1RM PRs', () => {
    const records = detectFinalSessionPRs(
      [
        set({ id: 'working', weight: 80, reps: 5, set_type: 'working' }),
        set({ id: 'drop', weight: 70, reps: 10, set_type: 'drop' }),
      ],
      emptyPrevious,
    );

    expect(records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ record_type: 'rep_max', set_id: 'working' }),
        expect.objectContaining({ record_type: 'rep_max', set_id: 'drop' }),
        expect.objectContaining({ record_type: 'estimated_1rm', set_id: 'working' }),
      ]),
    );
  });

  it('sums session volume by exercise from valid working and drop sets only', () => {
    const volume = getSessionExerciseVolume([
      set({ id: 'warmup', weight: 20, reps: 10, set_type: 'warmup' }),
      set({ id: 'working', weight: 80, reps: 5 }),
      set({ id: 'drop', weight: 60, reps: 8, set_type: 'drop' }),
      set({ id: 'deleted', weight: 100, reps: 5, deleted_at: 1 }),
    ]);

    expect(volume.get('bench')).toBe(880);
  });

  it('skips estimated 1RM records for sets above 10 reps', () => {
    const records = detectFinalSessionPRs(
      [set({ id: 'high-rep', weight: 50, reps: 12 })],
      emptyPrevious,
    );

    expect(records.some((record) => record.record_type === 'estimated_1rm')).toBe(false);
    expect(records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ record_type: 'rep_max' }),
        expect.objectContaining({ record_type: 'session_volume' }),
      ]),
    );
  });

  it('detects final records only when current values beat previous completed baselines', () => {
    const previous: PreviousPRData = {
      repMaxes: [{ exerciseId: 'bench', reps: 5, weight: 82.5 }],
      estimated1RMs: [{ exerciseId: 'bench', value: 95 }],
      sessionVolumes: [{ exerciseId: 'bench', value: 1_000 }],
    };

    expect(detectFinalSessionPRs([set({ id: 'weak', weight: 80, reps: 5 })], previous)).toEqual([]);

    const stronger = detectFinalSessionPRs(
      [
        set({ id: 'rep', weight: 85, reps: 5 }),
        set({ id: 'volume', weight: 60, reps: 10, position: 1 }),
      ],
      previous,
    );

    expect(stronger).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ record_type: 'rep_max', set_id: 'rep' }),
        expect.objectContaining({ record_type: 'estimated_1rm', set_id: 'rep' }),
        expect.objectContaining({ record_type: 'session_volume', value: 1_025 }),
      ]),
    );
  });

  it('live potential PRs disappear when a qualifying set is removed or becomes warmup', () => {
    const first = detectLivePotentialPRs(
      [set({ id: 'set-1', weight: 80, reps: 5 })],
      emptyPrevious,
    );
    expect(first).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Potential rep PR', set_id: 'set-1' }),
      ]),
    );

    expect(
      detectLivePotentialPRs(
        [set({ id: 'set-1', weight: 80, reps: 5, deleted_at: 1 })],
        emptyPrevious,
      ),
    ).toEqual([]);
    expect(
      detectLivePotentialPRs(
        [set({ id: 'set-1', weight: 80, reps: 5, set_type: 'warmup' })],
        emptyPrevious,
      ),
    ).toEqual([]);
  });
});
