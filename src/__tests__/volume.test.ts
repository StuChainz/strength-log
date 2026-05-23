import { calculateSessionVolume, calculateSetVolume, estimateOneRepMax } from '@/domain/volume';

describe('volume helpers', () => {
  it('calculates set volume only when weight and reps are present', () => {
    expect(calculateSetVolume({ weight: 100, reps: 5 })).toBe(500);
    expect(calculateSetVolume({ weight: null, reps: 5 })).toBe(0);
    expect(calculateSetVolume({ weight: 100, reps: null })).toBe(0);
  });

  it('calculates session volume across sets', () => {
    expect(calculateSessionVolume([
      { weight: 100, reps: 5 },
      { weight: 80, reps: 8 },
    ])).toBe(1140);
  });

  it('estimates one-rep max with Epley and hides higher-rep sets', () => {
    expect(estimateOneRepMax(100, 5)).toBeCloseTo(116.67, 2);
    expect(estimateOneRepMax(100, 11)).toBeNull();
  });
});
