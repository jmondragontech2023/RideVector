import { describe, expect, it } from 'vitest';
import {
  deleteSavedRoute,
  emptyStore,
  loadPocStore,
  parsePocStore,
  POC_STORAGE_KEY,
  upsertSavedRoute,
  type SavedPocRoute,
} from './storage';
import { METERS_PER_MILE } from './units';

const sampleRoute: SavedPocRoute = {
  id: 'saved-1',
  savedAt: '2026-08-26T00:00:00.000Z',
  label: 'Test loop',
  start: { latitude: 37.77, longitude: -122.42 },
  targetDistanceMeters: 12 * METERS_PER_MILE,
  distanceFlexibilityMeters: 3 * METERS_PER_MILE,
  costing: 'road',
  seed: 1,
  alternative: {
    id: 'alt-1',
    name: 'Route A',
    geometry: {
      type: 'LineString',
      coordinates: [
        [-122.42, 37.77],
        [-122.41, 37.78],
      ],
    },
    distanceMeters: 12.8 * METERS_PER_MILE,
    durationSeconds: 3000,
    distanceFromTargetMeters: 0.8 * METERS_PER_MILE,
    bearingFamily: 'bearing-0',
    warnings: ['Near match warning'],
    distanceClassification: 'near_match',
    requestedRangeMeters: {
      min: 9 * METERS_PER_MILE,
      max: 15 * METERS_PER_MILE,
    },
    rangeDeviationMeters: 0.8 * METERS_PER_MILE,
    targetDifferencePercent: 6.7,
  },
  feedback: {
    wouldRide: 'maybe',
    deviationAcceptable: true,
  },
};

describe('poc local storage', () => {
  it('exposes a versioned storage key', () => {
    expect(POC_STORAGE_KEY).toBe('ridevector.poc.routes.v1');
  });

  it('returns an empty store for corrupt JSON', () => {
    expect(parsePocStore('{not-json')).toEqual(emptyStore());
    expect(parsePocStore('{"version":2,"routes":[]}')).toEqual(emptyStore());
    expect(parsePocStore('null')).toEqual(emptyStore());
  });

  it('drops saved routes with corrupt nested alternative fields', () => {
    const corrupt = JSON.stringify({
      version: 1,
      routes: [
        {
          ...sampleRoute,
          alternative: { id: 'alt-1', name: 'Route A' },
        },
        {
          ...sampleRoute,
          id: 'saved-2',
          alternative: {
            ...sampleRoute.alternative,
            geometry: { type: 'Point', coordinates: [-122.42, 37.77] },
          },
        },
        sampleRoute,
      ],
    });
    const parsed = parsePocStore(corrupt);
    expect(parsed.routes).toHaveLength(1);
    expect(parsed.routes[0]?.id).toBe('saved-1');
  });

  it('preserves near-match classification on save and reload', () => {
    const withOne = upsertSavedRoute(emptyStore(), sampleRoute);
    const raw = JSON.stringify(withOne);
    const parsed = parsePocStore(raw);
    expect(parsed.routes[0]?.alternative.distanceClassification).toBe('near_match');
    expect(parsed.routes[0]?.distanceFlexibilityMeters).toBeCloseTo(3 * METERS_PER_MILE);
    expect(parsed.routes[0]?.feedback?.deviationAcceptable).toBe(true);
  });

  it('migrates legacy v1 saved routes missing flexibility fields', () => {
    const legacy = JSON.stringify({
      version: 1,
      routes: [
        {
          id: 'legacy-1',
          savedAt: '2026-08-20T00:00:00.000Z',
          label: 'Legacy loop',
          start: { latitude: 37.77, longitude: -122.42 },
          targetDistanceMeters: 12 * METERS_PER_MILE,
          costing: 'road',
          seed: 2,
          alternative: {
            id: 'alt-legacy',
            name: 'Route A',
            geometry: {
              type: 'LineString',
              coordinates: [
                [-122.42, 37.77],
                [-122.41, 37.78],
              ],
            },
            distanceMeters: 12 * METERS_PER_MILE,
            durationSeconds: 2800,
            distanceFromTargetMeters: 0,
            bearingFamily: 'bearing-60',
            warnings: [],
          },
          feedback: { wouldRide: 'yes' },
        },
      ],
    });

    const parsed = parsePocStore(legacy);
    expect(parsed.routes).toHaveLength(1);
    expect(parsed.routes[0]?.id).toBe('legacy-1');
    expect(parsed.routes[0]?.distanceFlexibilityMeters).toBeCloseTo(3 * METERS_PER_MILE);
    expect(parsed.routes[0]?.alternative.distanceClassification).toBe('within_range');
    expect(parsed.routes[0]?.alternative.requestedRangeMeters.min).toBeCloseTo(9 * METERS_PER_MILE);
    expect(parsed.routes[0]?.alternative.requestedRangeMeters.max).toBeCloseTo(
      15 * METERS_PER_MILE,
    );
  });

  it('rewrites migrated legacy routes back to storage on load', () => {
    const legacyRaw = JSON.stringify({
      version: 1,
      routes: [
        {
          id: 'legacy-2',
          savedAt: '2026-08-20T00:00:00.000Z',
          label: 'Legacy rewrite',
          start: { latitude: 37.77, longitude: -122.42 },
          targetDistanceMeters: 10 * METERS_PER_MILE,
          costing: 'gravel',
          seed: 3,
          alternative: {
            id: 'alt-legacy-2',
            name: 'Route A',
            geometry: {
              type: 'LineString',
              coordinates: [
                [-122.42, 37.77],
                [-122.4, 37.79],
              ],
            },
            distanceMeters: 10 * METERS_PER_MILE,
            durationSeconds: 2500,
            distanceFromTargetMeters: 0,
            bearingFamily: 'bearing-0',
            warnings: [],
          },
        },
      ],
    });
    let stored = legacyRaw;
    const memory: Pick<Storage, 'getItem' | 'setItem'> = {
      getItem: () => stored,
      setItem: (_key, value) => {
        stored = value;
      },
    };

    const loaded = loadPocStore(memory);
    expect(loaded.routes).toHaveLength(1);
    const rewritten = JSON.parse(stored) as {
      routes: Array<{ distanceFlexibilityMeters?: number }>;
    };
    expect(rewritten.routes[0]?.distanceFlexibilityMeters).toBeCloseTo(3 * METERS_PER_MILE);
  });

  it('upserts and deletes saved routes', () => {
    const withOne = upsertSavedRoute(emptyStore(), sampleRoute);
    expect(withOne.routes).toHaveLength(1);
    const updated = upsertSavedRoute(withOne, { ...sampleRoute, label: 'Updated' });
    expect(updated.routes).toHaveLength(1);
    expect(updated.routes[0]?.label).toBe('Updated');
    expect(deleteSavedRoute(updated, sampleRoute.id).routes).toHaveLength(0);
  });
});
