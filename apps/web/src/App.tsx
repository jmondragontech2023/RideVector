import { useEffect, useState } from 'react';
import { generatePocRoutes, PocApiError } from './poc/api';
import { POC_SCENARIO_FIXTURES } from './poc/fixtures';
import { RouteMap } from './poc/RouteMap';
import {
  deleteSavedRoute,
  loadPocStore,
  savePocStore,
  upsertSavedRoute,
  type SavedPocRoute,
  type WouldRide,
} from './poc/storage';
import type { PocAlternative, PocCoordinate, PocCostingMode, PocGenerateResponse } from './poc/types';
import { formatDuration, formatMiles, METERS_PER_MILE, milesToMeters } from './poc/units';
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
  const [savedRoutes, setSavedRoutes] = useState<SavedPocRoute[]>([]);
  const [wouldRide, setWouldRide] = useState<WouldRide>('maybe');
  const [feedbackReason, setFeedbackReason] = useState('');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  useEffect(() => {
    setSavedRoutes(loadPocStore().routes);
  }, []);

  const alternatives = result?.alternatives ?? [];
  const selected: PocAlternative | null =
    alternatives.find((alt) => alt.id === selectedId) ?? alternatives[0] ?? null;

  async function runGenerate(nextSeed: number, overrideStart?: PocCoordinate) {
    const effectiveStart = overrideStart ?? start;
    if (!effectiveStart) {
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
    setSaveMessage(null);

    try {
      const response = await generatePocRoutes({
        start: effectiveStart,
        targetDistanceMeters: milesToMeters(miles),
        costing,
        seed: nextSeed,
      });
      setStart(effectiveStart);
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

  function applyFixture(id: string) {
    const fixture = POC_SCENARIO_FIXTURES.find((item) => item.id === id);
    if (!fixture) {
      return;
    }
    setStart(fixture.start);
    setTargetMiles(String(fixture.targetDistanceMiles));
    setCosting(fixture.costing);
    setSeed(fixture.seed);
    setResult(null);
    setSelectedId(null);
    setErrorMessage(null);
    setSaveMessage(`Loaded fixture: ${fixture.label}`);
  }

  function handleSaveSelected() {
    if (!start || !selected || !result) {
      setSaveMessage('Generate and select a route before saving.');
      return;
    }
    const saved: SavedPocRoute = {
      id: `saved-${selected.id}-${result.seed}`,
      savedAt: new Date().toISOString(),
      label: `${selected.name} · ${formatMiles(selected.distanceMeters)}`,
      start,
      targetDistanceMeters: milesToMeters(Number(targetMiles)),
      costing,
      seed: result.seed,
      alternative: selected,
      feedback: {
        wouldRide,
        ...(feedbackReason.trim() ? { reason: feedbackReason.trim().slice(0, 280) } : {}),
      },
    };
    const next = upsertSavedRoute(loadPocStore(), saved);
    savePocStore(next);
    setSavedRoutes(next.routes);
    setSaveMessage(`Saved ${saved.label} locally.`);
  }

  function handleOpenSaved(route: SavedPocRoute) {
    setStart(route.start);
    setTargetMiles(String(route.targetDistanceMeters / METERS_PER_MILE));
    setCosting(route.costing);
    setSeed(route.seed);
    setResult({
      seed: route.seed,
      durationMs: 0,
      attemptedCount: 0,
      acceptedCount: 1,
      alternatives: [route.alternative],
      rejections: {
        upstream_failure: 0,
        malformed_geometry: 0,
        outside_tolerance: 0,
        duplicate_candidate: 0,
      },
      warnings: ['Opened from local saved routes.'],
    });
    setSelectedId(route.alternative.id);
    setWouldRide(route.feedback?.wouldRide ?? 'maybe');
    setFeedbackReason(route.feedback?.reason ?? '');
    setStatus('success');
    setSaveMessage(`Reopened ${route.label}.`);
  }

  function handleDeleteSaved(id: string) {
    const next = deleteSavedRoute(loadPocStore(), id);
    savePocStore(next);
    setSavedRoutes(next.routes);
    setSaveMessage('Deleted local saved route.');
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
            <span>Scenario fixture</span>
            <select
              defaultValue=""
              onChange={(event) => {
                if (event.target.value) {
                  applyFixture(event.target.value);
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
            <p className="subtle">
              Costing preference only — not a measured paved/gravel surface percentage.
            </p>
          </fieldset>

          <div className="actions">
            <button type="button" disabled={status === 'loading'} onClick={() => void runGenerate(seed)}>
              {status === 'loading' ? 'Generating…' : 'Generate'}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={status === 'loading'}
              onClick={() => void runGenerate(seed + 1)}
            >
              Regenerate
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

              <fieldset className="field feedback-block">
                <legend>Would you ride this?</legend>
                {(['yes', 'maybe', 'no'] as const).map((value) => (
                  <label key={value} className="choice">
                    <input
                      type="radio"
                      name="wouldRide"
                      checked={wouldRide === value}
                      onChange={() => setWouldRide(value)}
                    />
                    {value}
                  </label>
                ))}
                <label className="field">
                  <span>Optional reason</span>
                  <textarea
                    rows={2}
                    maxLength={280}
                    value={feedbackReason}
                    onChange={(event) => setFeedbackReason(event.target.value)}
                    placeholder="Why regenerate or reject?"
                  />
                </label>
                <button type="button" onClick={handleSaveSelected}>
                  Save selected locally
                </button>
              </fieldset>
            </div>
          ) : null}

          {saveMessage ? <p className="status">{saveMessage}</p> : null}

          <section className="saved-block" aria-label="Saved local routes">
            <h2>Saved locally</h2>
            {savedRoutes.length === 0 ? (
              <p className="subtle">No browser-local saves yet.</p>
            ) : (
              <ul className="saved-list">
                {savedRoutes.map((route) => (
                  <li key={route.id}>
                    <div>
                      <strong>{route.label}</strong>
                      <p className="subtle">
                        seed {route.seed}
                        {route.feedback ? ` · would ride: ${route.feedback.wouldRide}` : ''}
                      </p>
                    </div>
                    <div className="actions">
                      <button type="button" className="secondary" onClick={() => handleOpenSaved(route)}>
                        Open
                      </button>
                      <button type="button" className="secondary" onClick={() => handleDeleteSaved(route.id)}>
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </section>
    </div>
  );
}
