import { describe, expect, it } from 'vitest';
import { isNearDuplicateMidpoint } from '../src/poc/diversity';

describe('isNearDuplicateMidpoint', () => {
  it('rejects midpoints that are too close for the target distance', () => {
    const target = 20_000;
    const accepted = [{ latitude: 37.78, longitude: -122.41 }];
    expect(
      isNearDuplicateMidpoint({ latitude: 37.7801, longitude: -122.4101 }, accepted, target),
    ).toBe(true);
  });

  it('accepts midpoints that are sufficiently separated', () => {
    const target = 20_000;
    const accepted = [{ latitude: 37.78, longitude: -122.41 }];
    expect(isNearDuplicateMidpoint({ latitude: 37.85, longitude: -122.5 }, accepted, target)).toBe(
      false,
    );
  });
});
