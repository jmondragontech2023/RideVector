import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  defaultResultsTab,
  derivePlannerWorkspaceMode,
  formatActivePlanSummary,
  matchingFeaturePresetLabel,
} from './planner-workspace';
import { ResultsWorkspaceTabs } from './ResponsiveWorkspaceTabs';
import { RouteAlternativeSelector } from './RouteAlternativeSelector';
import { ActivePreferencesSummary } from './ActivePreferencesSummary';
import { PlanPanel } from './PlanPanel';
import { ResultsPanel } from './ResultsPanel';
import { PlannerHeader } from './PlannerHeader';
import { routeIdentitySlot, routePresentationForName } from './route-presentation';
import {
  DEFAULT_POC_FEATURES,
  FEATURE_PRESETS,
  type PocAlternative,
  type PocGenerateResponse,
} from '../types';
import { emptyDiagnosticSummary } from '../candidate-diagnostics';

const alternative: PocAlternative = {
  id: 'a',
  name: 'Route A',
  geometry: {
    type: 'LineString',
    coordinates: [
      [-122.42, 37.77],
      [-122.41, 37.77],
      [-122.42, 37.77],
    ],
  },
  distanceMeters: 16093,
  durationSeconds: 3600,
  distanceFromTargetMeters: 100,
  bearingFamily: 'N',
  warnings: [],
  distanceClassification: 'within_range',
  requestedRangeMeters: { min: 10_000, max: 20_000 },
  categories: ['closest_to_target', 'cleanest_loop', 'most_distinct'],
  scoring: {
    version: 'poc-scoring-v1',
    overallScore: 84,
    components: {
      distanceFit: { score: 90, weight: 50, raw: {}, applicable: true },
    },
    missingComponents: [],
    explanations: ['inside your distance range'],
    explanationCodes: ['distance_inside_range'],
    fitSummary: 'POC fit 84/100 — inside your distance range.',
  },
};

const alternativeB: PocAlternative = {
  ...alternative,
  id: 'b',
  name: 'Route B',
  scoring: alternative.scoring
    ? { ...alternative.scoring, overallScore: 90, fitSummary: 'POC fit 90/100' }
    : undefined,
};

function sampleResult(overrides: Partial<PocGenerateResponse> = {}): PocGenerateResponse {
  return {
    seed: 1,
    durationMs: 10,
    attemptedCount: 3,
    acceptedCount: 1,
    alternatives: [alternative],
    rejections: {
      upstream_failure: 0,
      malformed_geometry: 0,
      outside_tolerance: 0,
      duplicate_candidate: 0,
      selection_limit: 0,
      endpoint_mismatch: 0,
    },
    warnings: [],
    candidateDiagnostics: [],
    diagnosticSummary: emptyDiagnosticSummary(),
    distanceFlexibilityMeters: 1609,
    requestedRangeMeters: { min: 10_000, max: 20_000 },
    features: DEFAULT_POC_FEATURES,
    ...overrides,
  };
}

describe('planner workspace helpers', () => {
  it('uses planning when no result is displayed', () => {
    expect(derivePlannerWorkspaceMode({ result: null })).toBe('planning');
  });

  it('uses results when a generation result is present', () => {
    expect(derivePlannerWorkspaceMode({ result: sampleResult() })).toBe('results');
  });

  it('formats the active plan summary and preset label', () => {
    expect(
      formatActivePlanSummary({
        targetMiles: '10',
        flexibilityMiles: '2',
        costing: 'road',
        features: FEATURE_PRESETS.geometry,
      }),
    ).toBe('Loop · 10 mi ±2 mi · Road · Geometry');
    expect(
      formatActivePlanSummary({
        targetMiles: '8',
        flexibilityMiles: '3',
        costing: 'gravel',
        features: FEATURE_PRESETS.basic,
        routeMode: 'point_to_point',
      }),
    ).toBe('Start–end · Gravel · Basic');
    expect(matchingFeaturePresetLabel(FEATURE_PRESETS.basic)).toBe('Basic');
    expect(
      matchingFeaturePresetLabel({
        ...FEATURE_PRESETS.geometry,
        elevationEnrichment: true,
        weatherForecast: true,
      }),
    ).toBe('Custom');
  });

  it('defaults empty generations to the diagnostics tab', () => {
    expect(defaultResultsTab(sampleResult({ alternatives: [] }))).toBe('diagnostics');
    expect(defaultResultsTab(sampleResult())).toBe('overview');
  });
});

