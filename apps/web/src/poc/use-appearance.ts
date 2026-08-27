import { useEffect, useMemo, useState } from 'react';
import {
  defaultAppearanceSettings,
  loadAppearanceSettings,
  resolveMapTheme,
  resolveTheme,
  saveAppearanceSettings,
  toggleMapTheme,
  type AppearanceSettingsV1,
  type ThemePreference,
} from './appearance-settings';
import { getPrefersColorScheme, type ColorScheme } from './use-prefers-color-scheme';

function applyDocumentTheme(theme: ColorScheme): void {
  document.documentElement.dataset.theme = theme;
}

export function useAppearance() {
  const [systemTheme, setSystemTheme] = useState<ColorScheme>(() => getPrefersColorScheme());
  const [settings, setSettings] = useState<AppearanceSettingsV1>(() => defaultAppearanceSettings());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSettings(loadAppearanceSettings());
    setHydrated(true);
  }, []);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setSystemTheme(media.matches ? 'dark' : 'light');
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  const resolvedTheme = useMemo(
    () => resolveTheme(settings.themePreference, systemTheme),
    [settings.themePreference, systemTheme],
  );

  const mapTheme = useMemo(
    () => resolveMapTheme(settings.mapTheme, resolvedTheme),
    [settings.mapTheme, resolvedTheme],
  );

  useEffect(() => {
    applyDocumentTheme(resolvedTheme);
    if (!hydrated) {
      return;
    }
    saveAppearanceSettings(settings);
  }, [hydrated, resolvedTheme, settings]);

  function setThemePreference(themePreference: ThemePreference): void {
    setSettings((current) => ({ ...current, themePreference }));
  }

  function toggleMapThemePreference(): void {
    setSettings((current) => {
      const uiTheme = resolveTheme(current.themePreference, getPrefersColorScheme());
      const effectiveMapTheme = resolveMapTheme(current.mapTheme, uiTheme);
      return {
        ...current,
        mapTheme: toggleMapTheme(effectiveMapTheme),
      };
    });
  }

  return {
    themePreference: settings.themePreference,
    resolvedTheme,
    mapTheme,
    setThemePreference,
    toggleMapTheme: toggleMapThemePreference,
  };
}
