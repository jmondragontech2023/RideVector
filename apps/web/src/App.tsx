import { useEffect, useMemo, useRef, useState } from 'react';
import { generatePocRoutes, PocApiError } from './poc/api';
import { emptyDiagnosticSummary, findRejectedPreview } from './poc/candidate-diagnostics';
import {
  defaultFeatureSettings,
  loadFeatureSettings,
  saveFeatureSettings,
} from './poc/feature-settings';
import { POC_SCENARIO_FIXTURES, fixtureFlexibilityMiles } from './poc/fixtures';
import { PlanPanel } from './poc/layout/PlanPanel';
import { PlannerHeader } from './poc/layout/PlannerHeader';
import {
  defaultResultsTab,
  derivePlannerWorkspaceMode,
  formatActivePlanSummary,
  type ResultsWorkspaceTab,
} from './poc/layout/planner-workspace';
import { ExpandableMapPanel } from './poc/layout/ExpandableMapPanel';
import { ResultsPanel } from './poc/layout/ResultsPanel';
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
  DEFAULT_POC_FEATURES,
  type PocAlternative,
  type PocCoordinate,
  type PocCostingMode,
  type PocElevationPreference,
  type PocExperimentalFeatures,
  type PocGenerateResponse,
  type PocTrafficPreference,
} from './poc/types';
import { formatMiles, formatDuration, METERS_PER_MILE, milesToMeters } from './poc/units';
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
import { buildGpxDocument, GpxExportError } from './poc/gpx';
import { downloadGpxFile } from './poc/gpx-download';
import { StartAreaResolver, START_AREA_FALLBACK_LABEL } from './poc/start-area';
import { smokeContractTitle } from './smokeContract';
import { useAppearance } from './poc/use-appearance';

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
  const [startAreaLabel, setStartAreaLabel] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [locationWarning, setLocationWarning] = useState<string | null>(null);
  const [recenterRequest, setRecenterRequest] = useState<MapRecenterRequest | null>(null);
  const [previewAttemptNumber, setPreviewAttemptNumber] = useState<number | null>(null);
  const [features, setFeatures] = useState<PocExperimentalFeatures>({ ...DEFAULT_POC_FEATURES });
  const [elevationPreference, setElevationPreference] = useState<PocElevationPreference>('none');
  const [trafficPreference, setTrafficPreference] = useState<PocTrafficPreference>('none');
  const [departureMode, setDepartureMode] = useState<'now' | 'custom'>('now');
  const [customLocalDateTime, setCustomLocalDateTime] = useState('');
  const [featureSettingsHydrated, setFeatureSettingsHydrated] = useState(false);
  const [resultsTab, setResultsTab] = useState<ResultsWorkspaceTab>('overview');
  const [mapExpanded, setMapExpanded] = useState(false);
  const [mapCollapseToken, setMapCollapseToken] = useState(0);
  const generationSessionRef = useRef(new GenerationSession());
  const locationSessionRef = useRef(new LocationSession());
  const startAreaResolverRef = useRef(new StartAreaResolver());
  const gpxExportSessionRef = useRef(0);
  const { themePreference, mapTheme, setThemePreference, toggleMapTheme } = useAppearance();

  function forceCollapseExpandedMap() {
    setMapCollapseToken((token) => token + 1);
  }

  function rememberStartAreaLabel(label: string | null) {
    setStartAreaLabel(label);
  }

  function updateStartPoint(
    coordinate: PocCoordinate,
    options: { areaLabel?: string | null; resolveArea?: boolean } = {},
  ) {
    setStart(coordinate);
    if (options.areaLabel !== undefined) {
      startAreaResolverRef.current.cancelPending();
      if (options.areaLabel) {
        startAreaResolverRef.current.remember(coordinate, options.areaLabel);
      }
      rememberStartAreaLabel(options.areaLabel);
      return;
    }
    if (options.resolveArea === false) {
      return;
    }

    const cached = startAreaResolverRef.current.getCached(coordinate);
    if (cached) {
      startAreaResolverRef.current.cancelPending();
      rememberStartAreaLabel(cached);
      return;
    }

    rememberStartAreaLabel(null);
    startAreaResolverRef.current.request(coordinate, (label) => {
      rememberStartAreaLabel(label);
    });
  }

  useEffect(() => {
    setSavedRoutes(loadPocStore().routes);
    const settings = loadFeatureSettings();
    setFeatures(settings.features);
    setElevationPreference(settings.elevationPreference);
    setTrafficPreference(settings.trafficPreference);
    setDepartureMode(settings.departureMode);
    setCustomLocalDateTime(settings.customLocalDateTime);
    setFeatureSettingsHydrated(true);

    if (isGeolocationSupported(navigator) && !isSecureGeolocationContext(window)) {
      setLocationMessage(insecureContextGeolocationFailure().message);
    }
  }, []);

  useEffect(() => {
    if (!featureSettingsHydrated) {
      return;
    }
    saveFeatureSettings({
      ...defaultFeatureSettings(),
      features,
      elevationPreference,
      trafficPreference,
      departureMode,
      customLocalDateTime,
    });
  }, [
    featureSettingsHydrated,
    features,
    elevationPreference,
    trafficPreference,
    departureMode,
    customLocalDateTime,
  ]);

  function invalidateInFlightGeneration() {
    generationSessionRef.current.invalidate();
  }

  function invalidateInFlightLocation() {
    locationSessionRef.current.invalidate();
    setLocating(false);
  }

  /** Drop an in-flight start-area warm lookup when the selected plan changes. */
  function invalidateInFlightGpxExport() {
    gpxExportSessionRef.current += 1;
    startAreaResolverRef.current.cancelExport();
  }

  function clearGenerationResults() {
    invalidateInFlightGeneration();
    invalidateInFlightGpxExport();
    // Close expanded map when leaving generated results; keep it open while planning
    // so mobile users can pick a start without the overlay dismissing.
    if (result !== null) {
      forceCollapseExpandedMap();
    }
    setResult(null);
    setSelectedId(null);
    setStatus('idle');
    setErrorMessage(null);
    setSaveMessage(null);
    setPreviewAttemptNumber(null);
    setResultsTab('overview');
  }

  function handleEditPlan() {
    forceCollapseExpandedMap();
    clearGenerationResults();
  }

  function applyExperimentalSettings(next: {
    features: PocExperimentalFeatures;
    elevationPreference: PocElevationPreference;
    trafficPreference: PocTrafficPreference;
    departureMode: 'now' | 'custom';
    customLocalDateTime: string;
  }) {
    clearGenerationResults();
    setFeatures(next.features);
    setElevationPreference(next.elevationPreference);
    setTrafficPreference(next.trafficPreference);
    setDepartureMode(next.departureMode);
    setCustomLocalDateTime(next.customLocalDateTime);
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
  const workspaceMode = derivePlannerWorkspaceMode({ result });
  const planSummary = formatActivePlanSummary({
    targetMiles,
    flexibilityMiles,
    costing,
    features: result?.features ?? features,
  });
  const selectedMapSummary = selected
    ? `${selected.name} · ${formatMiles(selected.distanceMeters)} · ${formatDuration(selected.durationSeconds)}`
    : null;

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
    if (departureMode === 'custom' && customLocalDateTime.trim() === '') {
      setStatus('error');
      setErrorMessage('Choose a custom departure date and time, or switch to Depart now.');
      return;
    }

    setStatus('loading');
    setErrorMessage(null);
    setSaveMessage(null);
    setPreviewAttemptNumber(null);
    invalidateInFlightGpxExport();

    const { token, abortController, signal } = generationSessionRef.current.begin();

    try {
      const response = await generatePocRoutes(
        {
          start: effectiveStart,
          targetDistanceMeters: milesToMeters(miles),
          distanceFlexibilityMeters: milesToMeters(flexMiles),
          costing,
          seed: nextSeed,
          features,
          elevationPreference,
          trafficPreference,
          departure:
            departureMode === 'custom'
              ? {
                  mode: 'custom',
                  localDateTime: new Date(customLocalDateTime).toISOString(),
                  timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
                }
              : { mode: 'now' },
        },
        signal,
      );
      if (!shouldApplyGenerationResponse(generationSessionRef.current, token, signal)) {
        return;
      }
      // Cancel exports started against the previous result while this run was loading.
      invalidateInFlightGpxExport();
      updateStartPoint(effectiveStart, { resolveArea: false });
      setSeed(response.seed);
      setResult(response);
      setSelectedId(response.alternatives[0]?.id ?? null);
      setResultsTab(defaultResultsTab(response));
      setStatus(response.alternatives.length > 0 ? 'success' : 'error');
      setErrorMessage(null);
    } catch (error) {
      if (!shouldApplyGenerationResponse(generationSessionRef.current, token, signal)) {
        return;
      }
      invalidateInFlightGpxExport();
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
    clearGenerationResults();
    invalidateInFlightLocation();
    updateStartPoint(fixture.start, { areaLabel: fixture.label });
    setTargetMiles(String(fixture.targetDistanceMiles));
    setFlexibilityMiles(String(fixtureFlexibilityMiles(fixture)));
    setCosting(fixture.costing);
    setSeed(fixture.seed);
    setSaveMessage(`Loaded fixture: ${fixture.label}`);
  }

  function handleDownloadGpx() {
    if (!selected || !result) {
      setSaveMessage('Generate and select a route before downloading GPX.');
      return;
    }
    if (!start) {
      setSaveMessage('Set a start point before downloading GPX.');
      return;
    }

    try {
      // Keep download inside the user-gesture turn. Awaiting Nominatim first can
      // make Safari/mobile ignore the synthetic <a download> click.
      const knownPlace =
        startAreaLabel && startAreaLabel !== START_AREA_FALLBACK_LABEL
          ? startAreaLabel.trim()
          : null;
      const areaLabel =
        knownPlace || startAreaResolverRef.current.getCached(start) || START_AREA_FALLBACK_LABEL;

      const exported = buildGpxDocument({
        geometry: selected.geometry,
        routeName: selected.name,
        costing,
        seed: result.seed,
        distanceMeters: selected.distanceMeters,
        startAreaLabel: areaLabel,
      });
      downloadGpxFile(exported.xml, exported.filename);
      setSaveMessage(`Downloaded ${exported.filename}.`);

      // If the filename had to use Local, warm Nominatim off the click path so a
      // later download can pick up a real place label after recovery.
      if (areaLabel === START_AREA_FALLBACK_LABEL) {
        const warmToken = ++gpxExportSessionRef.current;
        void startAreaResolverRef.current
          .resolveForExport(start)
          .then((label) => {
            if (warmToken !== gpxExportSessionRef.current) {
              return;
            }
            if (label && label !== START_AREA_FALLBACK_LABEL) {
              rememberStartAreaLabel(label);
            }
          })
          .catch((error: unknown) => {
            if (
              (typeof DOMException !== 'undefined' &&
                error instanceof DOMException &&
                error.name === 'AbortError') ||
              (error instanceof Error && error.name === 'AbortError')
            ) {
              return;
            }
          });
      }
    } catch (error) {
      const message =
        error instanceof GpxExportError
          ? error.message
          : 'Unable to download GPX for the selected route.';
      setSaveMessage(message);
    }
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
      features: result.features ?? features,
      elevationPreference: result.elevationPreference ?? elevationPreference,
      trafficPreference: result.trafficPreference ?? trafficPreference,
      departure: result.departure,
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
    invalidateInFlightGpxExport();
    updateStartPoint(route.start);
    setTargetMiles(String(route.targetDistanceMeters / METERS_PER_MILE));
    setFlexibilityMiles(String(route.distanceFlexibilityMeters / METERS_PER_MILE));
    setCosting(route.costing);
    setSeed(route.seed);
    if (route.features) {
      setFeatures(route.features);
    }
    if (route.elevationPreference) {
      setElevationPreference(route.elevationPreference);
    }
    if (route.trafficPreference) {
      setTrafficPreference(route.trafficPreference);
    }
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
      features: route.features ?? features,
      elevationPreference: route.elevationPreference ?? elevationPreference,
      trafficPreference: route.trafficPreference ?? trafficPreference,
      departure: route.departure,
      scoringVersion: route.alternative.scoring?.version,
      enrichmentWarnings: [],
      attribution: [],
    });
    setSelectedId(route.alternative.id);
    setResultsTab('overview');
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
      const position = await requestCurrentPosition(navigator.geolocation);
      if (!shouldApplyLocationResult(locationSessionRef.current, locationToken)) {
        return;
      }
      clearGenerationResults();
      updateStartPoint(position.coordinate);
      setRecenterRequest(createMapRecenterRequest(position.coordinate, 14));
      setLocationMessage(buildLocationSuccessMessage(position.accuracyMeters));
      setLocationWarning(
        isPoorAccuracy(position.accuracyMeters)
          ? buildPoorAccuracyWarning(position.accuracyMeters)
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
    <div
      className={`poc-shell workspace-${workspaceMode}`}
      data-map-expanded={mapExpanded ? 'true' : 'false'}
    >
      <PlannerHeader
        contractTitle={smokeContractTitle}
        themePreference={themePreference}
        onThemePreferenceChange={setThemePreference}
        savedRoutes={savedRoutes}
        onOpenSaved={handleOpenSaved}
        onDeleteSaved={handleDeleteSaved}
        workspaceMode={workspaceMode}
        planSummary={workspaceMode === 'results' ? planSummary : undefined}
        onEditPlan={workspaceMode === 'results' ? handleEditPlan : undefined}
        contentObscured={mapExpanded}
      />

      <section
        className={`poc-layout poc-layout--${workspaceMode}`}
        aria-label="Route planner"
        data-workspace={workspaceMode}
        data-has-start={start ? 'true' : 'false'}
        data-testid="planner-workspace"
      >
        {workspaceMode === 'planning' ? (
          <PlanPanel
            start={start}
            targetMiles={targetMiles}
            flexibilityMiles={flexibilityMiles}
            previewRangeMeters={previewRangeMeters}
            costing={costing}
            seed={seed}
            status={status}
            errorMessage={errorMessage}
            locating={locating}
            locationMessage={locationMessage}
            locationWarning={locationWarning}
            features={features}
            elevationPreference={elevationPreference}
            trafficPreference={trafficPreference}
            departureMode={departureMode}
            customLocalDateTime={customLocalDateTime}
            onApplyFixture={applyFixture}
            onTargetMilesChange={(value) => {
              setTargetMiles(value);
              clearGenerationResults();
            }}
            onFlexibilityMilesChange={(value) => {
              setFlexibilityMiles(value);
              clearGenerationResults();
            }}
            onCostingChange={(value) => {
              setCosting(value);
              clearGenerationResults();
            }}
            onUseMyLocation={() => void handleUseMyLocation()}
            onGenerate={() => void runGenerate(seed)}
            onExperimentalChange={applyExperimentalSettings}
            saveMessage={saveMessage}
            contentObscured={mapExpanded}
          />
        ) : null}

        <ExpandableMapPanel
          mapTheme={mapTheme}
          onMapThemeToggle={toggleMapTheme}
          selectedSummary={workspaceMode === 'results' ? selectedMapSummary : null}
          collapseToken={mapCollapseToken}
          onExpandedChange={setMapExpanded}
        >
          <RouteMap
            start={start}
            alternatives={alternatives}
            selectedId={selected?.id ?? null}
            recenterRequest={recenterRequest}
            rejectedPreview={rejectedPreview}
            layoutKey={`${workspaceMode}-${resultsTab}-${mapTheme}-${mapExpanded ? 'expanded' : 'inline'}`}
            mapTheme={mapTheme}
            onSelectStart={(coordinate) => {
              invalidateInFlightLocation();
              updateStartPoint(coordinate);
              clearGenerationResults();
              setLocationMessage(null);
              setLocationWarning(null);
            }}
          />
        </ExpandableMapPanel>

        {workspaceMode === 'results' && result ? (
          <ResultsPanel
            result={result}
            selected={selected}
            alternatives={alternatives}
            features={features}
            planSummary={planSummary}
            seed={seed}
            status={status}
            errorMessage={errorMessage}
            resultsTab={resultsTab}
            targetDistanceMeters={targetDistanceMeters}
            previewAttemptNumber={previewAttemptNumber}
            wouldRide={wouldRide}
            feedbackReason={feedbackReason}
            deviationAcceptable={deviationAcceptable}
            saveMessage={saveMessage}
            onResultsTabChange={setResultsTab}
            onSelectAlternative={(id) => {
              invalidateInFlightGpxExport();
              setSelectedId(id);
              setDeviationAcceptable(null);
            }}
            onEditPlan={handleEditPlan}
            onRegenerate={() => void runGenerate(seed + 1)}
            onPreviewAttempt={setPreviewAttemptNumber}
            onWouldRideChange={setWouldRide}
            onFeedbackReasonChange={setFeedbackReason}
            onDeviationAcceptableChange={setDeviationAcceptable}
            onSaveSelected={handleSaveSelected}
            onDownloadGpx={handleDownloadGpx}
            contentObscured={mapExpanded}
          />
        ) : null}
      </section>
    </div>
  );
}
