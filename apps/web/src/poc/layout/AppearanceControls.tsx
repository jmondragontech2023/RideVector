import type { ThemePreference } from '../appearance-settings';

type Props = {
  themePreference: ThemePreference;
  onThemePreferenceChange: (preference: ThemePreference) => void;
};

const OPTIONS: Array<{ value: ThemePreference; label: string }> = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export function AppearanceControls({ themePreference, onThemePreferenceChange }: Props) {
  return (
    <div className="appearance-controls">
      <label className="appearance-control">
        <span className="appearance-control__label">Theme</span>
        <select
          value={themePreference}
          aria-label="Theme preference"
          onChange={(event) => onThemePreferenceChange(event.target.value as ThemePreference)}
        >
          {OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
