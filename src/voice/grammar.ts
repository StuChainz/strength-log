const NUMBER_WORDS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  ate: 80,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  hundred: 100,
};

export const UNIT_WORDS = new Set(['kg', 'kilo', 'kilos', 'lb', 'lbs', 'pound', 'pounds']);
export const REP_WORDS = new Set(['rep', 'reps']);
export const SEPARATORS = new Set(['for', 'by', 'x']);

export function normalizeVoiceText(input: string): string {
  return input
    .toLowerCase()
    .replace(/[,]/g, '.')
    .replace(/[^a-z0-9.\s-]/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseNumberToken(token: string): number | null {
  const numeric = Number(token);
  if (Number.isFinite(numeric)) return numeric;
  return NUMBER_WORDS[token] ?? null;
}

export function parseNumberAt(tokens: string[], index: number): { value: number; next: number } | null {
  const first = parseNumberToken(tokens[index]);
  if (first === null) return null;

  if (tokens[index + 1] === 'point') {
    const decimal = parseNumberToken(tokens[index + 2]);
    if (decimal === null) return { value: first, next: index + 1 };
    return { value: Number(`${first}.${decimal}`), next: index + 3 };
  }

  const second = parseNumberToken(tokens[index + 1]);
  if (first >= 20 && first < 100 && second !== null && second > 0 && second < 10) {
    return { value: first + second, next: index + 2 };
  }

  if (tokens[index + 1] === 'hundred') {
    return { value: first * 100, next: index + 2 };
  }

  return { value: first, next: index + 1 };
}

export function unitFromToken(token: string | undefined, fallback: 'kg' | 'lb'): 'kg' | 'lb' {
  if (!token) return fallback;
  if (token === 'lb' || token === 'lbs' || token === 'pound' || token === 'pounds') return 'lb';
  if (UNIT_WORDS.has(token)) return 'kg';
  return fallback;
}
