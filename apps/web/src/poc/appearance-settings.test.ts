import { describe, expect, it } from 'vitest';
import {
  defaultAppearanceSettings,
  loadAppearanceSettings,
  parseAppearanceSettings,
  POC_APPEARANCE_SETTINGS_KEY,
  resolveMapTheme,
  resolveTheme,
  saveAppearanceSettings,
  toggleMapTheme,
} from './appearance-settings';

describe('appearance settings', () => {
  it('returns defaults for corrupt or empty storage', () => {
    expect(parseAppearanceSettings(null)).toEqual(defaultAppearanceSettings());
    expect(parseAppearanceSettings('{').themePreference).toBe('system');
  });

  it('resolves UI theme from system preference', () => {
    expect(resolveTheme('system', 'dark')).toBe('dark');
    expect(resolveTheme('light', 'dark')).toBe('light');
    expect(resolveTheme('dark', 'light')).toBe('dark');
  });

  it('follows UI theme for map until explicitly toggled', () => {
    expect(resolveMapTheme(null, 'dark')).toBe('dark');
    expect(resolveMapTheme('light', 'dark')).toBe('light');
  });

  it('toggles map theme independently', () => {
    expect(toggleMapTheme('light')).toBe('dark');
    expect(toggleMapTheme('dark')).toBe('light');
  });

  it('round-trips settings through storage', () => {
    const memory = new Map<string, string>();
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
    } as Storage;

    saveAppearanceSettings({ version: 1, themePreference: 'dark', mapTheme: 'light' }, storage);
    expect(loadAppearanceSettings(storage)).toEqual({
      version: 1,
      themePreference: 'dark',
      mapTheme: 'light',
    });
    expect(memory.get(POC_APPEARANCE_SETTINGS_KEY)).toContain('"themePreference":"dark"');
  });
});
