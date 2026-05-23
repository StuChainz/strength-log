import { newId, normalizeName } from '@/domain/ids';

describe('newId()', () => {
  it('returns a string', () => {
    expect(typeof newId()).toBe('string');
  });

  it('returns a valid UUID format', () => {
    const id = newId();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('generates unique IDs on each call', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => newId()));
    expect(ids.size).toBe(1000);
  });

  it('produces IDs that sort chronologically', () => {
    const a = newId();
    const b = newId();
    // UUIDv7 embeds a timestamp prefix, so lexicographic order == time order.
    expect(b >= a).toBe(true);
  });
});

describe('normalizeName()', () => {
  it('lowercases input', () => {
    expect(normalizeName('Barbell Back Squat')).toBe('barbell back squat');
  });

  it('converts hyphens to spaces', () => {
    expect(normalizeName('Single-Arm Row')).toBe('single arm row');
  });

  it('strips punctuation', () => {
    expect(normalizeName('OHP (Overhead)')).toBe('ohp overhead');
  });

  it('collapses multiple spaces', () => {
    expect(normalizeName('Bench   Press')).toBe('bench press');
  });

  it('trims leading and trailing whitespace', () => {
    expect(normalizeName('  squat  ')).toBe('squat');
  });

  it('handles already-normalised input unchanged', () => {
    expect(normalizeName('bench press')).toBe('bench press');
  });
});
