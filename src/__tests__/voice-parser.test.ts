import { parseVoiceCommand } from '@/voice/parser';
import type { ParserContext } from '@/voice/commands';

const ctx: ParserContext = {
  activeExerciseId: 'bench',
  defaultUnit: 'kg',
  now: 100_000,
  exercises: [
    { id: 'bench', normalizedName: 'bench press', aliases: ['bench'] },
    { id: 'squat', normalizedName: 'squat', aliases: ['squats'] },
  ],
  lastSet: {
    setId: 'last-set',
    exerciseId: 'bench',
    weight: 80,
    reps: 5,
    unit: 'kg',
    loggedAt: 90_000,
  },
};

describe('parseVoiceCommand', () => {
  it.each([
    ['bench 80 for 5', 'log_set', 'high'],
    ['80 for 5', 'log_set', 'high'],
    ['squats 100 by 3', 'log_set', 'high'],
    ['same again', 'log_set_same', 'high'],
    ['add 2.5 kilos', 'log_set_delta', 'high'],
    ['rpe 8', 'set_rpe', 'high'],
    ['undo last set', 'undo', 'high'],
    ['next exercise', 'next_exercise', 'high'],
    ['rest 3 minutes', 'start_rest_timer', 'high'],
    ['end workout', 'end_workout', 'high'],
    ['bnch ate for 5', 'log_set', 'medium'],
  ])('parses %s', (input, intent, confidence) => {
    const parsed = parseVoiceCommand(input, ctx);
    expect(parsed?.intent).toBe(intent);
    expect(parsed?.confidence).toBe(confidence);
    expect(parsed?.commandId).toEqual(expect.any(String));
  });

  it('uses the active exercise when omitted', () => {
    const parsed = parseVoiceCommand('80 for 5', ctx);
    expect(parsed?.args.exerciseId).toBe('bench');
    expect(parsed?.args.weight).toBe(80);
    expect(parsed?.args.reps).toBe(5);
  });

  it('requires confirmation for undo', () => {
    const parsed = parseVoiceCommand('undo last set', ctx);
    expect(parsed).toEqual(
      expect.objectContaining({
        intent: 'undo',
        requiresConfirmation: true,
      }),
    );
  });

  it('requires confirmation for end workout', () => {
    const parsed = parseVoiceCommand('end workout', ctx);
    expect(parsed).toEqual(
      expect.objectContaining({
        intent: 'end_workout',
        requiresConfirmation: true,
      }),
    );
  });

  it('uses commandId from parser context when provided', () => {
    const parsed = parseVoiceCommand('80 for 5', { ...ctx, commandId: 'test-command-id' });
    expect(parsed?.commandId).toBe('test-command-id');
  });

  it('returns null for invalid or unsupported commands', () => {
    expect(parseVoiceCommand('minus 5 reps', ctx)).toBeNull();
    expect(parseVoiceCommand('play music', ctx)).toBeNull();
    expect(parseVoiceCommand('', ctx)).toBeNull();
    expect(parseVoiceCommand('bench 0 for 5', ctx)).toBeNull();
  });

  it('never throws for random strings', () => {
    const alphabet = 'abcdefghijklmnopqrstuvwxyz 0123456789.,-';
    for (let i = 0; i < 200; i += 1) {
      const value = Array.from({ length: 24 }, () =>
        alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
      expect(() => parseVoiceCommand(value, ctx)).not.toThrow();
    }
  });
});
