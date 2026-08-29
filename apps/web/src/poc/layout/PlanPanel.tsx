import type { ReactNode } from 'react';
import type {
  PocCoordinate,
  PocCostingMode,
  PocElevationPreference,
  PocExperimentalFeatures,
  PocTrafficPreference,
} from '../types';
import { formatAcceptedRangeLabel } from '../types';
import { ActivePreferencesSummary } from './ActivePreferencesSummary';
import { ExperimentalSettingsPanel } from './ExperimentalSettingsPanel';

type Props = {
  start: PocCoordinate | null;
  targetMiles: string;
  flexibilityMiles: string;
  previewRangeMeters: { min: number; max: number };
  costing: PocCostingMode;
  seed: number;
  status: 'idle' | 'loading' | 'error' | 'success';
  errorMessage: string | null;
  locating: boolean;
  locationMessage: string | null;
  locationWarning: string | null;
  features: PocExperimentalFeatures;
  elevationPreference: PocElevationPreference;
  trafficPreference: PocTrafficPreference;
  departureMode: 'now' | 'custom';
  customLocalDateTime: string;
  onTargetMilesChange: (value: string) => void;
  onFlexibilityMilesChange: (value: string) => void;
  onCostingChange: (value: PocCostingMode) => void;
  onUseMyLocation: () => void;
  onGenerate: () => void;
  onApplyFixture: (id: string) => void;
  onExperimentalChange: (next: {
    features: PocExperimentalFeatures;
    elevationPreference: PocElevationPreference;
    trafficPreference: PocTrafficPreference;
    departureMode: 'now' | 'custom';
    customLocalDateTime: string;
  }) => void;
  saveMessage?: string | null;
  children?: ReactNode;
  /** When the mobile map is expanded, obscure plan controls from AT/keyboard. */
  contentObscured?: boolean;
};

export function PlanPanel({
  start,
  targetMiles,
  flexibilityMiles,
  previewRangeMeters,
  costing,
  seed,
  status,
  errorMessage,
  locating,
  locationMessage,
  locationWarning,
  features,
  elevationPreference,
  trafficPreference,
  departureMode,
  customLocalDateTime,
  onTargetMilesChange,
  onFlexibilityMilesChange,
  onCostingChange,
  onUseMyLocation,
  onGenerate,
  onApplyFixture,
  onExperimentalChange,
  saveMessage,
  children,
  contentObscured = false,
}: Props) {
  return (
    <aside
      id="planning-panel-plan"
      className="plan-column is-active"
      data-testid="plan-rail"
      data-active="true"
      aria-label="Plan"
      aria-hidden={contentObscured || undefined}
      inert={contentObscured || undefined}
    >
      <div className="plan-main panel-scroll">
        <p className="plan-help">
          Click the map to set a start, enter a target distance, and generate bicycle loop
          alternatives. Road/Gravel is a costing preference, not a measured surface guarantee.
        </p>

        <div className="start-controls">
          <p className="map-hint" data-testid="start-status">
            {start
              ? `Start: ${start.latitude.toFixed(5)}, ${start.longitude.toFixed(5)}`
              : 'Click the map to select a start point.'}
          </p>
          <button
            type="button"
            className="secondary"
            disabled={locating || status === 'loading'}
            onClick={onUseMyLocation}
          >
            {locating ? 'Locating…' : 'Use my location'}
          </button>
          <p className="subtle location-disclosure">
            Your start location is sent to the configured routing service when you generate routes.
          </p>
          {locationMessage ? (
            <p className="status" role="status">
              {locationMessage}
            </p>
          ) : null}
          {locationWarning ? (
            <p className="status warning" role="status">
              {locationWarning}
            </p>
          ) : null}
        </div>

        <label className="field">
          <span>Target distance (miles)</span>
          <input
            type="number"
            min={1}
            step={0.5}
            value={targetMiles}
            onChange={(event) => onTargetMilesChange(event.target.value)}
          />
        </label>

        <label className="field">
          <span>Distance flexibility (± miles)</span>
          <input
            type="number"
            min={0.5}
            step={0.5}
            value={flexibilityMiles}
            onChange={(event) => onFlexibilityMilesChange(event.target.value)}
          />
          <p className="subtle">{formatAcceptedRangeLabel(previewRangeMeters)}</p>
        </label>

        <fieldset className="field costing-segment" aria-label="Costing mode">
          <legend>Road / Gravel</legend>
          <div className="segmented-control" role="group" aria-label="Costing mode">
            <button
              type="button"
              className={costing === 'road' ? 'segment selected' : 'segment'}
              aria-pressed={costing === 'road'}
              onClick={() => onCostingChange('road')}
            >
              Road
            </button>
            <button
              type="button"
              className={costing === 'gravel' ? 'segment selected' : 'segment'}
              aria-pressed={costing === 'gravel'}
              onClick={() => onCostingChange('gravel')}
            >
              Gravel
            </button>
          </div>
          <p className="subtle">
            Costing preference only — not a measured paved/gravel surface percentage.
          </p>
        </fieldset>

        <ActivePreferencesSummary
          features={features}
          elevationPreference={elevationPreference}
          trafficPreference={trafficPreference}
          departureMode={departureMode}
        />

        <details className="advanced-preferences" data-testid="advanced-preferences">
          <summary>Advanced preferences / POC tools</summary>
          <ExperimentalSettingsPanel
            features={features}
            elevationPreference={elevationPreference}
            trafficPreference={trafficPreference}
            departureMode={departureMode}
            customLocalDateTime={customLocalDateTime}
            disabled={status === 'loading'}
            onChange={onExperimentalChange}
            onApplyFixture={onApplyFixture}
          />
        </details>

        <p className="seed-line">
          Active seed: <code>{seed}</code>
        </p>

        {errorMessage ? (
          <p className="status error" role="alert">
            {errorMessage}
          </p>
        ) : null}

        {status === 'loading' ? (
          <p className="status" role="status">
            Trying up to 10 directionally varied loops…
          </p>
        ) : null}

        {saveMessage ? <p className="status">{saveMessage}</p> : null}

        {children}
      </div>

      <div className="plan-sticky-actions sticky-actions" data-testid="plan-sticky-actions">
        <button
          type="button"
          className="primary-action"
          disabled={status === 'loading'}
          onClick={onGenerate}
        >
          {status === 'loading' ? 'Generating…' : 'Generate routes'}
        </button>
      </div>
    </aside>
  );
}
