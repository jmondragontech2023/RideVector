import type { ColorScheme } from '../use-prefers-color-scheme';

type Props = {
  mapTheme: ColorScheme;
  onToggle: () => void;
};

export function MapThemeToggle({ mapTheme, onToggle }: Props) {
  const nextLabel = mapTheme === 'dark' ? 'Switch to light map' : 'Switch to dark map';
  return (
    <button
      type="button"
      className="secondary map-theme-toggle"
      aria-label={nextLabel}
      aria-pressed={mapTheme === 'dark'}
      onClick={onToggle}
    >
      {mapTheme === 'dark' ? 'Light map' : 'Dark map'}
    </button>
  );
}
