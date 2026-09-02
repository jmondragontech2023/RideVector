import type { ReactNode } from 'react';
import type {
  PocCoordinate,
  PocCostingMode,
  PocElevationPreference,
  PocExperimentalFeatures,
  PocRouteMode,
  PocTrafficPreference,
} from '../types';
import { formatAcceptedRangeLabel } from '../types';
import { ActivePreferencesSummary } from './ActivePreferencesSummary';
import { ExperimentalSettingsPanel } from './ExperimentalSettingsPanel';

type ActiveEndpoint = 'start' | 'end';

type Props = {
  start: PocCoordinate | null;
  end: PocCoordinate | null;
  routeMode: PocRouteMode;
  activeEndpoint: ActiveEndpoint;
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
  onRouteModeChange: (value: PocRouteMode) => void;
  onActiveEndpointChange: (value: ActiveEndpoint) => void;
  onStartChange: (value: PocCoordinate) => void;
  onEndChange: (value: PocCoordinate) => void;
  onClearStart: () => void;
  onClearEnd: () => void;
  onSwapEndpoints: () => void;
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

function coordinateFieldValue(value: number | undefined): string {
  return value === undefined ? '' : String(value);
}

function parseCoordinatePart(value: string): number | null {
  if (value.trim() === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function PlanPanel({
  start,
  end,
  routeMode,
  activeEndpoint,
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
  onRouteModeChange,
  onActiveEndpointChange,
  onStartChange,
  onEndChange,
  onClearStart,
  onClearEnd,
  onSwapEndpoints,
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
          Choose a loop or a start-to-end ride, set the required locations, enter a target distance
          for the entire ride, and generate bicycle alternatives. Road/Gravel is a costing
          preference, not a measured surface guarantee.
        </p>

        <fieldset className="field costing-segment" aria-label="Ride mode">
          <legend>Ride mode</legend>
          <div className="segmented-control" role="group" aria-label="Ride mode">
            <button
              type="button"
              className={routeMode === 'loop' ? 'segment selected' : 'segment'}
              aria-pressed={routeMode === 'loop'}
              onClick={() => onRouteModeChange('loop')}
            >
              Generate a loop
            </button>
            <button
              type="button"
              className={routeMode === 'point_to_point' ? 'segment selected' : 'segment'}
              aria-pressed={routeMode === 'point_to_point'}
              onClick={() => onRouteModeChange('point_to_point')}
            >
              Start and end
            </button>
          </div>
        </fieldset>

        <div className="start-controls">
          {routeMode === 'point_to_point' ? (
            <fieldset className="field costing-segment" aria-label="Map tap target">
              <legend>Map tap sets</legend>
              <div className="segmented-control" role="group" aria-label="Active location">
                <button
                  type="button"
                  className={activeEndpoint === 'start' ? 'segment selected' : 'segment'}
                  aria-pressed={activeEndpoint === 'start'}
                  onClick={() => onActiveEndpointChange('start')}
                >
                  Start
                </button>
                <button
                  type="button"
                  className={activeEndpoint === 'end' ? 'segment selected' : 'segment'}
                  aria-pressed={activeEndpoint === 'end'}
                  onClick={() => onActiveEndpointChange('end')}
                >
                  End
                </button>
              </div>
              <p className="subtle">
                The selected control receives the next map tap so Start is not overwritten by
                accident.
              </p>
            </fieldset>
          ) : null}

          <p className="map-hint" data-testid="start-status">
            {start
              ? `Start: ${start.latitude.toFixed(5)}, ${start.longitude.toFixed(5)}`
              : 'Click the map to select a start point.'}
          </p>
          {routeMode === 'point_to_point' ? (
            <p className="map-hint" data-testid="end-status">
              {end
                ? `End: ${end.latitude.toFixed(5)}, ${end.longitude.toFixed(5)}`
                : 'Select End, then tap the map or enter coordinates.'}
            </p>
          ) : null}

          <div className="endpoint-editor">
            <div className="endpoint-editor__coords">
              <label className="field">
                <span>Start latitude</span>
                <input
                  type="number"
                  step={0.00001}
                  min={-90}
                  max={90}
                  value={coordinateFieldValue(start?.latitude)}
                  onChange={(event) => {
                    const latitude = parseCoordinatePart(event.target.value);
                    if (latitude === null || latitude < -90 || latitude > 90) {
                      return;
                    }
                    onStartChange({
                      latitude,
                      longitude: start?.longitude ?? 0,
                    });
                  }}
                />
              </label>
              <label className="field">
                <span>Start longitude</span>
                <input
                  type="number"
                  step={0.00001}
                  min={-180}
                  max={180}
                  value={coordinateFieldValue(start?.longitude)}
                  onChange={(event) => {
                    const longitude = parseCoordinatePart(event.target.value);
                    if (longitude === null || longitude < -180 || longitude > 180) {
                      return;
                    }
                    onStartChange({
                      latitude: start?.latitude ?? 0,
                      longitude,
                    });
                  }}
                />
              </label>
            </div>
            {routeMode === 'point_to_point' ? (
              <div className="endpoint-editor__coords">
                <label className="field">
                  <span>End latitude</span>
                  <input
                    type="number"
                    step={0.00001}
                    min={-90}
                    max={90}
                    value={coordinateFieldValue(end?.latitude)}
                    onChange={(event) => {
                      const latitude = parseCoordinatePart(event.target.value);
                      if (latitude === null || latitude < -90 || latitude > 90) {
                        return;
                      }
                      onEndChange({
                        latitude,
                        longitude: end?.longitude ?? 0,
                      });
                    }}
                  />
                </label>
                <label className="field">
                  <span>End longitude</span>
                  <input
                    type="number"
                    step={0.00001}
                    min={-180}
                    max={180}
                    value={coordinateFieldValue(end?.longitude)}
                    onChange={(event) => {
                      const longitude = parseCoordinatePart(event.target.value);
                      if (longitude === null || longitude < -180 || longitude > 180) {
                        return;
                      }
                      onEndChange({
                        latitude: end?.latitude ?? 0,
                        longitude,
                      });
                    }}
                  />
                </label>
              </div>
            ) : null}
            <div className="endpoint-editor__actions">
              <button
                type="button"
                className="secondary"
                disabled={!start || status === 'loading'}
                onClick={onClearStart}
              >
                Clear start
              </button>
              {routeMode === 'point_to_point' ? (
                <>
                  <button
                    type="button"
                    className="secondary"
                    disabled={!end || status === 'loading'}
                    onClick={onClearEnd}
                  >
                    Clear end
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    disabled={!start || !end || status === 'loading'}
                    onClick={onSwapEndpoints}
                  >
                    Swap start and end
                  </button>
                </>
              ) : null}
            </div>
          </div>

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
            {routeMode === 'point_to_point'
              ? ' End is sent only for start-and-end rides.'
              : ''}
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
          <span>
            Target distance (miles)
            {routeMode === 'point_to_point' ? ' — entire ride' : ''}
          </span>
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
            {routeMode === 'point_to_point'
              ? 'Trying up to 10 start-to-end alternatives…'
              : 'Trying up to 10 directionally varied loops…'}
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
