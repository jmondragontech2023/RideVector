import { describe, expect, it } from 'vitest';
import {
  bearingDegrees,
  chevronRotationDegrees,
  cumulativeRouteLengthMeters,
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

  it('places markers at equal cumulative-distance intervals on a straight route', () => {
    const route: Array<[number, number]> = Array.from({ length: 21 }, (_, index) => [
      0,
      index * 0.01,
    ]);
    const total = cumulativeRouteLengthMeters(route);
    const markers = sampleDirectionMarkers(route, { minRouteLengthMeters: 100 });
    expect(markers.length).toBeGreaterThanOrEqual(5);

    const markerDistances = markers.map((marker) => {
      const latFraction = marker.lat / 0.2;
      return latFraction * total;
    });

    for (let index = 1; index < markerDistances.length; index += 1) {
      const gap = markerDistances[index]! - markerDistances[index - 1]!;
      const firstGap = markerDistances[1]! - markerDistances[0]!;
      expect(gap).toBeGreaterThan(firstGap * 0.75);
      expect(gap).toBeLessThan(firstGap * 1.25);
    }

    expect(markerDistances[0]!).toBeGreaterThan(total * 0.04);
    expect(total - markerDistances[markerDistances.length - 1]!).toBeGreaterThan(total * 0.04);
  });

  it('caps marker count at the configured maximum', () => {
    const route: Array<[number, number]> = [
      [-122.5, 37.7],
      [-122.3, 37.7],
      [-122.3, 37.9],
      [-122.5, 37.9],
      [-122.5, 37.7],
    ];
    const markers = sampleDirectionMarkers(route);
    expect(markers.length).toBeLessThanOrEqual(8);
  });

  it('supports loop geometry that returns to the start coordinate', () => {
    const route: Array<[number, number]> = [
      [-117.28, 33.12],
      [-117.27, 33.13],
      [-117.26, 33.12],
      [-117.28, 33.12],
    ];
    const markers = sampleDirectionMarkers(route);
    expect(markers.length).toBeGreaterThanOrEqual(5);
    expect(markers[0]).toMatchObject({
      lon: expect.any(Number),
      lat: expect.any(Number),
      bearing: expect.any(Number),
    });
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
});
