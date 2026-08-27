import { describe, expect, it } from 'vitest';
import { buildGenerationSummary } from './candidate-diagnostics';
import { fixtureFlexibilityMiles, POC_SCENARIO_FIXTURES } from './fixtures';
import {
  DEFAULT_DISTANCE_FLEXIBILITY_MILES,
  formatAcceptedRangeLabel,
  formatNearMatchDeviation,
  type PocAlternative,
  type PocGenerateResponse,
} from './types';
import { METERS_PER_MILE } from './units';

function alternative(overrides: Partial<PocAlternative> = {}): PocAlternative {
  return {
    id: 'alt-1',
    name: 'Route A',
    geometry: { type: 'LineString', coordinates: [[-122.42, 37.77]] },
    distanceMeters: 12.8 * METERS_PER_MILE,
    durationSeconds: 3000,
    distanceFromTargetMeters: 0.8 * METERS_PER_MILE,
    bearingFamily: '120°',
    warnings: [],
    distanceClassification: 'within_range',
    requestedRangeMeters: {
      min: 9 * METERS_PER_MILE,
      max: 15 * METERS_PER_MILE,
    },
    ...overrides,
  };
}

function response(overrides: Partial<PocGenerateResponse> = {}): PocGenerateResponse {
  return {
    seed: 1,
    durationMs: 100,
    attemptedCount: 10,
    acceptedCount: 0,
    alternatives: [],
    rejections: {
      upstream_failure: 0,
      malformed_geometry: 0,
      outside_tolerance: 6,
      duplicate_candidate: 2,
      selection_limit: 0,
    },
    warnings: [],
    candidateDiagnostics: [],
    diagnosticSummary: {
      attemptedCount: 10,
      acceptedCount: 0,
      rejectionCounts: {
        upstream_failure: 2,
        malformed_geometry: 0,
        outside_tolerance: 6,
        duplicate_candidate: 2,
        selection_limit: 0,
      },
    },
    distanceFlexibilityMeters: 3 * METERS_PER_MILE,
    requestedRangeMeters: {
      min: 9 * METERS_PER_MILE,
      max: 15 * METERS_PER_MILE,
    },
    ...overrides,
  };
}

describe('distance flexibility UI helpers', () => {
  it('formats the accepted range label from meters', () => {
    expect(
      formatAcceptedRangeLabel({
        min: 10 * METERS_PER_MILE,
        max: 16 * METERS_PER_MILE,
      }),
    ).toBe('Accepted range: 10.0–16.0 miles.');
  });

  it('defaults fixtures to three miles unless specified', () => {
    expect(fixtureFlexibilityMiles(POC_SCENARIO_FIXTURES[0]!)).toBe(
      DEFAULT_DISTANCE_FLEXIBILITY_MILES,
    );
    expect(fixtureFlexibilityMiles(POC_SCENARIO_FIXTURES[4]!)).toBe(4);
  });

  it('describes near-match deviation plainly', () => {
    const text = formatNearMatchDeviation(
      alternative({
        distanceClassification: 'near_match',
        rangeDeviationMeters: 0.8 * METERS_PER_MILE,
      }),
    );
    expect(text).toBe('0.8 miles above your requested range.');
  });

  it('builds descriptive zero-result summaries with requested range', () => {
    const summary = buildGenerationSummary(response({ acceptedCount: 0 }));
    expect(summary).toContain('Tried 10 candidates');
    expect(summary).toContain('9.0–15.0 mile range');
  });

  it('builds near-match-only summaries without claiming exact range satisfaction', () => {
    const summary = buildGenerationSummary(
      response({
        acceptedCount: 2,
        alternatives: [
          alternative({ distanceClassification: 'near_match', id: 'a' }),
          alternative({ distanceClassification: 'near_match', id: 'b', name: 'Route B' }),
        ],
        warnings: ['No routes met your exact range. Showing the two closest near matches.'],
        diagnosticSummary: {
          attemptedCount: 10,
          acceptedCount: 2,
          rejectionCounts: {
            upstream_failure: 0,
            malformed_geometry: 0,
            outside_tolerance: 8,
            duplicate_candidate: 0,
            selection_limit: 0,
          },
        },
      }),
    );
    expect(summary).toContain('exact range');
    expect(summary).not.toContain('passed within');
  });
});
