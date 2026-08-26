import { describe, expect, it } from 'vitest';
import { handlePocRoute } from '../src/poc/route-handler';
import { parseCoordinate, validateRouteSpikeRequest } from '../src/poc/validate-route';

function encodePolyline6(coordinates: Array<[number, number]>): string {
  let lastLat = 0;
  let lastLon = 0;
  let result = '';
  const factor = 1e6;
  const encodeSigned = (value: number): void => {
    let v = value < 0 ? ~(value << 1) : value << 1;
    while (v >= 0x20) {
      result += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
      v >>= 5;
    }
    result += String.fromCharCode(v + 63);
  };
  for (const [lon, lat] of coordinates) {
    const ilat = Math.round(lat * factor);
    const ilon = Math.round(lon * factor);
    encodeSigned(ilat - lastLat);
    encodeSigned(ilon - lastLon);
    lastLat = ilat;
    lastLon = ilon;
  }
  return result;
}

describe('validateRouteSpikeRequest', () => {
  it('accepts lat/lon coordinates and optional waypoints', () => {
    const result = validateRouteSpikeRequest({
      start: { lat: 33.0, lon: -117.0 },
      destination: { lat: 33.1, lon: -117.1 },
      waypoints: [{ lat: 33.05, lon: -117.05 }],
      costing: 'road',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.request.waypoints).toHaveLength(1);
      expect(result.request.start.latitude).toBe(33);
    }
  });

  it('accepts latitude/longitude aliases', () => {
    const coord = parseCoordinate({ latitude: 34.0, longitude: -118.0 }, 'start', []);
    expect(coord).toEqual({ latitude: 34, longitude: -118 });
  });
});

describe('handlePocRoute', () => {
  it('returns 404 outside local', async () => {
    const response = await handlePocRoute(
      new Request('http://localhost/api/poc/routes/route', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          start: { lat: 33, lon: -117 },
          destination: { lat: 33.1, lon: -117.1 },
        }),
      }),
      {
        ENVIRONMENT: 'development',
        SUPABASE_URL: 'http://127.0.0.1:54321',
        VALHALLA_BASE_URL: 'https://valhalla.example.test',
      } as unknown as Env,
    );
    expect(response.status).toBe(404);
  });

  it('returns normalized route data from the adapter', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          trip: {
            legs: [
              {
                shape: encodePolyline6([
                  [-117.0, 33.0],
                  [-117.1, 33.1],
                ]),
              },
            ],
            summary: { length: 1.2, time: 300 },
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );

    try {
      const response = await handlePocRoute(
        new Request('http://localhost/api/poc/routes/route', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            start: { lat: 33.0, lon: -117.0 },
            destination: { lat: 33.1, lon: -117.1 },
          }),
        }),
        {
          ENVIRONMENT: 'local',
          SUPABASE_URL: 'http://127.0.0.1:54321',
          VALHALLA_BASE_URL: 'https://valhalla.example.test',
        } as unknown as Env,
      );

      expect(response.status).toBe(200);
      const body = (await response.json()) as {
        geometry: { type: string; coordinates: unknown[] };
        distanceMeters: number;
        durationSeconds: number;
      };
      expect(body.geometry.type).toBe('LineString');
      expect(body.geometry.coordinates.length).toBeGreaterThanOrEqual(2);
      expect(body.distanceMeters).toBe(1200);
      expect(body.durationSeconds).toBe(300);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
