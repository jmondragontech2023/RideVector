import {
  coerceFeatureDependencies,
  FEATURE_PRESETS,
  type PocElevationPreference,
  type PocExperimentalFeatures,
  type PocFeaturePreset,
  type PocTrafficPreference,
} from './types';
import { FeatureHelpTip } from './FeatureHelpTip';
import {
  DEPARTURE_HELP,
  ELEVATION_PREFERENCE_HELP,
  EXPERIMENTAL_FEATURE_HELP,
  featureHelpId,
  preferenceHelpId,
  PRESET_HELP,
  presetHelpId,
  TRAFFIC_PREFERENCE_HELP,
} from './experimental-feature-help';

type Props = {
  features: PocExperimentalFeatures;
  elevationPreference: PocElevationPreference;
  trafficPreference: PocTrafficPreference;
  departureMode: 'now' | 'custom';
  customLocalDateTime: string;
  disabled?: boolean;
  onChange: (next: {
    features: PocExperimentalFeatures;
    elevationPreference: PocElevationPreference;
    trafficPreference: PocTrafficPreference;
    departureMode: 'now' | 'custom';
    customLocalDateTime: string;
  }) => void;
};

const TOGGLE_LABELS: Array<{ key: keyof PocExperimentalFeatures; label: string }> = [
  { key: 'distanceFitScoring', label: 'Distance-fit scoring' },
  { key: 'loopQualityScoring', label: 'Loop-quality scoring' },
  { key: 'routeDiversityScoring', label: 'Route-diversity scoring' },
  { key: 'elevationEnrichment', label: 'Elevation enrichment' },
  { key: 'elevationScoring', label: 'Elevation scoring' },
  { key: 'motorTrafficEnrichment', label: 'Motor-traffic enrichment' },
  { key: 'motorTrafficScoring', label: 'Motor-traffic scoring' },
  { key: 'weatherForecast', label: 'Weather forecast' },
  { key: 'weatherScoring', label: 'Weather scoring' },
];

function scoringDisabled(
  key: keyof PocExperimentalFeatures,
  features: PocExperimentalFeatures,
): boolean {
  if (key === 'elevationScoring') {
    return !features.elevationEnrichment;
  }
  if (key === 'motorTrafficScoring') {
    return !features.motorTrafficEnrichment;
  }
  if (key === 'weatherScoring') {
    return !features.weatherForecast;
  }
  return false;
}

export function ExperimentalFeaturesPanel({
  features,
  elevationPreference,
  trafficPreference,
  departureMode,
  customLocalDateTime,
  disabled = false,
  onChange,
}: Props) {
  function update(partial: Partial<Parameters<Props['onChange']>[0]>): void {
    const nextFeatures = coerceFeatureDependencies(partial.features ?? features);
    onChange({
      features: nextFeatures,
      elevationPreference: partial.elevationPreference ?? elevationPreference,
      trafficPreference: partial.trafficPreference ?? trafficPreference,
      departureMode: partial.departureMode ?? departureMode,
      customLocalDateTime: partial.customLocalDateTime ?? customLocalDateTime,
    });
  }

  return (
    <section className="experimental-panel" aria-label="Experimental features">
      <h2>Experimental features</h2>
      <p className="subtle">
        Independent toggles for final comparison. Distance acceptance and geometry validation stay
        on. Changing features clears current results.
      </p>

      <div className="preset-row">
        {(Object.keys(FEATURE_PRESETS) as PocFeaturePreset[]).map((preset) => (
          <span key={preset} className="preset-chip">
            <button
              type="button"
              className="secondary"
              disabled={disabled}
              onClick={() => update({ features: FEATURE_PRESETS[preset] })}
            >
              {preset === 'full' ? 'Full experiment' : preset[0]!.toUpperCase() + preset.slice(1)}
            </button>
            <FeatureHelpTip
              id={presetHelpId(preset)}
              text={PRESET_HELP[preset]}
              label={`${preset} preset information`}
            />
          </span>
        ))}
      </div>

      <div className="toggle-grid">
        {TOGGLE_LABELS.map(({ key, label }) => (
          <label key={key} className="choice choice--with-help">
            <input
              type="checkbox"
              checked={features[key]}
              disabled={disabled || scoringDisabled(key, features)}
              onChange={(event) =>
                update({
                  features: coerceFeatureDependencies({
                    ...features,
                    [key]: event.target.checked,
                  }),
                })
              }
            />
            <span className="choice__label-row">
              <span>{label}</span>
              <FeatureHelpTip
                id={featureHelpId(key)}
                text={EXPERIMENTAL_FEATURE_HELP[key]}
                label={`${label} information`}
              />
            </span>
          </label>
        ))}
      </div>

      <label className="field">
        <span className="field-label-row">
          Elevation preference
          <FeatureHelpTip
            id={preferenceHelpId('elevation')}
            text={ELEVATION_PREFERENCE_HELP[elevationPreference]}
            label="Elevation preference information"
          />
        </span>
        <select
          value={elevationPreference}
          disabled={disabled || !features.elevationEnrichment}
          onChange={(event) =>
            update({
              elevationPreference: event.target.value as PocElevationPreference,
            })
          }
        >
          <option value="none" title={ELEVATION_PREFERENCE_HELP.none}>
            No preference
          </option>
          <option value="flatter" title={ELEVATION_PREFERENCE_HELP.flatter}>
            Prefer flatter
          </option>
          <option value="rolling" title={ELEVATION_PREFERENCE_HELP.rolling}>
            Prefer rolling
          </option>
          <option value="climbing" title={ELEVATION_PREFERENCE_HELP.climbing}>
            Prefer climbing
          </option>
        </select>
      </label>

      <label className="field">
        <span className="field-label-row">
          Motor-traffic preference
          <FeatureHelpTip
            id={preferenceHelpId('traffic')}
            text={TRAFFIC_PREFERENCE_HELP[trafficPreference]}
            label="Motor-traffic preference information"
          />
        </span>
        <select
          value={trafficPreference}
          disabled={disabled || !features.motorTrafficEnrichment}
          onChange={(event) =>
            update({
              trafficPreference: event.target.value as PocTrafficPreference,
            })
          }
        >
          <option value="none" title={TRAFFIC_PREFERENCE_HELP.none}>
            No preference
          </option>
          <option value="prefer_lower" title={TRAFFIC_PREFERENCE_HELP.prefer_lower}>
            Prefer lower motor traffic
          </option>
          <option value="strongly_avoid_heavy" title={TRAFFIC_PREFERENCE_HELP.strongly_avoid_heavy}>
            Strongly avoid heavy motor traffic
          </option>
        </select>
      </label>

      <fieldset className="field">
        <legend className="field-label-row">
          Departure
          <FeatureHelpTip
            id={preferenceHelpId('departure')}
            text={DEPARTURE_HELP}
            label="Departure information"
          />
        </legend>
        <label className="choice">
          <input
            type="radio"
            name="departureMode"
            checked={departureMode === 'now'}
            disabled={disabled}
            onChange={() => update({ departureMode: 'now' })}
          />
          Depart now
        </label>
        <label className="choice">
          <input
            type="radio"
            name="departureMode"
            checked={departureMode === 'custom'}
            disabled={disabled}
            onChange={() => update({ departureMode: 'custom' })}
          />
          Custom local departure
        </label>
        {departureMode === 'custom' ? (
          <label className="field">
            <span>Local date/time</span>
            <input
              type="datetime-local"
              value={customLocalDateTime}
              disabled={disabled}
              onChange={(event) => update({ customLocalDateTime: event.target.value })}
            />
          </label>
        ) : null}
      </fieldset>
    </section>
  );
}
