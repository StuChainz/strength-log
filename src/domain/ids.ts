import { uuidv7 } from 'uuidv7';

/**
 * Generate a new UUIDv7 (time-sortable, client-side).
 * Always allocate the ID *before* the DB write to guarantee idempotency.
 */
export function newId(): string {
  return uuidv7();
}

/**
 * Normalise a display name for search and voice matching:
 *   lowercase → hyphens become spaces → punctuation stripped → whitespace collapsed.
 *
 * "Barbell Back Squat" → "barbell back squat"
 * "Single-Arm Row"     → "single arm row"
 * "OHP (Overhead)"     → "ohp overhead"
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/-/g, ' ')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
