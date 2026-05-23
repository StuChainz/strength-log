export const T = {
  bg: '#0a0a0a',
  surface: '#141417',
  surface2: '#1b1b1f',
  surface3: '#26262c',
  border: '#26262c',
  borderBright: '#35353d',
  text: '#f5f5f3',
  textDim: '#a3a3a8',
  muted: '#6b6b73',
  mutedDeep: '#4a4a52',
  accent: '#ffd84d',
  accentInk: '#0a0a0a',
  success: '#7ee08c',
  warning: '#f1c160',
  danger: '#ff7a6a',
} as const;

export function accentAlpha(alpha: number): string {
  return `rgba(255,216,77,${alpha})`;
}
