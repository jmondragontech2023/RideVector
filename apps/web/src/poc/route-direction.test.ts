import { describe, expect, it } from 'vitest';
import {
  bearingDegrees,
  bearingDifferenceDegrees,
  chevronRotationDegrees,
  cumulativeRouteLengthMeters,
  directionBadgeHtml,
  directionMarkerAccessibleLabel,
  sampleDirectionMarkers,
  segmentLengthMeters,
} from './route-direction';
import type { DirectionMarker, LonLat } from './route-direction';

const SHORT_ROUTE_OPTIONS = { minRouteLengthMeters: 100 } as const;

function assertTravelOrder(markers: DirectionMarker[]): void {
  expect(markers.length).toBeGreaterThan(0);
  for (let index = 0; index < markers.length; index += 1) {
    expect(markers[index]?.sequence).toBe(index + 1);
    if (index > 0) {
      expect(markers[index]!.distanceMeters).toBeGreaterThan(markers[index - 1]!.distanceMeters);
    }
  }
}

function ambiguityKinds(markers: DirectionMarker[]) {
  return {
    before: markers.filter((marker) => marker.kind === 'ambiguity-before'),
    after: markers.filter((marker) => marker.kind === 'ambiguity-after'),
  };
}

/** ~1.1 km rectangular loop with 90° corners. */
function rectangularLoop(): LonLat[] {
  return [
    [0, 0],
    [0, 0.005],
    [0.005, 0.005],
    [0.005, 0],
    [0, 0],
  ];
}

/** Hairpin: north leg, sharp 180° turn, south return. */
function hairpinRoute(): LonLat[] {
  return [
    [0, 0],
    [0, 0.004],
    [0, 0.003],
    [0, 0],
  ];
}

/** Out-and-back on the same road centerline. */
function outAndBackRoute(): LonLat[] {
  return [
    [0, 0],
    [0, 0.005],
    [0.00015, 0.00515],
    [0, 0],
  ];
}

/** Figure-eight with a single crossing at the origin. */
function figureEightRoute(): LonLat[] {
  return [
    [0, 0],
    [0.002, 0.002],
    [0.004, 0],
    [0.002, -0.002],
    [0, 0],
    [-0.002, 0.002],
    [-0.004, 0],
    [-0.002, -0.002],
    [0, 0],
  ];
}

/** Two parallel streets running north; route uses only the western one. */
function closeParallelStreetsRoute(): LonLat[] {
  return [
    [0, 0],
    [0, 0.006],
    [0.0003, 0.006],
    [0.0003, 0],
    [0, 0],
  ];
}

/** Route with duplicate coordinates and very short noisy segments. */
function noisyRoute(): LonLat[] {
  return [
    [0, 0],
    [0, 0],
    [0, 0.00001],
    [0, 0.003],
    [0, 0.003],
    [0, 0.006],
  ];
}

/** Multiple sharp reversals along one path. */
function multipleReversalsRoute(): LonLat[] {
  return [
    [0, 0],
    [0, 0.003],
    [0.0003, 0.0033],
    [0, 0.003],
    [0, 0.006],
    [0.0003, 0.0063],
    [0, 0.006],
    [0, 0.009],
  ];
}

