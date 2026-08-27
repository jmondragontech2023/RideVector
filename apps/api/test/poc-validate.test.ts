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
    }
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
