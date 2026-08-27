import {
  loadAppearanceSettings,
  resolveTheme,
} from './poc/appearance-settings';
import { getPrefersColorScheme } from './poc/use-prefers-color-scheme';

/** Apply stored/system UI theme before first paint when possible. */
export function bootstrapAppearanceTheme(): void {
  const settings = loadAppearanceSettings();
  const resolved = resolveTheme(settings.themePreference, getPrefersColorScheme());
  document.documentElement.dataset.theme = resolved;
}
