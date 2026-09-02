import { ExperimentalFeaturesPanel } from '../ExperimentalFeaturesPanel';
import { POC_SCENARIO_FIXTURES } from '../fixtures';
import type {
  PocElevationPreference,
  PocExperimentalFeatures,
  PocTrafficPreference,
} from '../types';

type Props = {
  features: PocExperimentalFeatures;
  elevationPreference: PocElevationPreference;
  trafficPreference: PocTrafficPreference;
  departureMode: 'now' | 'custom';
  customLocalDateTime: string;
  disabled: boolean;
  onChange: (next: {
    features: PocExperimentalFeatures;
    elevationPreference: PocElevationPreference;
    trafficPreference: PocTrafficPreference;
    departureMode: 'now' | 'custom';
    customLocalDateTime: string;
  }) => void;
  onApplyFixture: (id: string) => void;
};

export function ExperimentalSettingsPanel({
  features,
  elevationPreference,
  trafficPreference,
  departureMode,
  customLocalDateTime,
  disabled,
  onChange,
  onApplyFixture,
}: Props) {
  return (
    <div
      id="planning-panel-experiment"
      className="experiment-panel-body"
      data-testid="experimental-settings"
      aria-label="Advanced preferences"
    >
      <label className="field poc-tool-field">
        <span>Public scenario fixtures (POC)</span>
        <select
          defaultValue=""
          disabled={disabled}
          onChange={(event) => {
            if (event.target.value) {
              onApplyFixture(event.target.value);
              event.target.value = '';
            }
          }}
        >
          <option value="">Load a public landmark scenario…</option>
          {POC_SCENARIO_FIXTURES.map((fixture) => (
            <option key={fixture.id} value={fixture.id}>
              {fixture.label}
            </option>
          ))}
        </select>
        <p className="subtle">Fixtures are POC tools, not normal rider input.</p>
      </label>

      <ExperimentalFeaturesPanel
        features={features}
        elevationPreference={elevationPreference}
        trafficPreference={trafficPreference}
        departureMode={departureMode}
        customLocalDateTime={customLocalDateTime}
        disabled={disabled}
        onChange={onChange}
      />
    </div>
  );
}
