import { describe, expect, it } from 'vitest';
import { scoreDistanceFit } from '../src/poc/scoring/distance-fit';

describe('scoreDistanceFit', () => {
  const target = 20_000;
  const flex = 5_000;

  it('scores within-range strictly above near-match for comparable distances', () => {
    const inside = scoreDistanceFit({
      distanceMeters: 21_000,
      targetDistanceMeters: target,
      distanceFlexibilityMeters: flex,
      classification: 'within_range',
    });
    const near = scoreDistanceFit({
      distanceMeters: 26_000,
      targetDistanceMeters: target,
      distanceFlexibilityMeters: flex,
      classification: 'near_match',
    });
    expect(inside.score).toBeGreaterThanOrEqual(70);
    expect(near.score).toBeLessThanOrEqual(55);
    expect(inside.score).toBeGreaterThan(near.score);
  });

  it('rewards closer matches inside the range', () => {
    const closer = scoreDistanceFit({
      distanceMeters: 20_100,
      targetDistanceMeters: target,
      distanceFlexibilityMeters: flex,
      classification: 'within_range',
    });
    const farther = scoreDistanceFit({
      distanceMeters: 24_500,
      targetDistanceMeters: target,
      distanceFlexibilityMeters: flex,
      classification: 'within_range',
    });
    expect(closer.score).toBeGreaterThan(farther.score);
  });
});
