import { describe, expect, it } from 'vitest';
import { geometryMidpoint } from '../src/poc/anchors';
import { METERS_PER_MILE } from '../src/poc/config';
import {
  selectPointToPointAlternatives,
  selectRouteAlternatives,
  type RoutableCandidate,
} from '../src/poc/selection';

const miles = (value: number): number => value * METERS_PER_MILE;

function candidate(
  attemptNumber: number,
  distanceMiles: number,
  classification: RoutableCandidate['classification'],
  bearingFamily = `${attemptNumber}°`,
): RoutableCandidate {
  const distanceMeters = miles(distanceMiles);
  const targetMeters = miles(12);
  const geometry = {
    type: 'LineString' as const,
    coordinates: [
      [-122.42, 37.77 + attemptNumber * 0.01],
      [-122.41, 37.78 + attemptNumber * 0.01],
      [-122.42, 37.77 + attemptNumber * 0.01],
    ] as Array<[number, number]>,
  };
  return {
    attemptNumber,
    bearingFamily,
    geometry,
    distanceMeters,
    durationSeconds: 3600,
    distanceFromTargetMeters: distanceMeters - targetMeters,
    midpoint: geometryMidpoint(geometry.coordinates),
    classification,
  };
}

describe('selectRouteAlternatives', () => {
  const targetMeters = miles(12);

  it('does not add near matches when at least two within-range alternatives exist', () => {
    const result = selectRouteAlternatives(
      [
        candidate(1, 11.5, 'within_range'),
        candidate(2, 12.2, 'within_range'),
        candidate(3, 15.5, 'near_match'),
      ],
      targetMeters,
    );
    expect(result.selected).toHaveLength(2);
    expect(result.selected.every((item) => item.classification === 'within_range')).toBe(true);
  });

  it('supplements with near matches when fewer than two within-range alternatives exist', () => {
    const result = selectRouteAlternatives(
      [
        candidate(1, 12.1, 'within_range'),
        candidate(2, 15.6, 'near_match'),
        candidate(3, 8.6, 'near_match'),
      ],
      targetMeters,
    );
    expect(result.selected).toHaveLength(3);
    expect(result.selected.filter((item) => item.classification === 'near_match')).toHaveLength(2);
  });

  it('supplements when zero within-range alternatives exist', () => {
    const result = selectRouteAlternatives(
      [candidate(1, 15.6, 'near_match'), candidate(2, 8.6, 'near_match')],
      targetMeters,
    );
    expect(result.selected).toHaveLength(2);
    expect(result.selected.every((item) => item.classification === 'near_match')).toBe(true);
  });

  it('sorts within-range routes before near matches', () => {
    const result = selectRouteAlternatives(
      [
        candidate(1, 15.6, 'near_match'),
        candidate(2, 12.1, 'within_range'),
        candidate(3, 8.6, 'near_match'),
      ],
      targetMeters,
    );
    expect(result.selected[0]?.classification).toBe('within_range');
    expect(result.selected.slice(1).every((item) => item.classification === 'near_match')).toBe(
      true,
    );
  });

  it('places overflow candidates into notSelected for explicit accounting', () => {
    const result = selectRouteAlternatives(
      [
        candidate(1, 11.5, 'within_range'),
        candidate(2, 12.0, 'within_range'),
        candidate(3, 12.5, 'within_range'),
        candidate(4, 12.8, 'within_range'),
      ],
      targetMeters,
    );
    expect(result.selected).toHaveLength(3);
    expect(result.notSelected.length + result.duplicates.length).toBeGreaterThanOrEqual(1);
  });
});

describe('selectPointToPointAlternatives', () => {
  const targetMeters = miles(12);

  function openPath(
    attemptNumber: number,
    distanceMiles: number,
    lonOffset: number,
  ): RoutableCandidate {
    const base = candidate(attemptNumber, distanceMiles, 'within_range', `detour-${attemptNumber}`);
    return {
      ...base,
      geometry: {
        type: 'LineString',
        coordinates: [
          [-122.42, 37.77],
          [-122.42 + lonOffset, 37.78],
          [-122.4, 37.8],
        ],
      },
    };
  }

  it('keeps corridor-sharing routes that take different interiors', () => {
    const result = selectPointToPointAlternatives(
      [openPath(1, 12.0, 0.01), openPath(2, 12.2, 0.08), openPath(3, 12.4, -0.07)],
      targetMeters,
      0.88,
    );
    expect(result.selected.length).toBeGreaterThanOrEqual(2);
    expect(result.selected.length).toBeLessThanOrEqual(3);
  });

  it('treats nearly identical open paths as duplicates', () => {
    const first = openPath(1, 12.0, 0.01);
    const twin = {
      ...openPath(2, 12.1, 0.01),
      geometry: first.geometry,
    };
    const result = selectPointToPointAlternatives([first, twin], targetMeters, 0.88);
    expect(result.selected).toHaveLength(1);
    expect(result.duplicates).toHaveLength(1);
  });
});
