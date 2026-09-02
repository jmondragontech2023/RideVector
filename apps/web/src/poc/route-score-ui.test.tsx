import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { RouteComparisonPanel } from './RouteComparisonPanel';
import { RouteScoreBreakdown } from './RouteScoreBreakdown';
import { DEFAULT_POC_FEATURES, type PocAlternative } from './types';

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
  categories: ['closest_to_target'],
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

describe('score UI components', () => {
  it('renders POC fit summary and comparison answers', () => {
    const breakdown = renderToStaticMarkup(
      <RouteScoreBreakdown alternative={alternative} features={DEFAULT_POC_FEATURES} />,
    );
    expect(breakdown).toContain('POC fit 84/100');
    expect(breakdown).toContain('Closest to target');

    const comparison = renderToStaticMarkup(
      <RouteComparisonPanel alternatives={[alternative]} features={DEFAULT_POC_FEATURES} />,
    );
    expect(comparison).toContain('Closest to requested distance?');
    expect(comparison).toContain('Route A');
    expect(comparison).toContain('Traffic enrichment disabled');
  });
});
