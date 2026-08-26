import { describe, expect, it } from 'vitest';
import {
  deleteSavedRoute,
  emptyStore,
  parsePocStore,
  POC_STORAGE_KEY,
  upsertSavedRoute,
  type SavedPocRoute,
} from './storage';

const sampleRoute: SavedPocRoute = {
  id: 'saved-1',
  savedAt: '2026-08-26T00:00:00.000Z',
  label: 'Test loop',
  start: { latitude: 37.77, longitude: -122.42 },
  targetDistanceMeters: 16_093.44,
  costing: 'road',
  seed: 1,
  alternative: {
    id: 'alt-1',
    name: 'Route A',
    geometry: { type: 'LineString', coordinates: [[-122.42, 37.77], [-122.41, 37.78]] },
    distanceMeters: 16_000,
    durationSeconds: 3000,
    distanceFromTargetMeters: -93.44,
    bearingFamily: 'bearing-0',
    warnings: [],
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

  it('upserts and deletes saved routes', () => {
    const withOne = upsertSavedRoute(emptyStore(), sampleRoute);
    expect(withOne.routes).toHaveLength(1);
    const updated = upsertSavedRoute(withOne, { ...sampleRoute, label: 'Updated' });
    expect(updated.routes).toHaveLength(1);
    expect(updated.routes[0]?.label).toBe('Updated');
    expect(deleteSavedRoute(updated, sampleRoute.id).routes).toHaveLength(0);
  });
});
