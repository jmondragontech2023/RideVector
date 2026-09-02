import type { ColorScheme } from './use-prefers-color-scheme';

export const POC_APPEARANCE_SETTINGS_KEY = 'ridevector.poc.appearance.v1';

export type ThemePreference = 'system' | 'light' | 'dark';

export type AppearanceSettingsV1 = {
  version: 1;
  themePreference: ThemePreference;
  /** When null, the map follows the resolved UI theme until toggled explicitly. */
  mapTheme: ColorScheme | null;
};

export function defaultAppearanceSettings(): AppearanceSettingsV1 {
  return {
    version: 1,
    themePreference: 'system',
    mapTheme: null,
  };
}

export function resolveTheme(preference: ThemePreference, systemTheme: ColorScheme): ColorScheme {
  return preference === 'system' ? systemTheme : preference;
}

export function resolveMapTheme(
  mapTheme: ColorScheme | null,
  resolvedUiTheme: ColorScheme,
): ColorScheme {
  return mapTheme ?? resolvedUiTheme;
}

export function parseAppearanceSettings(raw: string | null): AppearanceSettingsV1 {
  if (raw === null || raw.trim() === '') {
    return defaultAppearanceSettings();
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return defaultAppearanceSettings();
    }
    const record = parsed as Record<string, unknown>;
    if (record.version !== 1) {
      return defaultAppearanceSettings();
    }
    const themePreference =
      record.themePreference === 'light' ||
      record.themePreference === 'dark' ||
      record.themePreference === 'system'
        ? record.themePreference
        : 'system';
    const mapTheme =
      record.mapTheme === 'light' || record.mapTheme === 'dark' ? record.mapTheme : null;
    return { version: 1, themePreference, mapTheme };
  } catch {
    return defaultAppearanceSettings();
  }
}

export function loadAppearanceSettings(
  storage: Pick<Storage, 'getItem'> = localStorage,
): AppearanceSettingsV1 {
  return parseAppearanceSettings(storage.getItem(POC_APPEARANCE_SETTINGS_KEY));
}

export function saveAppearanceSettings(
  settings: AppearanceSettingsV1,
  storage: Pick<Storage, 'setItem'> = localStorage,
): void {
  storage.setItem(POC_APPEARANCE_SETTINGS_KEY, JSON.stringify(settings));
}

export function toggleMapTheme(current: ColorScheme): ColorScheme {
  return current === 'dark' ? 'light' : 'dark';
}
