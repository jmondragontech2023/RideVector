import { describe, expect, it } from 'vitest';
import {
  bearingDegrees,
  chevronRotationDegrees,
  cumulativeRouteLengthMeters,
  directionBadgeHtml,
  sampleDirectionMarkers,
  segmentLengthMeters,
} from './route-direction';

describe('route-direction geometry', () => {
  it('calculates cumulative route length along ordered coordinates', () => {
    const route: Array<[number, number]> = [
      [0, 0],
      [0, 0.01],
      [0.01, 0.01],
    ];
    const total = cumulativeRouteLengthMeters(route);
    const leg1 = segmentLengthMeters(route[0]!, route[1]!);
    const leg2 = segmentLengthMeters(route[1]!, route[2]!);
    expect(total).toBeGreaterThan(leg1 + leg2 - 1);
    expect(total).toBeLessThan(leg1 + leg2 + 1);
  });

  it('ignores duplicate adjacent coordinates when measuring length', () => {
    const route: Array<[number, number]> = [
      [0, 0],
      [0, 0],
      [0, 0.01],
    ];
    expect(cumulativeRouteLengthMeters(route)).toBeCloseTo(
      segmentLengthMeters([0, 0], [0, 0.01]),
      0,
    );
  });

  it('returns zero length for empty or single-point geometries', () => {
    expect(cumulativeRouteLengthMeters([])).toBe(0);
    expect(cumulativeRouteLengthMeters([[0, 0]])).toBe(0);
    expect(sampleDirectionMarkers([])).toEqual([]);
    expect(sampleDirectionMarkers([[0, 0]])).toEqual([]);
  });

  it('returns no markers for very short routes', () => {
    const route: Array<[number, number]> = [
      [0, 0],
      [0, 0.001],
    ];
    expect(sampleDirectionMarkers(route)).toEqual([]);
  });

  it('returns no markers when all coordinates collapse to zero-length segments', () => {
    expect(
      sampleDirectionMarkers([
        [0, 0],
        [0, 0],
        [0, 0],
      ]),
    ).toEqual([]);
  });

  it('numbers markers from 1 in travel order with increasing cumulative distance', () => {
    const route: Array<[number, number]> = Array.from({ length: 21 }, (_, index) => [
      0,
      index * 0.01,
    ]);
    const markers = sampleDirectionMarkers(route, { minRouteLengthMeters: 100 });

    expect(markers.length).toBeGreaterThanOrEqual(6);
    expect(markers.length).toBeLessThanOrEqual(8);
    expect(markers[0]?.sequence).toBe(1);
    expect(markers[markers.length - 1]?.sequence).toBe(markers.length);

    for (let index = 0; index < markers.length; index += 1) {
      expect(markers[index]?.sequence).toBe(index + 1);
      if (index > 0) {
        expect(markers[index]!.distanceMeters).toBeGreaterThan(markers[index - 1]!.distanceMeters);
      }
    }
  });

  it('places marker 1 shortly after departure with roughly equal spacing', () => {
    const route: Array<[number, number]> = Array.from({ length: 21 }, (_, index) => [
      0,
      index * 0.01,
    ]);
    const total = cumulativeRouteLengthMeters(route);
    const markers = sampleDirectionMarkers(route, { minRouteLengthMeters: 100 });
    const gaps = markers.slice(1).map((marker, index) => {
      return marker.distanceMeters - markers[index]!.distanceMeters;
    });

    expect(markers[0]!.distanceMeters).toBeGreaterThan(total * 0.04);
    expect(markers[0]!.distanceMeters).toBeLessThan(total * 0.25);
    for (const gap of gaps) {
      expect(gap).toBeGreaterThan(gaps[0]! * 0.75);
      expect(gap).toBeLessThan(gaps[0]! * 1.25);
    }
    expect(total - markers[markers.length - 1]!.distanceMeters).toBeGreaterThan(total * 0.04);
  });

  it('caps marker count between 6 and 8', () => {
    const route: Array<[number, number]> = [
      [-122.5, 37.7],
      [-122.3, 37.7],
      [-122.3, 37.9],
      [-122.5, 37.9],
      [-122.5, 37.7],
    ];
    const markers = sampleDirectionMarkers(route);
    expect(markers.length).toBeGreaterThanOrEqual(6);
    expect(markers.length).toBeLessThanOrEqual(8);
  });

  it('preserves travel sequence on loop geometry', () => {
    const route: Array<[number, number]> = [
      [-117.28, 33.12],
      [-117.27, 33.13],
      [-117.26, 33.12],
      [-117.28, 33.12],
    ];
    const markers = sampleDirectionMarkers(route);

    expect(markers.length).toBeGreaterThanOrEqual(6);
    for (let index = 1; index < markers.length; index += 1) {
      expect(markers[index]!.distanceMeters).toBeGreaterThan(markers[index - 1]!.distanceMeters);
      expect(markers[index]!.sequence).toBe(markers[index - 1]!.sequence + 1);
    }
  });

  it('preserves travel sequence where the route crosses itself', () => {
    const route: Array<[number, number]> = [
      [0, 0],
      [0, 0.08],
      [0.08, 0.08],
      [0.08, 0],
      [0, 0],
    ];
    const markers = sampleDirectionMarkers(route, { minRouteLengthMeters: 100 });
    const midpoint = route[Math.floor(route.length / 2)]!;

    for (const marker of markers) {
      const revisitsCrossing =
        Math.abs(marker.lon - midpoint[0]) < 0.02 && Math.abs(marker.lat - midpoint[1]) < 0.02;
      if (revisitsCrossing) {
        expect(marker.sequence).toBeGreaterThan(1);
      }
    }

    for (let index = 1; index < markers.length; index += 1) {
      expect(markers[index]!.distanceMeters).toBeGreaterThan(markers[index - 1]!.distanceMeters);
    }
  });

  it('computes cardinal bearings', () => {
    const origin: [number, number] = [0, 0];
    expect(bearingDegrees(origin, [0, 1])).toBeCloseTo(0, 0);
    expect(bearingDegrees(origin, [1, 0])).toBeCloseTo(90, 0);
    expect(bearingDegrees(origin, [0, -1])).toBeCloseTo(180, 0);
    expect(bearingDegrees(origin, [-1, 0])).toBeCloseTo(270, 0);
  });

  it('rotates chevrons relative to east-pointing glyph', () => {
    expect(chevronRotationDegrees(90)).toBeCloseTo(0, 0);
    expect(chevronRotationDegrees(0)).toBeCloseTo(-90, 0);
    expect(chevronRotationDegrees(180)).toBeCloseTo(90, 0);
    expect(chevronRotationDegrees(270)).toBeCloseTo(180, 0);
  });

  it('embeds the sequence number in numbered badge html', () => {
    expect(directionBadgeHtml(3, 90)).toContain('route-direction-badge__number">3</span>');
    expect(directionBadgeHtml(3, 90)).toContain('rotate(0deg)');
  });
});
