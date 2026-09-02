import { describe, expect, it } from 'vitest';
import { validatePocGenerateRequest } from '../src/poc/validate';

describe('validatePocGenerateRequest', () => {
  const valid = {
    start: { latitude: 37.7749, longitude: -122.4194 },
    targetDistanceMeters: 20_000,
    costing: 'road' as const,
  };

  it('accepts a normalized request and defaults seed to 0', () => {
    const result = validatePocGenerateRequest(valid);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.request.seed).toBe(0);
      expect(result.request.targetDistanceMeters).toBe(20_000);
      expect(result.request.routeMode).toBe('loop');
      expect(result.request.end).toBeUndefined();
    }
  });

  it('accepts a point-to-point request with a distinct end', () => {
    const result = validatePocGenerateRequest({
      ...valid,
      routeMode: 'point_to_point',
      end: { latitude: 37.8044, longitude: -122.2712 },
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.request.routeMode).toBe('point_to_point');
      expect(result.request.end?.latitude).toBeCloseTo(37.8044);
    }
  });

  it('rejects coincident start and end in point-to-point mode', () => {
    const result = validatePocGenerateRequest({
      ...valid,
      routeMode: 'point_to_point',
      end: valid.start,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.details.some((detail) => detail.field === 'end')).toBe(true);
      expect(result.details.some((detail) => detail.reason.includes('loop mode'))).toBe(true);
    }
  });

  it('rejects loop requests that include an end point', () => {
    const result = validatePocGenerateRequest({
      ...valid,
      end: { latitude: 37.8, longitude: -122.27 },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.details.some((detail) => detail.field === 'end')).toBe(true);
    }
  });

  it('rejects Phase 2 waypoint and return inputs', () => {
    const waypoints = validatePocGenerateRequest({
      ...valid,
      routeMode: 'point_to_point',
      end: { latitude: 37.8, longitude: -122.27 },
      waypoints: [{ latitude: 37.79, longitude: -122.3 }],
    });
    expect(waypoints.ok).toBe(false);

    const returnMode = validatePocGenerateRequest({
      ...valid,
      routeMode: 'point_to_point',
      end: { latitude: 37.8, longitude: -122.27 },
      returnMode: 'shortest',
    });
    expect(returnMode.ok).toBe(false);
  });

  it('rejects client-computed scores and provider options', () => {
    const result = validatePocGenerateRequest({
      ...valid,
      scoring: { overallScore: 99 },
      providerOptions: { costing: 'auto' },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.details.map((detail) => detail.field).sort()).toEqual([
        'providerOptions',
        'scoring',
      ]);
    }
  });

  it('accepts omitted Phase 2 defaults', () => {
    const result = validatePocGenerateRequest({
      ...valid,
      waypoints: [],
      returnMode: 'none',
    });
    expect(result.ok).toBe(true);
  });

  it('defaults distance flexibility to three miles', () => {
    const result = validatePocGenerateRequest(valid);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.request.distanceFlexibilityMeters).toBeCloseTo(3 * 1609.344);
    }
  });

  it('rejects invalid distance flexibility values', () => {
    const negative = validatePocGenerateRequest({
      ...valid,
      distanceFlexibilityMeters: -1,
    });
    expect(negative.ok).toBe(false);

    const excessive = validatePocGenerateRequest({
      ...valid,
      distanceFlexibilityMeters: 30 * 1609.344,
    });
    expect(excessive.ok).toBe(false);
  });

  it('rejects out-of-bounds coordinates', () => {
    const result = validatePocGenerateRequest({
      ...valid,
      start: { latitude: 100, longitude: -122 },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.details.some((d) => d.field === 'start.latitude')).toBe(true);
    }
  });

  it('rejects invalid costing and non-integer seed', () => {
    const result = validatePocGenerateRequest({
      ...valid,
      costing: 'trail',
      seed: 1.5,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.details.map((d) => d.field).sort()).toEqual(['costing', 'seed']);
    }
  });

  it('rejects distances outside the configured range', () => {
    const tooShort = validatePocGenerateRequest({ ...valid, targetDistanceMeters: 100 });
    expect(tooShort.ok).toBe(false);
  });

  it('rejects scoring toggles without matching enrichment', () => {
    const result = validatePocGenerateRequest({
      ...valid,
      features: {
        elevationScoring: true,
        elevationEnrichment: false,
      },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.details.some((detail) => detail.field === 'features.elevationScoring')).toBe(
        true,
      );
    }
  });

  it('normalizes departure now and custom modes', () => {
    const now = validatePocGenerateRequest(valid, {
      now: () => new Date('2026-08-26T18:00:00.000Z'),
    });
    expect(now.ok).toBe(true);
    if (now.ok) {
      expect(now.request.departure.mode).toBe('now');
      expect(now.request.features.distanceFitScoring).toBe(true);
    }

    const custom = validatePocGenerateRequest({
      ...valid,
      departure: {
        mode: 'custom',
        localDateTime: '2026-08-27T09:30:00.000Z',
        timeZone: 'America/Los_Angeles',
      },
    });
    expect(custom.ok).toBe(true);
    if (custom.ok) {
      expect(custom.request.departure.mode).toBe('custom');
      expect(custom.request.departure.timeZone).toBe('America/Los_Angeles');
    }
  });
});
