import { type SQLiteDatabase } from 'expo-sqlite';
import type { Unit } from '@/domain/types';
import { DEFAULT_THEME_PREFERENCE, type AppThemePreference } from '@/theme/tokens';

export type WeekStartDay = 'monday' | 'sunday';

export interface AppSettings {
  unit: Unit;
  weekStartDay: WeekStartDay;
  themePreference: AppThemePreference;
  voiceMode: boolean;
  onboardingCompleted: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  unit: 'kg',
  weekStartDay: 'monday',
  themePreference: DEFAULT_THEME_PREFERENCE,
  voiceMode: false,
  onboardingCompleted: false,
};

export async function getAppSettings(db: SQLiteDatabase): Promise<AppSettings> {
  const rows = await db.getAllAsync<{ key: keyof AppSettings; value_json: string }>(
    'SELECT key, value_json FROM app_settings',
  );
  const values: Partial<AppSettings> = {};
  for (const row of rows) {
    values[row.key] = JSON.parse(row.value_json) as never;
  }
  return { ...DEFAULT_SETTINGS, ...values };
}

export async function setAppSetting<K extends keyof AppSettings>(
  db: SQLiteDatabase,
  key: K,
  value: AppSettings[K],
): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO app_settings (key, value_json, updated_at)
     VALUES (?, ?, ?)`,
    [key, JSON.stringify(value), Date.now()],
  );
}
