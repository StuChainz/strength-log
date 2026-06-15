import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';
import { openDb } from '@/db/client';
import { getAppSettings, setAppSetting } from '@/db/repositories/settings.repo';
import {
  DEFAULT_THEME_PREFERENCE,
  resolveThemeId,
  THEME_TOKENS,
  type AppThemeId,
  type AppThemePreference,
  type ThemeTokens,
} from '@/theme/tokens';

interface ThemeContextValue {
  preference: AppThemePreference;
  themeId: AppThemeId;
  tokens: ThemeTokens;
  isDark: boolean;
  setThemePreference: (preference: AppThemePreference) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [preference, setPreference] = useState<AppThemePreference>(DEFAULT_THEME_PREFERENCE);

  useEffect(() => {
    let active = true;
    openDb()
      .then(getAppSettings)
      .then((settings) => {
        if (active) setPreference(settings.themePreference);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const themeId = resolveThemeId(preference, systemScheme);
  const tokens = THEME_TOKENS[themeId];

  const setThemePreference = useCallback(async (nextPreference: AppThemePreference) => {
    setPreference(nextPreference);
    const db = await openDb();
    await setAppSetting(db, 'themePreference', nextPreference);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      themeId,
      tokens,
      isDark: themeId === 'performance_dark' || themeId === 'calm_dark',
      setThemePreference,
    }),
    [preference, setThemePreference, themeId, tokens],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const systemScheme = useColorScheme();
  const context = useContext(ThemeContext);
  if (context) return context;

  const themeId = resolveThemeId(DEFAULT_THEME_PREFERENCE, systemScheme);
  return {
    preference: DEFAULT_THEME_PREFERENCE,
    themeId,
    tokens: THEME_TOKENS[themeId],
    isDark: themeId === 'performance_dark' || themeId === 'calm_dark',
    setThemePreference: async (nextPreference: AppThemePreference) => {
      const db = await openDb();
      await setAppSetting(db, 'themePreference', nextPreference);
    },
  };
}
