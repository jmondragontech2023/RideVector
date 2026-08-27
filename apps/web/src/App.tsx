import { useEffect, useMemo, useRef, useState } from 'react';
import { generatePocRoutes, PocApiError } from './poc/api';
import { CandidateDiagnosticsPanel } from './poc/CandidateDiagnosticsPanel';
import { emptyDiagnosticSummary, findRejectedPreview } from './poc/candidate-diagnostics';
import { POC_SCENARIO_FIXTURES, fixtureFlexibilityMiles } from './poc/fixtures';
import { RouteMap } from './poc/RouteMap';
import {
  deleteSavedRoute,
  loadPocStore,
  savePocStore,
  upsertSavedRoute,
  type SavedPocRoute,
  type WouldRide,
} from './poc/storage';
import {
  DEFAULT_DISTANCE_FLEXIBILITY_MILES,
  formatAcceptedRangeLabel,
  formatNearMatchDeviation,
  type PocAlternative,
  type PocCoordinate,
  type PocCostingMode,
  type PocGenerateResponse,
} from './poc/types';
import { formatDuration, formatMiles, METERS_PER_MILE, milesToMeters } from './poc/units';
import {
  buildLocationSuccessMessage,
  buildPoorAccuracyWarning,
  geolocationErrorMessage,
  insecureContextGeolocationFailure,
  isGeolocationSupported,
  isPoorAccuracy,
  isSecureGeolocationContext,
  requestCurrentPosition,
  unsupportedGeolocationFailure,
} from './poc/geolocation';
import { GenerationSession, shouldApplyGenerationResponse } from './poc/generation-session';
import { LocationSession, shouldApplyLocationResult } from './poc/location-session';
import { createMapRecenterRequest, type MapRecenterRequest } from './poc/map-recenter';
import { smokeContractTitle } from './smokeContract';

type Status = 'idle' | 'loading' | 'error' | 'success';

