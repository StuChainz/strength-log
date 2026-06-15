export type AppThemePreference =
  | 'system'
  | 'performance_dark'
  | 'warm_light'
  | 'calm_dark'
  | 'classic_neutral';

export type AppThemeId = Exclude<AppThemePreference, 'system'>;

export interface ThemeTokens {
  bg: string;
  surface: string;
  surface2: string;
  surface3: string;
  border: string;
  borderBright: string;
  text: string;
  textDim: string;
  muted: string;
  mutedDeep: string;
  accent: string;
  accentInk: string;
  success: string;
  warning: string;
  danger: string;
  disabled: string;
}

export interface ThemeOption {
  id: AppThemePreference;
  label: string;
  description: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'system',
    label: 'System',
    description: 'Follows your device light/dark setting',
  },
  {
    id: 'performance_dark',
    label: 'Performance Dark',
    description: 'Bold black & yellow — the default',
  },
  {
    id: 'warm_light',
    label: 'Warm Light',
    description: 'Creamy, warm, easy to read',
  },
  {
    id: 'calm_dark',
    label: 'Calm Dark',
    description: 'Deep navy with soft blue accent',
  },
  {
    id: 'classic_neutral',
    label: 'Classic Neutral',
    description: 'Clean graphite, minimal',
  },
];

export const THEME_TOKENS: Record<AppThemeId, ThemeTokens> = {
  performance_dark: {
    bg: '#000000',
    surface: '#171717',
    surface2: '#1f1f1f',
    surface3: '#2b2b2b',
    border: '#2a2a2a',
    borderBright: '#3a3a3a',
    text: '#ffffff',
    textDim: '#a3a3a3',
    muted: '#737373',
    mutedDeep: '#525252',
    accent: '#facc15',
    accentInk: '#0a0a0a',
    success: '#22c55e',
    warning: '#f97316',
    danger: '#ef4444',
    disabled: '#404040',
  },
  warm_light: {
    bg: '#faf7f2',
    surface: '#ffffff',
    surface2: '#f1e8dc',
    surface3: '#e6d6c2',
    border: '#e3d4c3',
    borderBright: '#d2bda4',
    text: '#1a1208',
    textDim: '#4f3f2d',
    muted: '#6b5740',
    mutedDeep: '#9b8060',
    accent: '#c2640a',
    accentInk: '#ffffff',
    success: '#15803d',
    warning: '#b45309',
    danger: '#dc2626',
    disabled: '#d8c8b5',
  },
  calm_dark: {
    bg: '#0d1117',
    surface: '#161b27',
    surface2: '#1d2433',
    surface3: '#263247',
    border: '#2a3850',
    borderBright: '#3b4d6b',
    text: '#e2e8f0',
    textDim: '#a9b7cb',
    muted: '#7d8fa8',
    mutedDeep: '#56677f',
    accent: '#5b8ef0',
    accentInk: '#ffffff',
    success: '#34d399',
    warning: '#fbbf24',
    danger: '#f87171',
    disabled: '#334155',
  },
  classic_neutral: {
    bg: '#f4f4f5',
    surface: '#ffffff',
    surface2: '#e9e9ec',
    surface3: '#d9d9de',
    border: '#dedee3',
    borderBright: '#c7c7cf',
    text: '#18181b',
    textDim: '#3f3f46',
    muted: '#52525b',
    mutedDeep: '#92929c',
    accent: '#3f3f46',
    accentInk: '#ffffff',
    success: '#16a34a',
    warning: '#d97706',
    danger: '#dc2626',
    disabled: '#d4d4d8',
  },
};

export const DEFAULT_THEME_PREFERENCE: AppThemePreference = 'system';
export const DEFAULT_THEME_ID: AppThemeId = 'performance_dark';

export const T = THEME_TOKENS.performance_dark;

export function resolveThemeId(
  preference: AppThemePreference,
  systemScheme: 'light' | 'dark' | null | undefined,
): AppThemeId {
  if (preference !== 'system') return preference;
  // System light maps to Warm Light to preserve Set's warm accent identity while improving scanability.
  return systemScheme === 'light' ? 'warm_light' : DEFAULT_THEME_ID;
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace('#', '');
  const value = Number.parseInt(normalized, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

export function colorAlpha(color: string, alpha: number): string {
  if (!color.startsWith('#') || color.length !== 7) return color;
  const [r, g, b] = hexToRgb(color);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function accentAlpha(alpha: number, tokens: ThemeTokens = T): string {
  return colorAlpha(tokens.accent, alpha);
}
