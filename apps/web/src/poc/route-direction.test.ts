import { describe, expect, it } from 'vitest';
import {
  bearingDegrees,
  bearingDifferenceDegrees,
  chevronRotationDegrees,
  cumulativeRouteLengthMeters,
  directionBadgeHtml,
  directionMarkerAccessibleLabel,
  directionMarkerProgressColor,
  directionMarkerProgressInk,
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

function turnKinds(markers: DirectionMarker[]) {
  return {
    before: markers.filter((marker) => marker.kind === 'turn-before'),
    after: markers.filter((marker) => marker.kind === 'turn-after'),
  };
}

function isIntentionalPairKinds(
  left: DirectionMarker['kind'],
  right: DirectionMarker['kind'],
): boolean {
  return (
    (left === 'ambiguity-before' && right === 'ambiguity-after') ||
    (left === 'ambiguity-after' && right === 'ambiguity-before') ||
    (left === 'turn-before' && right === 'turn-after') ||
    (left === 'turn-after' && right === 'turn-before')
  );
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
    expect(markers.length).toBeGreaterThanOrEqual(12);
    expect(markers.length).toBeLessThanOrEqual(40);
  });

  it('places marker 1 shortly after departure on straight routes', () => {
    const route: LonLat[] = Array.from({ length: 21 }, (_, index) => [0, index * 0.01]);
    const total = cumulativeRouteLengthMeters(route);
    const markers = sampleDirectionMarkers(route, SHORT_ROUTE_OPTIONS);

    expect(markers[0]!.distanceMeters).toBeGreaterThan(total * 0.04);
    const firstHalf = total * 0.3;
    expect(markers[0]!.distanceMeters).toBeLessThan(firstHalf);
    expect(total - markers[markers.length - 1]!.distanceMeters).toBeGreaterThan(total * 0.04);
  });

  it('caps marker count within the configured density budget', () => {
    const markers = sampleDirectionMarkers(rectangularLoop());
    expect(markers.length).toBeGreaterThanOrEqual(6);
    expect(markers.length).toBeLessThanOrEqual(40);
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
      progress: 0.4,
      kind: 'ambiguity-before',
    };
    const after: DirectionMarker = {
      lon: 0,
      lat: 0,
      bearing: 270,
      sequence: 5,
      distanceMeters: 160,
      progress: 0.6,
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

  it('tints badges green near the start and red near the finish', () => {
    expect(directionMarkerProgressColor(0)).toContain('120');
    expect(directionMarkerProgressColor(0.5)).toContain('60');
    expect(directionMarkerProgressColor(1)).toContain('0.0');
    expect(directionMarkerProgressInk(0)).toBe('#f5fff9');
    expect(directionMarkerProgressInk(0.5)).toBe('#0a1510');
    expect(directionMarkerProgressInk(1)).toBe('#f5fff9');

    const early = directionBadgeHtml(1, 90, { kind: 'regular', progress: 0.05 });
    const late = directionBadgeHtml(8, 90, { kind: 'regular', progress: 0.95 });
    expect(early).toContain('--rv-direction-fill:');
    expect(early).toContain(directionMarkerProgressColor(0.05));
    expect(late).toContain(directionMarkerProgressColor(0.95));
  });
});