export function App() {
  const [start, setStart] = useState<PocCoordinate | null>(null);
  const [targetMiles, setTargetMiles] = useState('12');
  const [flexibilityMiles, setFlexibilityMiles] = useState(
    String(DEFAULT_DISTANCE_FLEXIBILITY_MILES),
  );
  const [costing, setCosting] = useState<PocCostingMode>('road');
  const [seed, setSeed] = useState(0);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<PocGenerateResponse | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [savedRoutes, setSavedRoutes] = useState<SavedPocRoute[]>([]);
  const [wouldRide, setWouldRide] = useState<WouldRide>('maybe');
  const [feedbackReason, setFeedbackReason] = useState('');
  const [deviationAcceptable, setDeviationAcceptable] = useState<boolean | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [locationWarning, setLocationWarning] = useState<string | null>(null);
  const [recenterRequest, setRecenterRequest] = useState<MapRecenterRequest | null>(null);
  const [diagnosticsExpanded, setDiagnosticsExpanded] = useState(false);
  const [previewAttemptNumber, setPreviewAttemptNumber] = useState<number | null>(null);
  const generationSessionRef = useRef(new GenerationSession());
  const locationSessionRef = useRef(new LocationSession());

  useEffect(() => {
    setSavedRoutes(loadPocStore().routes);
  }, []);

  function invalidateInFlightGeneration() {
    generationSessionRef.current.invalidate();
  }

  function invalidateInFlightLocation() {
    locationSessionRef.current.invalidate();
    setLocating(false);
  }

  function clearGenerationResults() {
    invalidateInFlightGeneration();
    setResult(null);
    setSelectedId(null);
    setStatus('idle');
    setErrorMessage(null);
    setSaveMessage(null);
    setDiagnosticsExpanded(false);
    setPreviewAttemptNumber(null);
  }

  const targetDistanceMeters = milesToMeters(Number(targetMiles) || 0);
  const flexibilityMeters = milesToMeters(
    Number(flexibilityMiles) || DEFAULT_DISTANCE_FLEXIBILITY_MILES,
  );
  const previewRangeMeters = {
    min: Math.max(0, targetDistanceMeters - flexibilityMeters),
    max: targetDistanceMeters + flexibilityMeters,
  };
  const rejectedPreview = useMemo(
    () => findRejectedPreview(result, previewAttemptNumber),
    [result, previewAttemptNumber],
  );

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
    const flexMiles = Number(flexibilityMiles);
    if (!Number.isFinite(miles) || miles <= 0) {
      setStatus('error');
      setErrorMessage('Enter a positive target distance in miles.');
      return;
    }
    if (!Number.isFinite(flexMiles) || flexMiles <= 0) {
      setStatus('error');
      setErrorMessage('Enter a positive distance flexibility in miles.');
      return;
    }

    setStatus('loading');
    setErrorMessage(null);
    setSaveMessage(null);
    setPreviewAttemptNumber(null);

    const { token, abortController, signal } = generationSessionRef.current.begin();

    try {
      const response = await generatePocRoutes(
        {
          start: effectiveStart,
          targetDistanceMeters: milesToMeters(miles),
          distanceFlexibilityMeters: milesToMeters(flexMiles),
          costing,
          seed: nextSeed,
        },
        signal,
      );
      if (!shouldApplyGenerationResponse(generationSessionRef.current, token, signal)) {
        return;
      }
      setStart(effectiveStart);
      setSeed(response.seed);
      setResult(response);
      setSelectedId(response.alternatives[0]?.id ?? null);
      setDiagnosticsExpanded(response.alternatives.length === 0);
      setStatus(response.alternatives.length > 0 ? 'success' : 'error');
      setErrorMessage(null);
    } catch (error) {
      if (!shouldApplyGenerationResponse(generationSessionRef.current, token, signal)) {
        return;
      }
      setResult(null);
      setSelectedId(null);
      setStatus('error');
      setErrorMessage(
        error instanceof PocApiError ? error.message : 'Unexpected generation failure.',
      );
    } finally {
      generationSessionRef.current.release(abortController);
    }
  }

  function applyFixture(id: string) {
    const fixture = POC_SCENARIO_FIXTURES.find((item) => item.id === id);
    if (!fixture) {
      return;
    }
    // Clears in-flight generation and resets status so loading cannot stick.
    clearGenerationResults();
    invalidateInFlightLocation();
    setStart(fixture.start);
    setTargetMiles(String(fixture.targetDistanceMiles));
    setFlexibilityMiles(String(fixtureFlexibilityMiles(fixture)));
    setCosting(fixture.costing);
    setSeed(fixture.seed);
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
      distanceFlexibilityMeters: milesToMeters(Number(flexibilityMiles)),
      costing,
      seed: result.seed,
      alternative: selected,
      feedback: {
        wouldRide,
        ...(selected.distanceClassification === 'near_match' && deviationAcceptable !== null
          ? { deviationAcceptable }
          : {}),
        ...(feedbackReason.trim() ? { reason: feedbackReason.trim().slice(0, 280) } : {}),
      },
    };
    const next = upsertSavedRoute(loadPocStore(), saved);
    savePocStore(next);
    setSavedRoutes(next.routes);
    setSaveMessage(`Saved ${saved.label} locally.`);
  }

  function handleOpenSaved(route: SavedPocRoute) {
    invalidateInFlightGeneration();
    invalidateInFlightLocation();
    setStart(route.start);
    setTargetMiles(String(route.targetDistanceMeters / METERS_PER_MILE));
    setFlexibilityMiles(String(route.distanceFlexibilityMeters / METERS_PER_MILE));
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
        selection_limit: 0,
      },
      warnings: ['Opened from local saved routes.'],
      candidateDiagnostics: [],
      diagnosticSummary: emptyDiagnosticSummary(),
      distanceFlexibilityMeters: route.distanceFlexibilityMeters,
      requestedRangeMeters: route.alternative.requestedRangeMeters,
    });
    setSelectedId(route.alternative.id);
    setDiagnosticsExpanded(false);
    setPreviewAttemptNumber(null);
    setDeviationAcceptable(route.feedback?.deviationAcceptable ?? null);
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

  async function handleUseMyLocation() {
    if (!isGeolocationSupported(navigator)) {
      setLocationMessage(unsupportedGeolocationFailure().message);
      setLocationWarning(null);
      return;
    }

    if (!isSecureGeolocationContext(window)) {
      setLocationMessage(insecureContextGeolocationFailure().message);
      setLocationWarning(null);
      return;
    }

    const locationToken = locationSessionRef.current.begin();
    setLocating(true);
    setLocationMessage(null);
    setLocationWarning(null);

    try {
      const result = await requestCurrentPosition(navigator.geolocation);
      if (!shouldApplyLocationResult(locationSessionRef.current, locationToken)) {
        return;
      }
      clearGenerationResults();
      setStart(result.coordinate);
      setRecenterRequest(createMapRecenterRequest(result.coordinate, 14));
      setLocationMessage(buildLocationSuccessMessage(result.accuracyMeters));
      setLocationWarning(
        isPoorAccuracy(result.accuracyMeters)
          ? buildPoorAccuracyWarning(result.accuracyMeters)
          : null,
      );
    } catch (error) {
      if (!shouldApplyLocationResult(locationSessionRef.current, locationToken)) {
        return;
      }
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        typeof (error as GeolocationPositionError).code === 'number'
      ) {
        setLocationMessage(
          geolocationErrorMessage(
            error as GeolocationPositionError,
            isSecureGeolocationContext(window),
          ).message,
        );
      } else {
        setLocationMessage('Unable to read your location. Click the map to set a start manually.');
      }
      setLocationWarning(null);
    } finally {
      if (shouldApplyLocationResult(locationSessionRef.current, locationToken)) {
        setLocating(false);
      }
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
            recenterRequest={recenterRequest}
            rejectedPreview={rejectedPreview}
            onSelectStart={(coordinate) => {
              invalidateInFlightLocation();
              setStart(coordinate);
              clearGenerationResults();
              setLocationMessage(null);
              setLocationWarning(null);
            }}
          />
          <div className="start-controls">
            <button
              type="button"
              className="secondary"
              disabled={locating || status === 'loading'}
              onClick={() => void handleUseMyLocation()}
            >
              {locating ? 'Locating…' : 'Use my location'}
            </button>
            <p className="subtle location-disclosure">
              Your start location is sent to the configured routing service when you generate
              routes.
            </p>
          </div>
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
              onChange={(event) => {
                setTargetMiles(event.target.value);
                clearGenerationResults();
              }}
            />
          </label>

          <label className="field">
            <span>Distance flexibility (± miles)</span>
            <input
              type="number"
              min={0.5}
              step={0.5}
              value={flexibilityMiles}
              onChange={(event) => {
                setFlexibilityMiles(event.target.value);
                clearGenerationResults();
              }}
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
                onChange={() => {
                  setCosting('road');
                  clearGenerationResults();
                }}
              />
              Road
            </label>
            <label className="choice">
              <input
                type="radio"
                name="costing"
                checked={costing === 'gravel'}
                onChange={() => {
                  setCosting('gravel');
                  clearGenerationResults();
                }}
              />
              Gravel
            </label>
            <p className="subtle">
              Costing preference only — not a measured paved/gravel surface percentage.
            </p>
          </fieldset>

          <div className="actions">
            <button
              type="button"
              disabled={status === 'loading'}
              onClick={() => void runGenerate(seed)}
            >
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
              Trying up to 10 directionally varied loops…
            </p>
          ) : null}

          {result ? (
            <CandidateDiagnosticsPanel
              result={result}
              targetDistanceMeters={targetDistanceMeters}
              expanded={diagnosticsExpanded}
              onToggleExpanded={() => setDiagnosticsExpanded((value) => !value)}
              previewAttemptNumber={previewAttemptNumber}
              onPreviewAttempt={setPreviewAttemptNumber}
            />
          ) : null}

          {result && selected ? (
            <div className="result-block">
              <p className="metrics">
                {formatMiles(selected.distanceMeters)} · {formatDuration(selected.durationSeconds)}{' '}
                · {selected.distanceFromTargetMeters >= 0 ? '+' : ''}
                {formatMiles(Math.abs(selected.distanceFromTargetMeters))} from target
              </p>
              <p className="metrics subtle">
                Generation {result.durationMs} ms · attempted {result.attemptedCount} · accepted{' '}
                {result.acceptedCount}
              </p>

              <ul className="route-cards">
                {alternatives.map((alt) => {
                  const nearMatchDeviation = formatNearMatchDeviation(alt);
                  return (
                    <li key={alt.id}>
                      <button
                        type="button"
                        className={alt.id === selected.id ? 'route-card selected' : 'route-card'}
                        onClick={() => {
                          setSelectedId(alt.id);
                          setDeviationAcceptable(null);
                        }}
                      >
                        <span className="route-card-title">
                          <strong>{alt.name}</strong>
                          {alt.distanceClassification === 'near_match' ? (
                            <span className="near-match-badge">Near match</span>
                          ) : null}
                        </span>
                        <span>
                          {formatMiles(alt.distanceMeters)} · {formatDuration(alt.durationSeconds)}
                        </span>
                        {nearMatchDeviation ? (
                          <span className="near-match-deviation">{nearMatchDeviation}</span>
                        ) : null}
                        <span className="subtle">{alt.bearingFamily}</span>
                      </button>
                    </li>
                  );
                })}
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
                {selected.distanceClassification === 'near_match' ? (
                  <fieldset className="field">
                    <legend>Was this distance deviation acceptable?</legend>
                    <label className="choice">
                      <input
                        type="radio"
                        name="deviationAcceptable"
                        checked={deviationAcceptable === true}
                        onChange={() => setDeviationAcceptable(true)}
                      />
                      Yes, acceptable for this ride
                    </label>
                    <label className="choice">
                      <input
                        type="radio"
                        name="deviationAcceptable"
                        checked={deviationAcceptable === false}
                        onChange={() => setDeviationAcceptable(false)}
                      />
                      No, too far from my requested range
                    </label>
                  </fieldset>
                ) : null}
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
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => handleOpenSaved(route)}
                      >
                        Open
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => handleDeleteSaved(route.id)}
                      >
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