describe('route-direction geometry', () => {
  it('calculates cumulative route length along ordered coordinates', () => {
    const route: LonLat[] = [
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
    const route: LonLat[] = [
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
    const route: LonLat[] = [
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

  it('normalizes bearing differences across the 0/360 wrap', () => {
    expect(bearingDifferenceDegrees(10, 350)).toBeCloseTo(20, 0);
    expect(bearingDifferenceDegrees(180, 0)).toBeCloseTo(180, 0);
    expect(bearingDifferenceDegrees(90, 100)).toBeCloseTo(10, 0);
  });

  it('numbers markers from 1 in travel order with increasing cumulative distance', () => {
    const route: LonLat[] = Array.from({ length: 21 }, (_, index) => [0, index * 0.01]);
    const markers = sampleDirectionMarkers(route, SHORT_ROUTE_OPTIONS);
    assertTravelOrder(markers);
    expect(markers.length).toBeGreaterThanOrEqual(6);
    expect(markers.length).toBeLessThanOrEqual(8);
  });

  it('places marker 1 shortly after departure on straight routes', () => {
    const route: LonLat[] = Array.from({ length: 21 }, (_, index) => [0, index * 0.01]);
    const total = cumulativeRouteLengthMeters(route);
    const markers = sampleDirectionMarkers(route, SHORT_ROUTE_OPTIONS);

    expect(markers[0]!.distanceMeters).toBeGreaterThan(total * 0.04);
    expect(markers[0]!.distanceMeters).toBeLessThan(total * 0.25);
    expect(total - markers[markers.length - 1]!.distanceMeters).toBeGreaterThan(total * 0.04);
  });

  it('caps marker count between 6 and 8', () => {
    const markers = sampleDirectionMarkers(rectangularLoop());
    expect(markers.length).toBeGreaterThanOrEqual(6);
    expect(markers.length).toBeLessThanOrEqual(8);
  });

  it('places marker 1 after the configured start exclusion distance', () => {
    const route: LonLat[] = Array.from({ length: 21 }, (_, index) => [0, index * 0.01]);
    const total = cumulativeRouteLengthMeters(route);
    const markers = sampleDirectionMarkers(route, {
      ...SHORT_ROUTE_OPTIONS,
      startExclusionMeters: 150,
    });

    expect(markers[0]?.sequence).toBe(1);
    expect(markers[0]!.distanceMeters).toBeGreaterThanOrEqual(150);
    expect(markers[0]!.distanceMeters).toBeGreaterThan(total * 0.04);
  });

  it('computes cardinal bearings', () => {
    const origin: LonLat = [0, 0];
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

  it('adds ambiguity modifier classes and accessible labels', () => {
    const before: DirectionMarker = {
      lon: 0,
      lat: 0,
      bearing: 90,
      sequence: 4,
      distanceMeters: 100,
      kind: 'ambiguity-before',
    };
    const after: DirectionMarker = {
      lon: 0,
      lat: 0,
      bearing: 270,
      sequence: 5,
      distanceMeters: 160,
      kind: 'ambiguity-after',
    };

    expect(directionBadgeHtml(4, 90, 'ambiguity-before')).toContain(
      'route-direction-badge--ambiguity-before',
    );
    expect(directionBadgeHtml(5, 270, 'ambiguity-after')).toContain(
      'route-direction-badge--ambiguity-after',
    );
    expect(directionMarkerAccessibleLabel(before)).toBe('Direction 4, before route reversal.');
    expect(directionMarkerAccessibleLabel(after)).toBe('Direction 5, after route reversal.');
    expect(directionMarkerAccessibleLabel({ ...before, kind: 'regular', sequence: 2 })).toBe(
      'Direction 2.',
    );
  });
});

describe('route-direction ambiguity scenarios', () => {
  it('does not create false ambiguity pairs on a simple rectangular loop', () => {
    const markers = sampleDirectionMarkers(rectangularLoop());
    assertTravelOrder(markers);
    expect(ambiguityKinds(markers).before).toHaveLength(0);
    expect(ambiguityKinds(markers).after).toHaveLength(0);
  });

  it('creates exactly one before/after pair on a hairpin U-turn', () => {
    const markers = sampleDirectionMarkers(hairpinRoute());
    assertTravelOrder(markers);
    const pairs = ambiguityKinds(markers);
    expect(pairs.before).toHaveLength(1);
    expect(pairs.after).toHaveLength(1);
    expect(pairs.before[0]!.sequence).toBeLessThan(pairs.after[0]!.sequence);
  });

  it('shows opposing bearings on out-and-back paired markers', () => {
    const markers = sampleDirectionMarkers(outAndBackRoute());
    assertTravelOrder(markers);
    const pairs = ambiguityKinds(markers);
    expect(pairs.before.length + pairs.after.length).toBeGreaterThanOrEqual(2);

    const paired = [...pairs.before, ...pairs.after];
    const bearings = paired.map((marker) => marker.bearing);
    const maxDifference = bearings.reduce((max, bearing, index) => {
      for (let other = index + 1; other < bearings.length; other += 1) {
        max = Math.max(max, bearingDifferenceDegrees(bearing, bearings[other]!));
      }
      return max;
    }, 0);
    expect(maxDifference).toBeGreaterThan(90);
  });

  it('keeps travel order clear around a figure-eight crossing', () => {
    const markers = sampleDirectionMarkers(figureEightRoute());
    assertTravelOrder(markers);
    expect(
      ambiguityKinds(markers).before.length + ambiguityKinds(markers).after.length,
    ).toBeGreaterThan(0);

    const crossingIndex = figureEightRoute().findIndex(
      (point, index, route) => index > 0 && point[0] === route[0]![0] && point[1] === route[0]![1],
    );
    expect(crossingIndex).toBeGreaterThan(0);

    const nearCrossing = markers.filter(
      (marker) => Math.abs(marker.lon) < 0.0015 && Math.abs(marker.lat) < 0.0015,
    );
    for (const marker of nearCrossing) {
      expect(marker.sequence).toBeGreaterThan(1);
    }
  });

  it('does not false-positive on close parallel streets', () => {
    const markers = sampleDirectionMarkers(closeParallelStreetsRoute());
    assertTravelOrder(markers);
    expect(ambiguityKinds(markers).before).toHaveLength(0);
    expect(ambiguityKinds(markers).after).toHaveLength(0);
  });

  it('remains stable with duplicate coordinates and noisy short segments', () => {
    const first = sampleDirectionMarkers(noisyRoute());
    const second = sampleDirectionMarkers(noisyRoute());
    assertTravelOrder(first);
    expect(first).toEqual(second);
  });

  it('preserves ordering and enforces maximum markers with multiple reversals', () => {
    const markers = sampleDirectionMarkers(multipleReversalsRoute());
    assertTravelOrder(markers);
    expect(markers.length).toBeLessThanOrEqual(8);
    expect(ambiguityKinds(markers).before.length).toBeGreaterThanOrEqual(2);
    expect(ambiguityKinds(markers).after.length).toBeGreaterThanOrEqual(2);
  });

  it('does not add a redundant ambiguity pair at the start on start/finish overlap', () => {
    const markers = sampleDirectionMarkers(rectangularLoop());
    assertTravelOrder(markers);
    const startPoint = rectangularLoop()[0]!;
    const nearStartAmbiguity = markers.filter(
      (marker) =>
        (marker.kind === 'ambiguity-before' || marker.kind === 'ambiguity-after') &&
        segmentLengthMeters([marker.lon, marker.lat], startPoint) < 80,
    );
    expect(nearStartAmbiguity).toHaveLength(0);
  });

  it('is deterministic for identical geometry', () => {
    const route = hairpinRoute();
    expect(sampleDirectionMarkers(route)).toEqual(sampleDirectionMarkers(route));
  });
});
