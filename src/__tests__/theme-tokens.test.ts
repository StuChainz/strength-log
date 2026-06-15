import { resolveThemeId, THEME_TOKENS } from '@/theme/tokens';

describe('theme tokens', () => {
  it('maps system preference to the intended app themes', () => {
    expect(resolveThemeId('system', 'dark')).toBe('performance_dark');
    expect(resolveThemeId('system', 'light')).toBe('warm_light');
  });

  it('includes the Figma base colors for selectable themes', () => {
    expect(THEME_TOKENS.performance_dark).toEqual(
      expect.objectContaining({ bg: '#000000', surface: '#171717', accent: '#facc15' }),
    );
    expect(THEME_TOKENS.warm_light).toEqual(
      expect.objectContaining({ bg: '#faf7f2', surface: '#ffffff', accent: '#c2640a' }),
    );
    expect(THEME_TOKENS.calm_dark).toEqual(
      expect.objectContaining({ bg: '#0d1117', surface: '#161b27', accent: '#5b8ef0' }),
    );
    expect(THEME_TOKENS.classic_neutral).toEqual(
      expect.objectContaining({ bg: '#f4f4f5', surface: '#ffffff', accent: '#3f3f46' }),
    );
  });
});
