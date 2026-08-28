import { AppearanceControls } from './AppearanceControls';
import type { ThemePreference } from '../appearance-settings';

type Props = {
  contractTitle: string;
  themePreference: ThemePreference;
  onThemePreferenceChange: (preference: ThemePreference) => void;
};

export function PlannerHeader({ contractTitle, themePreference, onThemePreferenceChange }: Props) {
  return (
    <header className="poc-header">
      <div>
        <p className="eyebrow">Local route-generation POC</p>
        <h1>RideVector</h1>
      </div>
      <div className="poc-header__meta">
        <AppearanceControls
          themePreference={themePreference}
          onThemePreferenceChange={onThemePreferenceChange}
        />
        <p className="contract-meta" data-testid="contract-title">
          Contract: {contractTitle}
        </p>
      </div>
    </header>
  );
}
