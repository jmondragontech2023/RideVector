import { describe, expect, it } from 'vitest';
import { buildAnchorPatterns, destinationPoint, haversineMeters } from '../src/poc/anchors';

describe('poc anchors', () => {
  const start = { latitude: 37.8, longitude: -122.4 };

  it('builds deterministic patterns for the same seed', () => {
    const a = buildAnchorPatterns(start, 16_093.44, 7, 6);
    const b = buildAnchorPatterns(start, 16_093.44, 7, 6);
    expect(a).toEqual(b);
    expect(a).toHaveLength(6);
    expect(a[0]?.waypoints).toHaveLength(2);
  });

  it('rotates bearings when the seed changes', () => {
    const a = buildAnchorPatterns(start, 16_093.44, 0, 1);
    const b = buildAnchorPatterns(start, 16_093.44, 1, 1);
    expect(a[0]?.bearingDegrees).not.toBe(b[0]?.bearingDegrees);
  });

  it('places waypoints near the expected triangular loop radius', () => {
    const target = 20_000;
    const radius = target / (2 + Math.sqrt(3));
    const patterns = buildAnchorPatterns(start, target, 0, 1);
    const wp = patterns[0]!.waypoints[0]!;
    const distance = haversineMeters(start, wp);
    expect(distance).toBeGreaterThan(radius * 0.98);
    expect(distance).toBeLessThan(radius * 1.02);
  });

  it('sizes anchors so straight-line triangle perimeter matches target distance', () => {
    const target = 20_000;
    const patterns = buildAnchorPatterns(start, target, 0, 1);
    const wp1 = patterns[0]!.waypoints[0]!;
    const wp2 = patterns[0]!.waypoints[1]!;
    const perimeter =
      haversineMeters(start, wp1) + haversineMeters(wp1, wp2) + haversineMeters(wp2, start);
    expect(perimeter).toBeGreaterThan(target * 0.98);
    expect(perimeter).toBeLessThan(target * 1.02);
  });

  it('destinationPoint moves approximately the requested distance', () => {
    const dest = destinationPoint(start, 90, 1000);
    expect(haversineMeters(start, dest)).toBeGreaterThan(990);
    expect(haversineMeters(start, dest)).toBeLessThan(1010);
  });
});