describe('route presentation identities', () => {
  it('maps Route B/C/A to blue/violet/orange slots', () => {
    expect(routeIdentitySlot('Route B')).toBe('b');
    expect(routeIdentitySlot('Route C')).toBe('c');
    expect(routeIdentitySlot('Route A')).toBe('a');
    expect(routePresentationForName('Route B').cssVar).toBe('--rv-route-b');
    expect(routePresentationForName('Route C').cssVar).toBe('--rv-route-c');
    expect(routePresentationForName('Route A').cssVar).toBe('--rv-route-a');
  });
});

describe('planner layout presentation', () => {
  it('exposes accessible overview/details/diagnostics tab controls', () => {
    const results = renderToStaticMarkup(
      <ResultsWorkspaceTabs
        active="diagnostics"
        diagnosticsCount={10}
        onChange={() => undefined}
      />,
    );
    expect(results).toContain('Diagnostics (10)');
    expect(results).toContain('aria-selected="true"');
    expect(results).toContain('Overview');
    expect(results).toContain('Details');
    expect(results).toContain('workspace-tab--secondary');
  });

  it('renders compact route cards with selected state and identity attributes', () => {
    const markup = renderToStaticMarkup(
      <RouteAlternativeSelector
        alternatives={[alternative, alternativeB]}
        selectedId="a"
        onSelect={() => undefined}
      />,
    );
    expect(markup).toContain('Route A');
    expect(markup).toContain('Route B');
    expect(markup).toContain('POC fit 84');
    expect(markup).toContain('POC fit 90');
    expect(markup).toContain('Closest to target');
    expect(markup).toContain('Cleanest loop');
    expect(markup).not.toContain('Most distinct');
    expect(markup).not.toContain('Show score details');
    expect(markup).toContain('data-selected="true"');
    expect(markup).toContain('data-route-identity="a"');
    expect(markup).toContain('Selected');
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain('route-card-meta');
    expect(markup).toContain('from target');
  });

  it('renders an active preferences summary', () => {
    const markup = renderToStaticMarkup(
      <ActivePreferencesSummary
        features={FEATURE_PRESETS.geometry}
        elevationPreference="none"
        trafficPreference="none"
        departureMode="now"
      />,
    );
    expect(markup).toContain('data-testid="active-preferences-summary"');
    expect(markup).toContain('Preset: Geometry');
    expect(markup).toContain('distance-fit');
  });

  it('structures the desktop planning rail with advanced preferences disclosure', () => {
    const markup = renderToStaticMarkup(
      <PlanPanel
        start={null}
        end={null}
        routeMode="loop"
        activeEndpoint="start"
        targetMiles="12"
        flexibilityMiles="3"
        previewRangeMeters={{ min: 14_484, max: 24_140 }}
        costing="road"
        seed={1}
        status="idle"
        errorMessage={null}
        locating={false}
        locationMessage={null}
        locationWarning={null}
        features={DEFAULT_POC_FEATURES}
        elevationPreference="none"
        trafficPreference="none"
        departureMode="now"
        customLocalDateTime=""
        onRouteModeChange={() => undefined}
        onActiveEndpointChange={() => undefined}
        onStartChange={() => undefined}
        onEndChange={() => undefined}
        onClearStart={() => undefined}
        onClearEnd={() => undefined}
        onSwapEndpoints={() => undefined}
        onTargetMilesChange={() => undefined}
        onFlexibilityMilesChange={() => undefined}
        onCostingChange={() => undefined}
        onUseMyLocation={() => undefined}
        onGenerate={() => undefined}
        onApplyFixture={() => undefined}
        onExperimentalChange={() => undefined}
      />,
    );

    expect(markup).toContain('data-testid="plan-rail"');
    expect(markup).toContain('data-testid="plan-sticky-actions"');
    expect(markup).toContain('Generate routes');
    expect(markup).toContain('Use my location');
    expect(markup).toContain('secondary');
    expect(markup).toContain('Advanced preferences / POC tools');
    expect(markup).toContain('data-testid="advanced-preferences"');
    expect(markup).toContain('Public scenario fixtures (POC)');
    expect(markup).toContain('Generate a loop');
    expect(markup).toContain('Start and end');
    expect(markup).not.toContain('Map tap sets');
    expect(markup).toContain('Your start location is sent');
    expect(markup).toContain('segmented-control');
    expect(markup).toContain('active-preferences-summary');
  });

  it('hides target distance and flexibility in start-and-end mode', () => {
    const markup = renderToStaticMarkup(
      <PlanPanel
        start={{ latitude: 37.77, longitude: -122.42 }}
        end={{ latitude: 37.8, longitude: -122.47 }}
        routeMode="point_to_point"
        activeEndpoint="end"
        targetMiles="12"
        flexibilityMiles="3"
        previewRangeMeters={{ min: 14_484, max: 24_140 }}
        costing="road"
        seed={1}
        status="idle"
        errorMessage={null}
        locating={false}
        locationMessage={null}
        locationWarning={null}
        features={DEFAULT_POC_FEATURES}
        elevationPreference="none"
        trafficPreference="none"
        departureMode="now"
        customLocalDateTime=""
        onRouteModeChange={() => undefined}
        onActiveEndpointChange={() => undefined}
        onStartChange={() => undefined}
        onEndChange={() => undefined}
        onClearStart={() => undefined}
        onClearEnd={() => undefined}
        onSwapEndpoints={() => undefined}
        onTargetMilesChange={() => undefined}
        onFlexibilityMilesChange={() => undefined}
        onCostingChange={() => undefined}
        onUseMyLocation={() => undefined}
        onGenerate={() => undefined}
        onApplyFixture={() => undefined}
        onExperimentalChange={() => undefined}
      />,
    );

    expect(markup).toContain('Start and end');
    expect(markup).toContain('endpoints define the ride');
    expect(markup).not.toContain('Target distance (miles)');
    expect(markup).not.toContain('Distance flexibility');
    expect(markup).not.toContain('Accepted range');
    expect(markup).not.toContain('entire ride');
  });

  it('omits from-target copy for start-and-end results', () => {
    const markup = renderToStaticMarkup(
      <ResultsPanel
        result={sampleResult({
          routeMode: 'point_to_point',
          alternatives: [alternative],
        })}
        selected={alternative}
        alternatives={[alternative]}
        features={DEFAULT_POC_FEATURES}
        planSummary="Start–end · Road · Geometry"
        seed={1}
        status="success"
        errorMessage={null}
        resultsTab="overview"
        targetDistanceMeters={19_312}
        previewAttemptNumber={null}
        wouldRide="maybe"
        feedbackReason=""
        deviationAcceptable={null}
        saveMessage={null}
        onResultsTabChange={() => undefined}
        onSelectAlternative={() => undefined}
        onEditPlan={() => undefined}
        onRegenerate={() => undefined}
        onPreviewAttempt={() => undefined}
        onWouldRideChange={() => undefined}
        onFeedbackReasonChange={() => undefined}
        onDeviationAcceptableChange={() => undefined}
        onSaveSelected={() => undefined}
        onDownloadGpx={() => undefined}
      />,
    );

    expect(markup).not.toContain('from target');
    expect(markup).toContain('Route A');
  });

  it('structures the desktop decision rail with overview/details/diagnostics and sticky export', () => {
    const markup = renderToStaticMarkup(
      <ResultsPanel
        result={sampleResult({ alternatives: [alternativeB, alternative] })}
        selected={alternativeB}
        alternatives={[alternativeB, alternative]}
        features={DEFAULT_POC_FEATURES}
        planSummary="12 mi ±3 mi · Road · Basic"
        seed={1}
        status="success"
        errorMessage={null}
        resultsTab="overview"
        targetDistanceMeters={19_312}
        previewAttemptNumber={null}
        wouldRide="maybe"
        feedbackReason=""
        deviationAcceptable={null}
        saveMessage={null}
        onResultsTabChange={() => undefined}
        onSelectAlternative={() => undefined}
        onEditPlan={() => undefined}
        onRegenerate={() => undefined}
        onPreviewAttempt={() => undefined}
        onWouldRideChange={() => undefined}
        onFeedbackReasonChange={() => undefined}
        onDeviationAcceptableChange={() => undefined}
        onSaveSelected={() => undefined}
        onDownloadGpx={() => undefined}
      />,
    );

    expect(markup).toContain('data-testid="decision-rail"');
    expect(markup).toContain('data-testid="results-sticky-actions"');
    expect(markup).toContain('Export to Garmin');
    expect(markup).toContain('Download GPX');
    expect(markup).toContain('Save selected locally');
    expect(markup).toContain('Overview');
    expect(markup).toContain('Details');
    expect(markup).toContain('Diagnostics');
    expect(markup).toContain('data-edit-plan-slot="rail"');
    expect(markup).toContain('edit-plan-control--mobile');
    expect(markup).toContain('Regenerate');
    expect(markup).toContain('Route B');
    expect(markup).toContain('results-action-download--desktop');
    expect(markup).toContain('results-more-actions--mobile');
    expect(markup).toContain('action-label--short');
    expect(markup).toContain('>More</summary>');
  });

  it('keeps Garmin wording accurate without implying direct sync', () => {
    const markup = renderToStaticMarkup(
      <ResultsPanel
        result={sampleResult()}
        selected={alternative}
        alternatives={[alternative]}
        features={DEFAULT_POC_FEATURES}
        planSummary="12 mi ±3 mi · Road · Basic"
        seed={1}
        status="success"
        errorMessage={null}
        resultsTab="details"
        targetDistanceMeters={19_312}
        previewAttemptNumber={null}
        wouldRide="maybe"
        feedbackReason=""
        deviationAcceptable={null}
        saveMessage={null}
        onResultsTabChange={() => undefined}
        onSelectAlternative={() => undefined}
        onEditPlan={() => undefined}
        onRegenerate={() => undefined}
        onPreviewAttempt={() => undefined}
        onWouldRideChange={() => undefined}
        onFeedbackReasonChange={() => undefined}
        onDeviationAcceptableChange={() => undefined}
        onSaveSelected={() => undefined}
        onDownloadGpx={() => undefined}
      />,
    );

    expect(markup).toContain('Export to Garmin');
    expect(markup).toContain('downloads a GPX file for import into Garmin Connect');
    expect(markup).toContain('There is no direct Garmin API sync');
    expect(markup).toContain('Training &amp; Planning');
    expect(markup).not.toContain('syncs automatically');
    expect(markup).not.toContain('Garmin API integration');
  });

  it('exposes compact mobile Save/Export/More sticky actions wired to existing handlers', () => {
    const markup = renderToStaticMarkup(
      <ResultsPanel
        result={sampleResult({ alternatives: [alternativeB, alternative] })}
        selected={alternativeB}
        alternatives={[alternativeB, alternative]}
        features={DEFAULT_POC_FEATURES}
        planSummary="12 mi ±3 mi · Road · Basic"
        seed={1}
        status="success"
        errorMessage={null}
        resultsTab="overview"
        targetDistanceMeters={19_312}
        previewAttemptNumber={null}
        wouldRide="maybe"
        feedbackReason=""
        deviationAcceptable={null}
        saveMessage={null}
        onResultsTabChange={() => undefined}
        onSelectAlternative={() => undefined}
        onEditPlan={() => undefined}
        onRegenerate={() => undefined}
        onPreviewAttempt={() => undefined}
        onWouldRideChange={() => undefined}
        onFeedbackReasonChange={() => undefined}
        onDeviationAcceptableChange={() => undefined}
        onSaveSelected={() => undefined}
        onDownloadGpx={() => undefined}
      />,
    );

    expect(markup).toContain('data-testid="results-action-save"');
    expect(markup).toContain('data-testid="results-action-export"');
    expect(markup).toContain('data-testid="results-action-more"');
    expect(markup).toContain('data-testid="results-action-download-desktop"');
    expect(markup).toContain('data-testid="results-action-download-mobile"');
    expect(markup).toContain('aria-label="More export options"');
    expect(markup).toContain('aria-label="Save selected locally"');
    expect(markup).toContain('aria-label="Export to Garmin"');
    expect(markup).toContain('action-label--short');
    expect(markup).toContain('>Save</span>');
    expect(markup).toContain('>Export</span>');
    expect(markup).toContain('results-action-download--desktop');
    expect(markup).toContain('results-more-actions--mobile');
  });

  it('places the sticky-action boundary after the route-alternative selector', () => {
    const markup = renderToStaticMarkup(
      <ResultsPanel
        result={sampleResult({
          alternatives: [alternativeB, alternative, { ...alternative, id: 'c', name: 'Route C' }],
        })}
        selected={alternativeB}
        alternatives={[alternativeB, alternative, { ...alternative, id: 'c', name: 'Route C' }]}
        features={DEFAULT_POC_FEATURES}
        planSummary="12 mi ±3 mi · Road · Basic"
        seed={1}
        status="success"
        errorMessage={null}
        resultsTab="overview"
        targetDistanceMeters={19_312}
        previewAttemptNumber={null}
        wouldRide="maybe"
        feedbackReason=""
        deviationAcceptable={null}
        saveMessage={null}
        onResultsTabChange={() => undefined}
        onSelectAlternative={() => undefined}
        onEditPlan={() => undefined}
        onRegenerate={() => undefined}
        onPreviewAttempt={() => undefined}
        onWouldRideChange={() => undefined}
        onFeedbackReasonChange={() => undefined}
        onDeviationAcceptableChange={() => undefined}
        onSaveSelected={() => undefined}
        onDownloadGpx={() => undefined}
      />,
    );

    const selectorIndex = markup.indexOf('data-testid="route-alternative-selector"');
    const boundaryIndex = markup.indexOf('data-testid="results-sticky-boundary"');
    const stickyIndex = markup.indexOf('data-testid="results-sticky-actions"');
    const tabsIndex = markup.indexOf('aria-label="Route evaluation"');

    expect(selectorIndex).toBeGreaterThan(-1);
    expect(boundaryIndex).toBeGreaterThan(selectorIndex);
    expect(tabsIndex).toBeGreaterThan(boundaryIndex);
    expect(stickyIndex).toBeGreaterThan(boundaryIndex);
    expect(stickyIndex).toBeGreaterThan(tabsIndex);
    expect(markup).toContain('data-testid="results-plan-header"');
    expect(markup.indexOf('data-testid="results-plan-header"')).toBeLessThan(selectorIndex);
    // Sticky actions remain nested inside the boundary (closing order).
    expect(markup).toMatch(
      /data-testid="results-sticky-boundary"[\s\S]*data-testid="results-sticky-actions"[\s\S]*<\/div>\s*<\/aside>/,
    );
  });

  it('marks Edit plan slots so only one is visible per breakpoint', () => {
    const header = renderToStaticMarkup(
      <PlannerHeader
        contractTitle="RideVector API"
        themePreference="system"
        onThemePreferenceChange={() => undefined}
        savedRoutes={[]}
        onOpenSaved={() => undefined}
        onDeleteSaved={() => undefined}
        workspaceMode="results"
        planSummary="12 mi ±3 mi · Road · Geometry"
        onEditPlan={() => undefined}
      />,
    );
    const rail = renderToStaticMarkup(
      <ResultsPanel
        result={sampleResult()}
        selected={alternative}
        alternatives={[alternative]}
        features={DEFAULT_POC_FEATURES}
        planSummary="12 mi ±3 mi · Road · Geometry"
        seed={1}
        status="success"
        errorMessage={null}
        resultsTab="overview"
        targetDistanceMeters={19_312}
        previewAttemptNumber={null}
        wouldRide="maybe"
        feedbackReason=""
        deviationAcceptable={null}
        saveMessage={null}
        onResultsTabChange={() => undefined}
        onSelectAlternative={() => undefined}
        onEditPlan={() => undefined}
        onRegenerate={() => undefined}
        onPreviewAttempt={() => undefined}
        onWouldRideChange={() => undefined}
        onFeedbackReasonChange={() => undefined}
        onDeviationAcceptableChange={() => undefined}
        onSaveSelected={() => undefined}
        onDownloadGpx={() => undefined}
      />,
    );

    expect(header).toContain('data-edit-plan-slot="header"');
    expect(header).toContain('edit-plan-control--desktop');
    expect(rail).toContain('data-edit-plan-slot="rail"');
    expect(rail).toContain('edit-plan-control--mobile');
    expect(header.match(/Edit plan/g)?.length).toBe(1);
    expect(rail.match(/data-edit-plan-slot="rail"/g)?.length).toBe(1);
  });

  it('keeps all three alternatives selectable without dropping cards', () => {
    const alternativeC: PocAlternative = {
      ...alternative,
      id: 'c',
      name: 'Route C',
      scoring: alternative.scoring
        ? { ...alternative.scoring, overallScore: 89, fitSummary: 'POC fit 89/100' }
        : undefined,
    };
    const markup = renderToStaticMarkup(
      <RouteAlternativeSelector
        alternatives={[alternativeB, alternativeC, alternative]}
        selectedId="b"
        onSelect={() => undefined}
      />,
    );
    expect(markup).toContain('data-alternative-count="3"');
    expect(markup).toContain('Route A');
    expect(markup).toContain('Route B');
    expect(markup).toContain('Route C');
    expect(markup).toContain('data-selected="true"');
    expect(markup).toContain('route-card-meta');
    expect(markup).toContain('POC fit 90');
    expect(markup).toContain('POC fit 89');
    expect(markup).toContain('POC fit 84');
  });

  it('simplifies the header and relocates contract metadata under POC tools', () => {
    const markup = renderToStaticMarkup(
      <PlannerHeader
        contractTitle="RideVector API"
        themePreference="system"
        onThemePreferenceChange={() => undefined}
        savedRoutes={[]}
        onOpenSaved={() => undefined}
        onDeleteSaved={() => undefined}
        workspaceMode="planning"
      />,
    );

    expect(markup).toContain('RideVector');
    expect(markup).toContain('Build a ride worth riding');
    expect(markup).toContain('Local POC');
    expect(markup).toContain('Saved routes');
    expect(markup).toContain('POC tools');
    expect(markup).toContain('data-testid="contract-title"');
    expect(markup).toContain('Theme');
    expect(markup).not.toContain('Local route-generation POC</p>');
  });
});
