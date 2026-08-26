import { useState } from 'react';
import { generatePocRoutes, PocApiError } from './poc/api';
import { RouteMap } from './poc/RouteMap';
import type { PocAlternative, PocCoordinate, PocCostingMode, PocGenerateResponse } from './poc/types';
import { formatDuration, formatMiles, milesToMeters } from './poc/units';
import { smokeContractTitle } from './smokeContract';

type Status = 'idle' | 'loading' | 'error' | 'success';

export function App() {
  const [start, setStart] = useState<PocCoordinate | null>(null);
  const [targetMiles, setTargetMiles] = useState('12');
  const [costing, setCosting] = useState<PocCostingMode>('road');
  const [seed, setSeed] = useState(0);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<PocGenerateResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const alternatives = result?.alternatives ?? [];
  const selected: PocAlternative | null =
    alternatives.find((alt) => alt.id === selectedId) ?? alternatives[0] ?? null;

  async function runGenerate(nextSeed: number) {
    if (!start) {
      setStatus('error');
      setErrorMessage('Click the map to choose a start point.');
      return;
    }

    const miles = Number(targetMiles);
    if (!Number.isFinite(miles) || miles <= 0) {
      setStatus('error');
      setErrorMessage('Enter a positive target distance in miles.');
      return;
    }

    setStatus('loading');
    setErrorMessage(null);

    try {
      const response = await generatePocRoutes({
        start,
        targetDistanceMeters: milesToMeters(miles),
        costing,
        seed: nextSeed,
      });
      setSeed(response.seed);
      setResult(response);
      setSelectedId(response.alternatives[0]?.id ?? null);
      setStatus(response.alternatives.length > 0 ? 'success' : 'error');
      if (response.alternatives.length === 0) {
        setErrorMessage(response.warnings[0] ?? 'No valid routes were returned.');
      }
    } catch (error) {
      setResult(null);
      setSelectedId(null);
      setStatus('error');
      setErrorMessage(error instanceof PocApiError ? error.message : 'Unexpected generation failure.');
    }
  }

  return (
    <div className="poc-shell">
      <header className="poc-header">
        <div>
          <p className="eyebrow">Local route-generation POC</p>
          <h1>RideVector</h1>
          <p className="lede">
            Click the map to set a start, enter a target distance, and generate bicycle loop
            alternatives. Road/Gravel is a costing preference, not a measured surface guarantee.
          </p>
        </div>
        <p className="contract-meta" data-testid="contract-title">
          Contract: {smokeContractTitle}
        </p>
      </header>

      <section className="poc-layout" aria-label="Route planner">
        <div className="map-panel">
          <RouteMap
            start={start}
            alternatives={alternatives}
            selectedId={selected?.id ?? null}
            onSelectStart={(coordinate) => {
              setStart(coordinate);
              setErrorMessage(null);
            }}
          />
          <p className="map-hint">
            {start
              ? `Start: ${start.latitude.toFixed(5)}, ${start.longitude.toFixed(5)}`
              : 'Click the map to select a start point.'}
          </p>
        </div>

        <aside className="control-panel">
          <label className="field">
            <span>Target distance (miles)</span>
            <input
              type="number"
              min={1}
              step={0.5}
              value={targetMiles}
              onChange={(event) => setTargetMiles(event.target.value)}
            />
          </label>

          <fieldset className="field">
            <legend>Costing mode</legend>
            <label className="choice">
              <input
                type="radio"
                name="costing"
                checked={costing === 'road'}
                onChange={() => setCosting('road')}
              />
              Road
            </label>
            <label className="choice">
              <input
                type="radio"
                name="costing"
                checked={costing === 'gravel'}
                onChange={() => setCosting('gravel')}
              />
              Gravel
            </label>
          </fieldset>

          <div className="actions">
            <button type="button" disabled={status === 'loading'} onClick={() => void runGenerate(seed)}>
              {status === 'loading' ? 'Generating…' : 'Generate'}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={status === 'loading' || !result}
              onClick={() => void runGenerate(seed + 1)}
            >
              Regenerate
            </button>
          </div>

          <p className="seed-line">
            Seed: <code>{seed}</code>
          </p>

          {errorMessage ? (
            <p className="status error" role="alert">
              {errorMessage}
            </p>
          ) : null}

          {status === 'loading' ? (
            <p className="status" role="status">
              Requesting loop candidates from the local Worker…
            </p>
          ) : null}

          {result && selected ? (
            <div className="result-block">
              <p className="metrics">
                {formatMiles(selected.distanceMeters)} · {formatDuration(selected.durationSeconds)} ·{' '}
                {selected.distanceFromTargetMeters >= 0 ? '+' : ''}
                {formatMiles(Math.abs(selected.distanceFromTargetMeters))} from target
              </p>
              <p className="metrics subtle">
                Generation {result.durationMs} ms · attempted {result.attemptedCount} · accepted{' '}
                {result.acceptedCount}
              </p>

              <ul className="route-cards">
                {alternatives.map((alt) => (
                  <li key={alt.id}>
                    <button
                      type="button"
                      className={alt.id === selected.id ? 'route-card selected' : 'route-card'}
                      onClick={() => setSelectedId(alt.id)}
                    >
                      <strong>{alt.name}</strong>
                      <span>
                        {formatMiles(alt.distanceMeters)} · {formatDuration(alt.durationSeconds)}
                      </span>
                      <span className="subtle">{alt.bearingFamily}</span>
                    </button>
                  </li>
                ))}
              </ul>

              {result.warnings.length > 0 ? (
                <ul className="warnings">
                  {result.warnings.map((warning) => (
                    <li key={warning}>{warning}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </aside>
      </section>
    </div>
  );
}
