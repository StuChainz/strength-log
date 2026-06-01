import { levenshtein } from './confidence';
import {
  normalizeVoiceText,
  parseNumberAt,
  REP_WORDS,
  SEPARATORS,
  unitFromToken,
  UNIT_WORDS,
} from './grammar';
import type { IntentResult, ParserContext, VoiceExercise, VoiceConfidence } from './commands';

interface ExerciseMatch {
  exercise: VoiceExercise;
  tokenCount: number;
  confidence: VoiceConfidence;
}

function result(
  intent: IntentResult['intent'],
  args: Record<string, unknown>,
  confidence: VoiceConfidence,
  rawText: string,
  now: number,
  requiresConfirmation = false,
): IntentResult {
  return {
    commandId: `${now}:${intent}:${normalizeVoiceText(rawText)}`,
    intent,
    args,
    confidence,
    rawText,
    recognisedAt: now,
    requiresConfirmation,
  };
}

function exerciseTerms(exercise: VoiceExercise): string[] {
  return [exercise.normalizedName, ...(exercise.aliases ?? [])]
    .map(normalizeVoiceText)
    .filter(Boolean);
}

function matchExercise(tokens: string[], exercises: VoiceExercise[]): ExerciseMatch | null {
  let best: ExerciseMatch | null = null;

  for (const exercise of exercises) {
    for (const term of exerciseTerms(exercise)) {
      const termTokens = term.split(' ');
      const prefix = tokens.slice(0, termTokens.length).join(' ');
      if (prefix === term) {
        if (!best || best.confidence !== 'high' || termTokens.length > best.tokenCount) {
          best = { exercise, tokenCount: termTokens.length, confidence: 'high' };
        }
        continue;
      }

      if (termTokens.length === 1 && tokens[0]) {
        const distance = levenshtein(tokens[0], termTokens[0]);
        if (distance <= 1 && (!best || best.confidence !== 'high')) {
          best = { exercise, tokenCount: 1, confidence: 'medium' };
        }
      }
    }
  }

  return best;
}

function parseLogSet(tokens: string[], rawText: string, ctx: ParserContext, now: number): IntentResult | null {
  let remaining = tokens;
  let exerciseId = ctx.activeExerciseId;
  let confidence: VoiceConfidence = exerciseId ? 'high' : 'medium';
  const matched = matchExercise(tokens, ctx.exercises);

  if (matched) {
    exerciseId = matched.exercise.id;
    remaining = tokens.slice(matched.tokenCount);
    confidence = matched.confidence;
  }

  if (!exerciseId) return null;

  const weightParsed = parseNumberAt(remaining, 0);
  if (!weightParsed || weightParsed.value <= 0) return null;
  let next = weightParsed.next;
  const unit = unitFromToken(remaining[next], ctx.defaultUnit);
  if (UNIT_WORDS.has(remaining[next])) next += 1;
  if (SEPARATORS.has(remaining[next])) next += 1;

  const repsParsed = parseNumberAt(remaining, next);
  if (!repsParsed || repsParsed.value <= 0) return null;
  next = repsParsed.next;
  if (REP_WORDS.has(remaining[next])) next += 1;
  if (next < remaining.length) return null;

  return result(
    'log_set',
    { exerciseId, weight: weightParsed.value, reps: repsParsed.value, unit },
    confidence,
    rawText,
    now,
  );
}

export function parseVoiceCommand(input: string, ctx: ParserContext): IntentResult | null {
  const rawText = input;
  const now = ctx.now ?? Date.now();
  const normalized = normalizeVoiceText(input);
  if (!normalized) return null;

  const tokens = normalized.split(' ');
  const joined = tokens.join(' ');

  if (joined === 'same again' || joined === 'again') {
    const last = ctx.lastSet;
    if (!last || last.weight === null || last.reps === null) return null;
    return result('log_set_same', {
      exerciseId: last.exerciseId,
      weight: last.weight,
      reps: last.reps,
      unit: last.unit,
    }, 'high', rawText, now);
  }

  if (tokens[0] === 'add' || tokens[0] === 'plus') {
    const parsed = parseNumberAt(tokens, 1);
    const last = ctx.lastSet;
    if (!parsed || !last || last.weight === null || last.reps === null) return null;
    const unit = unitFromToken(tokens[parsed.next], last.unit);
    return result('log_set_delta', {
      exerciseId: last.exerciseId,
      weight: last.weight + parsed.value,
      reps: last.reps,
      unit,
    }, 'high', rawText, now);
  }

  if (tokens[0] === 'minus') {
    const parsed = parseNumberAt(tokens, 1);
    const last = ctx.lastSet;
    if (!parsed || !last || last.weight === null || last.reps === null) return null;
    if (REP_WORDS.has(tokens[parsed.next])) {
      const reps = last.reps - parsed.value;
      if (reps <= 0) return null;
      return result('log_set_delta', {
        exerciseId: last.exerciseId,
        weight: last.weight,
        reps,
        unit: last.unit,
      }, 'high', rawText, now);
    }
    const nextWeight = last.weight - parsed.value;
    if (nextWeight <= 0) return null;
    return result('log_set_delta', {
      exerciseId: last.exerciseId,
      weight: nextWeight,
      reps: last.reps,
      unit: unitFromToken(tokens[parsed.next], last.unit),
    }, 'high', rawText, now);
  }

  if (tokens[0] === 'rpe') {
    const parsed = parseNumberAt(tokens, 1);
    const last = ctx.lastSet;
    if (!parsed || !last?.setId || parsed.value < 1 || parsed.value > 10) return null;
    if (last.loggedAt && now - last.loggedAt > 30_000) return null;
    return result('set_rpe', { setId: last.setId, rpe: parsed.value }, 'high', rawText, now);
  }

  if (joined === 'undo' || joined === 'undo last' || joined === 'undo last set') {
    return result('undo', {}, 'high', rawText, now, true);
  }

  if (joined === 'next' || joined === 'next exercise') {
    return result('next_exercise', {}, 'high', rawText, now);
  }

  if (joined === 'previous' || joined === 'prev' || joined === 'back' || joined === 'previous exercise' || joined === 'prev exercise' || joined === 'back exercise') {
    return result('prev_exercise', {}, 'high', rawText, now);
  }

  if (tokens[0] === 'rest') {
    const start = tokens[1] === 'timer' ? 2 : 1;
    const parsed = parseNumberAt(tokens, start);
    if (!parsed) return null;
    const unit = tokens[parsed.next];
    const seconds = unit?.startsWith('min') ? parsed.value * 60 : parsed.value;
    if (!unit?.startsWith('min') && !unit?.startsWith('sec')) return null;
    return result('start_rest_timer', { seconds }, 'high', rawText, now);
  }

  if (joined === 'end workout' || joined === 'finish workout') {
    return result('end_workout', {}, 'high', rawText, now, true);
  }

  return parseLogSet(tokens, rawText, ctx, now);
}
