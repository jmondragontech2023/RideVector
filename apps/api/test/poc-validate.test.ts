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
});
