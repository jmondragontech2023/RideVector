import { describe, expect, it } from 'vitest';
import {
  buildGenerationSummary,
  canPreviewOnMap,
  formatTargetDeltaWithTarget,
  rejectionReasonLabel,
  rejectedPreviewFromDiagnostic,
} from './candidate-diagnostics';
import type { PocCandidateDiagnostic, PocGenerateResponse } from './types';

function diagnostic(
  overrides: Partial<PocCandidateDiagnostic> & Pick<PocCandidateDiagnostic, 'attemptNumber'>,
): PocCandidateDiagnostic {
  return {
    bearingFamily: '120°',
    outcome: 'rejected',
    explanation: 'Test explanation.',
    ...overrides,
  };
}

function response(overrides: Partial<PocGenerateResponse>): PocGenerateResponse {
  return {
    seed: 1,
    durationMs: 100,
    attemptedCount: 10,
    acceptedCount: 0,
    alternatives: [],
    rejections: {
      upstream_failure: 2,
      malformed_geometry: 0,
      outside_tolerance: 6,
      duplicate_candidate: 2,
      selection_limit: 0,
      endpoint_mismatch: 0,
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
        endpoint_mismatch: 0,
      },
      closestRoutableRejected: {
        attemptNumber: 3,
        distanceMeters: 9.1 * 1609.344,
        distanceFromTargetMeters: -4.7 * 1609.344,
        toleranceMissMeters: 0.5 * 1609.344,
        toleranceMissPercent: 4.2,
        direction: 'below',
      },
    },
    distanceFlexibilityMeters: 3 * 1609.344,
    requestedRangeMeters: {
      min: 9 * 1609.344,
      max: 15 * 1609.344,
    },
    ...overrides,
  };
}

describe('candidate diagnostics helpers', () => {
  const targetDistanceMeters = 12 * 1609.344;
  const geometry = {
    type: 'LineString' as const,
    coordinates: [
      [-122.42, 37.77],
      [-122.41, 37.78],
      [-122.42, 37.77],
    ] as Array<[number, number]>,
  };

  it('allows map preview only for routable rejected candidates', () => {
    expect(
      canPreviewOnMap(
        diagnostic({
          attemptNumber: 1,
          rejectionReason: 'outside_tolerance',
          geometry,
        }),
      ),
    ).toBe(true);
    expect(
      canPreviewOnMap(
        diagnostic({
          attemptNumber: 2,
          rejectionReason: 'duplicate_candidate',
          geometry,
        }),
      ),
    ).toBe(true);
    expect(
      canPreviewOnMap(
        diagnostic({
          attemptNumber: 3,
          rejectionReason: 'upstream_failure',
        }),
      ),
    ).toBe(false);
  });

  it('builds zero-valid-candidate summary with closest below tolerance', () => {
    const summary = buildGenerationSummary(response({ acceptedCount: 0 }));
    expect(summary).toContain('Tried 10 candidates');
    expect(summary).toContain('outside the');
    expect(summary).toContain('mile range');
    expect(summary).toContain('Closest:');
    expect(summary).toContain('below the accepted range');
  });

  it('builds partial-success summary', () => {
    const summary = buildGenerationSummary(
      response({
        acceptedCount: 2,
        alternatives: [
          {
            id: 'a',
            name: 'Route A',
            geometry: { type: 'LineString', coordinates: [[-122.42, 37.77]] },
            distanceMeters: 12 * 1609.344,
            durationSeconds: 3000,
            distanceFromTargetMeters: 0,
            bearingFamily: '120°',
            warnings: [],
            distanceClassification: 'within_range',
            requestedRangeMeters: { min: 9 * 1609.344, max: 15 * 1609.344 },
          },
        ],
        diagnosticSummary: {
          attemptedCount: 10,
          acceptedCount: 2,
          rejectionCounts: {
            upstream_failure: 1,
            malformed_geometry: 0,
            outside_tolerance: 5,
            duplicate_candidate: 2,
            selection_limit: 0,
            endpoint_mismatch: 0,
          },
          acceptedDistanceRangeMeters: {
            min: 11.5 * 1609.344,
            max: 12.3 * 1609.344,
          },
        },
      }),
    );
    expect(summary).toContain('2 passed');
    expect(summary).toContain('Accepted routes span');
  });

  it('uses plain-language rejection labels', () => {
    expect(rejectionReasonLabel('outside_tolerance').short).toBe('Outside distance range');
    expect(rejectionReasonLabel('duplicate_candidate').short).toBe('Near duplicate');
    expect(rejectionReasonLabel('upstream_failure').short).toBe('Routing failed');
  });

  it('summarizes start-to-end generations without a distance range', () => {
    expect(
      buildGenerationSummary(
        response({
          routeMode: 'point_to_point',
          acceptedCount: 1,
          attemptedCount: 1,
          alternatives: [
            {
              id: 'a',
              name: 'Route A',
              geometry: { type: 'LineString', coordinates: [] },
              distanceMeters: 8 * 1609.344,
              durationSeconds: 1800,
              distanceFromTargetMeters: 0,
              bearingFamily: 'direct',
              categories: [],
              scoring: {
                version: 'poc-scoring-v3',
                overallScore: 80,
                components: {},
                missingComponents: [],
                explanations: [],
                explanationCodes: [],
                fitSummary: 'POC fit 80/100',
              },
              warnings: [],
              distanceClassification: 'within_range',
              requestedRangeMeters: { min: 8 * 1609.344, max: 8 * 1609.344 },
            },
          ],
          diagnosticSummary: {
            attemptedCount: 1,
            acceptedCount: 1,
            rejectionCounts: {
              upstream_failure: 0,
              malformed_geometry: 0,
              outside_tolerance: 0,
              duplicate_candidate: 0,
              selection_limit: 0,
              endpoint_mismatch: 0,
            },
          },
        }),
      ),
    ).toBe('Routed from Start to End.');
  });

  it('formats above/below target wording', () => {
    expect(formatTargetDeltaWithTarget(-804.672, targetDistanceMeters)).toContain('below target');
    expect(formatTargetDeltaWithTarget(804.672, targetDistanceMeters)).toContain('above target');
  });

  it('builds rejected preview metadata without accepting the candidate', () => {
    const preview = rejectedPreviewFromDiagnostic(
      diagnostic({
        attemptNumber: 5,
        rejectionReason: 'outside_tolerance',
        geometry,
      }),
    );
    expect(preview?.attemptNumber).toBe(5);
    expect(preview?.geometry).toEqual(geometry);
    expect(preview?.label).toContain('Rejected attempt 5');
  });
});
