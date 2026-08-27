import type { ReactNode } from 'react';
import { POC_SCENARIO_FIXTURES } from '../fixtures';
import { formatAcceptedRangeLabel, type PocCoordinate, type PocCostingMode } from '../types';

type Props = {
  active: boolean;
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
  onApplyFixture: (id: string) => void;
  onTargetMilesChange: (value: string) => void;
  onFlexibilityMilesChange: (value: string) => void;
  onCostingChange: (value: PocCostingMode) => void;
  onUseMyLocation: () => void;
  onGenerate: () => void;
  children?: ReactNode;
};

export function PlanPanel({
  active,
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
  onApplyFixture,
  onTargetMilesChange,
  onFlexibilityMilesChange,
  onCostingChange,
  onUseMyLocation,
  onGenerate,
  children,
}: Props) {
  return (
    <aside
      id="planning-panel-plan"
      className={active ? 'plan-column is-active' : 'plan-column'}
      data-active={active ? 'true' : 'false'}
      aria-label="Plan"
    >
      <div className="panel-scroll">
        <p className="plan-help">
          Click the map to set a start, enter a target distance, and generate bicycle loop
          alternatives. Road/Gravel is a costing preference, not a measured surface guarantee.
        </p>

        <label className="field">
          <span>Scenario fixture</span>
          <select
            defaultValue=""
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
        </label>

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

        <fieldset className="field">
          <legend>Costing mode</legend>
          <label className="choice">
            <input
              type="radio"
              name="costing"
              checked={costing === 'road'}
              onChange={() => onCostingChange('road')}
            />
            Road
          </label>
          <label className="choice">
            <input
              type="radio"
              name="costing"
              checked={costing === 'gravel'}
              onChange={() => onCostingChange('gravel')}
            />
            Gravel
          </label>
          <p className="subtle">
            Costing preference only — not a measured paved/gravel surface percentage.
          </p>
        </fieldset>

        <div className="start-controls">
          <p className="map-hint">
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

        <div className="actions sticky-actions">
          <button type="button" disabled={status === 'loading'} onClick={onGenerate}>
            {status === 'loading' ? 'Generating…' : 'Generate'}
          </button>
        </div>

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

        {children}
      </div>
    </aside>
  );
}
