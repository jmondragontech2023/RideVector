import { describe, expect, it } from 'vitest';
import { POC_CONFIG } from '../src/poc/config';
import { buildCandidateDiagnostic, buildDiagnosticSummary } from '../src/poc/diagnostics';
import type { PocCandidateDiagnostic } from '../src/poc/types';

function squareLoop(startLat: number, startLon: number): Array<[number, number]> {
  return [
    [startLon, startLat],
    [startLon + 0.02, startLat],
    [startLon + 0.02, startLat + 0.02],
    [startLon, startLat + 0.02],
    [startLon, startLat],
  ];
}

describe('buildCandidateDiagnostic', () => {
  const targetDistanceMeters = 12 * 1609.344;
  const distanceFlexibilityMeters = 3 * 1609.344;
  const geometry = { type: 'LineString' as const, coordinates: squareLoop(37.77, -122.42) };

  it('preserves geometry for outside_tolerance candidates', () => {
    const diagnostic = buildCandidateDiagnostic({
      attemptNumber: 2,
      bearingFamily: '120°',
      outcome: 'rejected',
      rejectionReason: 'outside_tolerance',
      distanceMeters: 9.1 * 1609.344,
      durationSeconds: 1800,
      distanceFromTargetMeters: 9.1 * 1609.344 - targetDistanceMeters,
      geometry,
      targetDistanceMeters,
      distanceFlexibilityMeters,
    });

    expect(diagnostic.geometry).toEqual(geometry);
    expect(diagnostic.rejectionReason).toBe('outside_tolerance');
    expect(diagnostic.explanation).toContain('outside');
  });

  it('preserves geometry for duplicate candidates', () => {
    const diagnostic = buildCandidateDiagnostic({
      attemptNumber: 4,
      bearingFamily: '240°',
      outcome: 'rejected',
      rejectionReason: 'duplicate_candidate',
      distanceMeters: targetDistanceMeters,
      durationSeconds: 2000,
      distanceFromTargetMeters: 0,
      geometry,
      targetDistanceMeters,
      distanceFlexibilityMeters,
    });

    expect(diagnostic.geometry).toEqual(geometry);
    expect(diagnostic.rejectionReason).toBe('duplicate_candidate');
    expect(diagnostic.explanation).toContain('similar');
  });

  it('omits geometry for upstream failures', () => {
    const diagnostic = buildCandidateDiagnostic({
      attemptNumber: 1,
      bearingFamily: '0°',
      outcome: 'rejected',
      rejectionReason: 'upstream_failure',
      targetDistanceMeters,
      distanceFlexibilityMeters,
    });

    expect(diagnostic.geometry).toBeUndefined();
    expect(diagnostic.explanation).not.toContain('http');
  });

  it('omits geometry for malformed geometry failures', () => {
    const diagnostic = buildCandidateDiagnostic({
      attemptNumber: 3,
      bearingFamily: '60°',
      outcome: 'rejected',
      rejectionReason: 'malformed_geometry',
      targetDistanceMeters,
      distanceFlexibilityMeters,
    });

    expect(diagnostic.geometry).toBeUndefined();
  });

  it('never includes raw provider details in explanations', () => {
    const diagnostic = buildCandidateDiagnostic({
      attemptNumber: 1,
      bearingFamily: '0°',
      outcome: 'rejected',
      rejectionReason: 'upstream_failure',
      targetDistanceMeters,
      distanceFlexibilityMeters,
    });

    expect(JSON.stringify(diagnostic)).not.toMatch(/valhalla|stack|url|http/i);
  });
});

describe('buildDiagnosticSummary', () => {
  const targetDistanceMeters = 12 * 1609.344;
  const distanceFlexibilityMeters = 3 * 1609.344;
  const emptyRejections = {
    upstream_failure: 0,
    malformed_geometry: 0,
    outside_tolerance: 0,
    duplicate_candidate: 0,
    selection_limit: 0,
  };

  it('calculates closest routable rejected candidate below tolerance', () => {
    const diagnostics: PocCandidateDiagnostic[] = [
      buildCandidateDiagnostic({
        attemptNumber: 1,
        bearingFamily: '0°',
        outcome: 'rejected',
        rejectionReason: 'outside_tolerance',
        distanceMeters: 8.5 * 1609.344,
        durationSeconds: 1800,
        distanceFromTargetMeters: 8.5 * 1609.344 - targetDistanceMeters,
        geometry: { type: 'LineString', coordinates: squareLoop(37.77, -122.42) },
        targetDistanceMeters,
        distanceFlexibilityMeters,
      }),
      buildCandidateDiagnostic({
        attemptNumber: 2,
        bearingFamily: '60°',
        outcome: 'rejected',
        rejectionReason: 'outside_tolerance',
        distanceMeters: 8 * 1609.344,
        durationSeconds: 1700,
        distanceFromTargetMeters: 8 * 1609.344 - targetDistanceMeters,
        geometry: { type: 'LineString', coordinates: squareLoop(37.78, -122.43) },
        targetDistanceMeters,
        distanceFlexibilityMeters,
      }),
    ];

    const summary = buildDiagnosticSummary({
      targetDistanceMeters,
      distanceFlexibilityMeters,
      diagnostics,
      rejections: { ...emptyRejections, outside_tolerance: 2 },
      attemptedCount: 2,
      acceptedCount: 0,
    });

    expect(summary.closestRoutableRejected?.attemptNumber).toBe(1);
    expect(summary.closestRoutableRejected?.direction).toBe('below');
    expect(summary.closestRoutableRejected!.toleranceMissMeters).toBeGreaterThan(0);
  });

  it('caps diagnostics collection at ten records via generator contract', () => {
    expect(POC_CONFIG.maxCandidateCount).toBe(10);
  });
});
