import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  defaultResultsTab,
  derivePlannerWorkspaceMode,
  formatActivePlanSummary,
  matchingFeaturePresetLabel,
} from './planner-workspace';
import { PlanningWorkspaceTabs, ResultsWorkspaceTabs } from './ResponsiveWorkspaceTabs';
import { RouteAlternativeSelector } from './RouteAlternativeSelector';
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
    ).toBe('10 mi ±2 mi · Road · Geometry');
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

describe('planner layout presentation', () => {
  it('exposes accessible planning and results tab controls', () => {
    const planning = renderToStaticMarkup(
      <PlanningWorkspaceTabs active="plan" onChange={() => undefined} />,
    );
    expect(planning).toContain('aria-selected="true"');
    expect(planning).toContain('Plan');
    expect(planning).toContain('Experiment');

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
  });

  it('renders compact route cards without inline score breakdowns', () => {
    const markup = renderToStaticMarkup(
      <RouteAlternativeSelector
        alternatives={[alternative]}
        selectedId="a"
        onSelect={() => undefined}
      />,
    );
    expect(markup).toContain('Route A');
    expect(markup).toContain('POC fit 84');
    expect(markup).toContain('Closest to target');
    expect(markup).toContain('Cleanest loop');
    expect(markup).not.toContain('Most distinct');
    expect(markup).not.toContain('Show score details');
    expect(markup).toContain('aria-pressed="true"');
  });
});
