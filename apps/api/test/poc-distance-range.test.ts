import { describe, expect, it } from 'vitest';
import { METERS_PER_MILE } from '../src/poc/config';
import {
  acceptedRangeMeters,
  buildNearMatchWarning,
  classifyRouteDistance,
  qualifiesAsNearMatch,
  rangeDeviationMeters,
} from '../src/poc/distance-range';

const miles = (value: number): number => value * METERS_PER_MILE;

describe('distance-range', () => {
  const targetMeters = miles(12);
  const flexMeters = miles(3);

  it('uses custom flexibility for acceptance boundaries', () => {
    const range = acceptedRangeMeters(targetMeters, flexMeters);
    expect(classifyRouteDistance(miles(10), targetMeters, flexMeters)).toBe('within_range');
    expect(classifyRouteDistance(range.min, targetMeters, flexMeters)).toBe('within_range');
    expect(classifyRouteDistance(range.max, targetMeters, flexMeters)).toBe('within_range');
    expect(classifyRouteDistance(range.min - 1, targetMeters, flexMeters)).not.toBe('within_range');
  });

  it('accepts exact lower and upper boundaries', () => {
    const range = acceptedRangeMeters(targetMeters, flexMeters);
    expect(classifyRouteDistance(range.min, targetMeters, flexMeters)).toBe('within_range');
    expect(classifyRouteDistance(range.max, targetMeters, flexMeters)).toBe('within_range');
  });

  it('classifies near matches slightly above and below the range', () => {
    const range = acceptedRangeMeters(targetMeters, flexMeters);
    expect(classifyRouteDistance(range.max + miles(0.8), targetMeters, flexMeters)).toBe(
      'near_match',
    );
    expect(classifyRouteDistance(range.min - miles(0.8), targetMeters, flexMeters)).toBe(
      'near_match',
    );
  });

  it('rejects candidates beyond the additional 2-mile ceiling', () => {
    const range = acceptedRangeMeters(targetMeters, flexMeters);
    expect(classifyRouteDistance(range.max + miles(2.1), targetMeters, flexMeters)).toBe('outside');
    expect(classifyRouteDistance(range.min - miles(2.1), targetMeters, flexMeters)).toBe('outside');
  });

  it('rejects candidates beyond 35% of target even inside the 2-mile ceiling', () => {
    expect(qualifiesAsNearMatch(miles(7.5), targetMeters, flexMeters)).toBe(false);
    expect(classifyRouteDistance(miles(7.5), targetMeters, flexMeters)).toBe('outside');
  });

  it('requires both fallback limits to pass', () => {
    const range = acceptedRangeMeters(targetMeters, flexMeters);
    const barelyAbove = range.max + miles(0.8);
    expect(qualifiesAsNearMatch(barelyAbove, targetMeters, flexMeters)).toBe(true);
    expect(qualifiesAsNearMatch(miles(20), targetMeters, flexMeters)).toBe(false);
  });

  it('builds near-match warnings without claiming the request was satisfied', () => {
    const range = acceptedRangeMeters(targetMeters, flexMeters);
    const warning = buildNearMatchWarning(range.max + miles(0.8), targetMeters, flexMeters);
    expect(warning).toContain('above your requested range');
    expect(warning).toContain('Does not satisfy the exact range');
  });

  it('reports signed range deviation', () => {
    const range = acceptedRangeMeters(targetMeters, flexMeters);
    expect(rangeDeviationMeters(range.max + miles(0.8), targetMeters, flexMeters)).toBeCloseTo(
      miles(0.8),
    );
    expect(rangeDeviationMeters(range.min - miles(0.8), targetMeters, flexMeters)).toBeCloseTo(
      -miles(0.8),
    );
  });
});
