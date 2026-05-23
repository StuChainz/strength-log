export const MIN_GROUP_SESSIONS = 4;
export const MIN_TOTAL_SESSIONS = 8;
export const MIN_RELATIVE_EFFECT = 0.1;
export const TRAILING_WINDOW_WEEKS = 8;

export const INSIGHT_PAIRS = [
  { tag: 'evening_session', metric: 'session_volume', title: 'Evening volume pattern' },
  { tag: 'sleep_short', metric: 'energy_rating', title: 'Short sleep energy pattern' },
  { tag: 'felt_strong', metric: 'session_volume', title: 'Strong-day volume pattern' },
] as const;
