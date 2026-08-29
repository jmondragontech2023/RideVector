import type { PocElevationPreference, PocExperimentalFeatures, PocTrafficPreference } from '../types';
import { matchingFeaturePresetLabel } from './planner-workspace';

type Props = {
  features: PocExperimentalFeatures;
  elevationPreference: PocElevationPreference;
  trafficPreference: PocTrafficPreference;
  departureMode: 'now' | 'custom';
};

function preferenceChips(input: Props): string[] {
  const chips: string[] = [];
  chips.push(`Preset: ${matchingFeaturePresetLabel(input.features)}`);

  const enabled: string[] = [];
  if (input.features.distanceFitScoring) {
    enabled.push('distance-fit');
  }
  if (input.features.loopQualityScoring) {
    enabled.push('loop quality');
  }
  if (input.features.routeDiversityScoring) {
    enabled.push('diversity');
  }
  if (input.features.elevationEnrichment) {
    enabled.push(
      input.elevationPreference !== 'none'
        ? `elevation (${input.elevationPreference})`
        : 'elevation',
    );
  }
  if (input.features.motorTrafficEnrichment) {
    enabled.push(
      input.trafficPreference !== 'none' ? `traffic (${input.trafficPreference})` : 'traffic',
    );
  }
  if (input.features.weatherForecast) {
    enabled.push(input.departureMode === 'custom' ? 'weather (custom departure)' : 'weather');
  }

  if (enabled.length > 0) {
    chips.push(enabled.join(' · '));
  } else {
    chips.push('Geometry acceptance only');
  }

  return chips;
}

export function ActivePreferencesSummary(props: Props) {
  const chips = preferenceChips(props);

  return (
    <div
      className="active-preferences-summary"
      data-testid="active-preferences-summary"
      aria-label="Active preferences"
    >
      <p className="active-preferences-summary__label">Active preferences</p>
      <ul className="active-preferences-summary__list">
        {chips.map((chip) => (
          <li key={chip}>{chip}</li>
        ))}
      </ul>
    </div>
  );
}