describe('route-direction ambiguity scenarios', () => {
  it('does not create false ambiguity pairs on a simple rectangular loop', () => {
    const markers = sampleDirectionMarkers(rectangularLoop());
    assertTravelOrder(markers);
    expect(ambiguityKinds(markers).before).toHaveLength(0);
    expect(ambiguityKinds(markers).after).toHaveLength(0);
  });

  it('places before/after markers around a significant corner turn', () => {
    const markers = sampleDirectionMarkers(rectangularLoop());
    assertTravelOrder(markers);
    const turns = turnKinds(markers);
    expect(turns.before.length).toBeGreaterThanOrEqual(1);
    expect(turns.after.length).toBe(turns.before.length);

    const firstBefore = turns.before[0]!;
    const matchingAfter = turns.after.find((marker) => marker.sequence > firstBefore.sequence);
    expect(matchingAfter).toBeDefined();
    expect(bearingDifferenceDegrees(firstBefore.bearing, matchingAfter!.bearing)).toBeGreaterThan(
      45,
    );
  });

  it('keeps consecutive markers from leaving large empty stretches', () => {
    // ~12 km straight corridor — dense enough that maxGap can be satisfied.
    const route: LonLat[] = Array.from({ length: 12 }, (_, index) => [0, index * 0.01]);
    const markers = sampleDirectionMarkers(route, SHORT_ROUTE_OPTIONS);
    assertTravelOrder(markers);
    expect(markers.length).toBeGreaterThanOrEqual(12);
    for (let index = 1; index < markers.length; index += 1) {
      expect(
        markers[index]!.distanceMeters - markers[index - 1]!.distanceMeters,
      ).toBeLessThanOrEqual(600);
    }
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
    expect(markers.length).toBeLessThanOrEqual(40);
    expect(ambiguityKinds(markers).before.length).toBeGreaterThanOrEqual(2);
    expect(ambiguityKinds(markers).after.length).toBeGreaterThanOrEqual(2);
  });

  it('does not flood markers on a long same-road out-and-back corridor', () => {
    // ~5.5 km outbound, sharp turnaround, same centerline return.
    const outbound: LonLat[] = Array.from({ length: 26 }, (_, index) => [0, index * 0.002]);
    const returnLeg: LonLat[] = Array.from({ length: 25 }, (_, index) => [
      0.00005,
      (24 - index) * 0.002,
    ]);
    const route: LonLat[] = [...outbound, ...returnLeg];
    const markers = sampleDirectionMarkers(route);

    assertTravelOrder(markers);
    expect(markers.length).toBeLessThanOrEqual(40);
    expect(markers[markers.length - 1]!.sequence).toBe(markers.length);

    const pairs = ambiguityKinds(markers);
    expect(pairs.before.length).toBeGreaterThanOrEqual(1);
    expect(pairs.after.length).toBeGreaterThanOrEqual(1);
    expect(pairs.before.length).toBe(pairs.after.length);
    expect(pairs.before.length + pairs.after.length).toBeLessThanOrEqual(40);

    for (let index = 0; index < markers.length; index += 1) {
      for (let other = index + 1; other < markers.length; other += 1) {
        const left = markers[index]!;
        const right = markers[other]!;
        if (isIntentionalPairKinds(left.kind, right.kind)) {
          continue;
        }
        expect(
          segmentLengthMeters([left.lon, left.lat], [right.lon, right.lat]),
        ).toBeGreaterThanOrEqual(40);
      }
    }
  });

  it('keeps non-pair markers spatially separated on stacked outbound/return geometry', () => {
    const outbound: LonLat[] = Array.from({ length: 11 }, (_, index) => [0, index * 0.001]);
    const inbound: LonLat[] = Array.from({ length: 10 }, (_, index) => [
      0.00002,
      (9 - index) * 0.001,
    ]);
    const markers = sampleDirectionMarkers([...outbound, ...inbound], {
      minRouteLengthMeters: 100,
      minSpatialSeparationMeters: 40,
    });
    assertTravelOrder(markers);

    for (let index = 0; index < markers.length; index += 1) {
      for (let other = index + 1; other < markers.length; other += 1) {
        const left = markers[index]!;
        const right = markers[other]!;
        if (isIntentionalPairKinds(left.kind, right.kind)) {
          continue;
        }
        expect(
          segmentLengthMeters([left.lon, left.lat], [right.lon, right.lat]),
        ).toBeGreaterThanOrEqual(40);
      }
    }
  });

  it('assigns increasing progress from start toward finish', () => {
    const route: LonLat[] = Array.from({ length: 21 }, (_, index) => [0, index * 0.01]);
    const markers = sampleDirectionMarkers(route, SHORT_ROUTE_OPTIONS);
    assertTravelOrder(markers);
    expect(markers[0]!.progress).toBeGreaterThan(0);
    expect(markers[markers.length - 1]!.progress).toBeLessThan(1);
    expect(markers[0]!.progress).toBeLessThan(markers[markers.length - 1]!.progress);
  });

  it('hard-caps markers even when ambiguity candidates exceed the budget', () => {
    const route: LonLat[] = [];
    for (let leg = 0; leg < 6; leg += 1) {
      const base = leg * 0.004;
      route.push([0, base], [0, base + 0.002], [0.0002, base + 0.0022], [0, base + 0.002]);
    }
    route.push([0, 0.028]);

    const markers = sampleDirectionMarkers(route, { maxMarkers: 8, minMarkers: 6 });
    assertTravelOrder(markers);
    expect(markers.length).toBeLessThanOrEqual(8);
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
