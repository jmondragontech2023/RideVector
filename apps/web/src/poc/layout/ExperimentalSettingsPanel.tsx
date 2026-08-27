import type { ReactNode } from 'react';
import { ExperimentalFeaturesPanel } from '../ExperimentalFeaturesPanel';
import type {
  PocElevationPreference,
  PocExperimentalFeatures,
  PocTrafficPreference,
} from '../types';

type Props = {
  active: boolean;
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
  children?: ReactNode;
};

export function ExperimentalSettingsPanel({
  active,
  features,
  elevationPreference,
  trafficPreference,
  departureMode,
  customLocalDateTime,
  disabled,
  onChange,
  children,
}: Props) {
  return (
    <aside
      id="planning-panel-experiment"
      className={active ? 'experiment-column is-active' : 'experiment-column'}
      data-active={active ? 'true' : 'false'}
      aria-label="Experiment"
    >
      <div className="panel-scroll">
        <ExperimentalFeaturesPanel
          features={features}
          elevationPreference={elevationPreference}
          trafficPreference={trafficPreference}
          departureMode={departureMode}
          customLocalDateTime={customLocalDateTime}
          disabled={disabled}
          onChange={onChange}
        />
        {children}
      </div>
    </aside>
  );
}
