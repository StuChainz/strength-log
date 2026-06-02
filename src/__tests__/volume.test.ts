import {
  calculateSessionVolume,
  calculateSetVolume,
  calculateWorkingSessionVolume,
  calculateWorkoutSummarySoFar,
  estimateOneRepMax,
  formatWorkoutVolumeKg,
} from '@/domain/volume';

describe('volume helpers', () => {
  it('calculates set volume only when weight and reps are present', () => {
    expect(calculateSetVolume({ weight: 100, reps: 5 })).toBe(500);
    expect(calculateSetVolume({ weight: null, reps: 5 })).toBe(0);
    expect(calculateSetVolume({ weight: 100, reps: null })).toBe(0);
  });

  it('calculates session volume across sets', () => {
    expect(
      calculateSessionVolume([
        { weight: 100, reps: 5 },
        { weight: 80, reps: 8 },
      ]),
    ).toBe(1140);
  });

  it('summarizes logged working sets and volume by exercise', () => {
    const summary = calculateWorkoutSummarySoFar(
      [
        {
          exercise_id: 'bench',
          weight: 100,
          reps: 5,
          set_type: 'working',
          deleted_at: null,
        },
        {
          exercise_id: 'bench',
          weight: 105,
          reps: 3,
          set_type: 'drop',
          deleted_at: null,
        },
        {
          exercise_id: 'row',
          weight: 50,
          reps: 10,
          set_type: 'working',
          deleted_at: null,
        },
        {
          exercise_id: 'row',
          weight: 20,
          reps: 10,
          set_type: 'warmup',
          deleted_at: null,
        },
        {
          exercise_id: 'bench',
          weight: 100,
          reps: 5,
          set_type: 'working',
          deleted_at: 123,
        },
      ],
      [
        { id: 'bench', name: 'Bench Press' },
        { id: 'row', name: 'Cable Row' },
      ],
    );

    expect(summary).toEqual({
      totalSets: 3,
      totalVolume: 1315,
      exercises: [
        { exerciseId: 'bench', name: 'Bench Press', loggedSets: 2 },
        { exerciseId: 'row', name: 'Cable Row', loggedSets: 1 },
      ],
    });
  });

  it('calculates working volume without warm-up sets', () => {
    expect(
      calculateWorkingSessionVolume([
        { weight: 20, reps: 8, set_type: 'warmup', deleted_at: null },
        { weight: 80, reps: 5, set_type: 'working', deleted_at: null },
        { weight: 60, reps: 5, set_type: 'drop', deleted_at: null },
      ]),
    ).toBe(700);
  });

  it('formats sub-10,000kg workout volume with thousands separators', () => {
    expect(formatWorkoutVolumeKg(950)).toBe('950 kg');
    expect(formatWorkoutVolumeKg(1500)).toBe('1,500 kg');
    expect(formatWorkoutVolumeKg(8450)).toBe('8,450 kg');
  });

  it('formats 10,000kg and higher workout volume in tonnes', () => {
    expect(formatWorkoutVolumeKg(12_500)).toBe('12.5 tonnes');
    expect(formatWorkoutVolumeKg(24_800)).toBe('24.8 tonnes');
    expect(formatWorkoutVolumeKg(10_000)).toBe('10 tonnes');
  });

  it('estimates one-rep max with Epley and hides higher-rep sets', () => {
    expect(estimateOneRepMax(100, 5)).toBeCloseTo(116.67, 2);
    expect(estimateOneRepMax(100, 11)).toBeNull();
  });
});
