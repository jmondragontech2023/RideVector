import { describe, expect, it, vi } from 'vitest';
import { POC_CONFIG } from '../src/poc/config';
import {
  buildValhallaRouteBody,
  mapValhallaRouteResponse,
  toValhallaLocations,
  valhallaUpstreamHeaders,
} from '../src/poc/routing/valhalla-mapping';
import { ValhallaRoutingProvider } from '../src/poc/routing/valhalla';

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

describe('valhalla mapping', () => {
  it('serializes multi-location bicycle requests', () => {
    const locations = [
      { latitude: 33.0, longitude: -117.0 },
      { latitude: 33.05, longitude: -117.05 },
      { latitude: 33.1, longitude: -117.1 },
    ];
    const body = buildValhallaRouteBody(locations, 'gravel');
    expect(body.costing).toBe('bicycle');
    expect(body.costing_options.bicycle.bicycle_type).toBe('Mountain');
    expect(body.locations).toEqual([
      { lat: 33, lon: -117, type: 'break' },
      { lat: 33.05, lon: -117.05, type: 'break' },
      { lat: 33.1, lon: -117.1, type: 'break' },
    ]);
    expect(toValhallaLocations(locations)).toHaveLength(3);
  });

  it('maps Valhalla responses into normalized route data', () => {
    const shape = encodePolyline6([
      [-117.0, 33.0],
      [-117.05, 33.05],
      [-117.1, 33.1],
    ]);
    const mapped = mapValhallaRouteResponse({
      trip: {
        legs: [{ shape }],
        summary: { length: 12.5, time: 2400 },
      },
    });
    expect(mapped.ok).toBe(true);
    if (mapped.ok) {
      expect(mapped.route.distanceMeters).toBe(12_500);
      expect(mapped.route.durationSeconds).toBe(2400);
      expect(mapped.route.geometry.coordinates.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('classifies malformed upstream payloads', () => {
    expect(mapValhallaRouteResponse({ error: 'No path' }).ok).toBe(false);
    expect(mapValhallaRouteResponse({ trip: { legs: [] } }).ok).toBe(false);
  });

  it('adds X-Client-Id for public demo etiquette', () => {
    const headers = valhallaUpstreamHeaders('RideVector');
    expect(headers).toMatchObject({
      'X-Client-Id': 'RideVector',
      'content-type': 'application/json',
    });
    expect(POC_CONFIG.valhallaClientId).toBe('RideVector');
  });
});

describe('ValhallaRoutingProvider', () => {
  it('uses configured base URL without leaking it in results', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
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
            summary: { length: 5, time: 900 },
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const provider = new ValhallaRoutingProvider({
      baseUrl: 'https://valhalla.example.test',
      fetchImpl,
      clientId: 'RideVector',
    });

    const result = await provider.route({
      locations: [
        { latitude: 33.0, longitude: -117.0 },
        { latitude: 33.1, longitude: -117.1 },
      ],
      costing: 'road',
    });

    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://valhalla.example.test/route');
    expect(init.headers).toMatchObject({ 'X-Client-Id': 'RideVector' });
    const payload = JSON.parse(String(init.body));
    expect(payload.costing).toBe('bicycle');
    expect(payload.locations).toHaveLength(2);
    if (result.ok) {
      expect(JSON.stringify(result)).not.toContain('valhalla.example.test');
    }
  });

  it('binds the default global fetch implementation for Workers', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
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
            summary: { length: 5, time: 900 },
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const provider = new ValhallaRoutingProvider({
      baseUrl: 'https://valhalla.example.test',
    });

    const result = await provider.route({
      locations: [
        { latitude: 33.0, longitude: -117.0 },
        { latitude: 33.1, longitude: -117.1 },
      ],
    });

    expect(result.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledOnce();
    fetchSpy.mockRestore();
  });

  it('routes loops through ordered start, waypoints, and return to start', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          trip: {
            legs: [
              {
                shape: encodePolyline6([
                  [-117, 33],
                  [-117.1, 33.1],
                  [-117, 33],
                ]),
              },
            ],
            summary: { length: 8, time: 1200 },
          },
        }),
        { status: 200 },
      ),
    );

    const provider = new ValhallaRoutingProvider({
      baseUrl: 'https://valhalla.example.test',
      fetchImpl,
    });

    await provider.routeLoop({
      start: { latitude: 33, longitude: -117 },
      waypoints: [{ latitude: 33.1, longitude: -117.1 }],
      costing: 'road',
    });

    const payload = JSON.parse(String((fetchImpl.mock.calls[0] as [string, RequestInit])[1].body));
    expect(payload.locations).toHaveLength(3);
    expect(payload.locations[0]).toEqual({ lat: 33, lon: -117, type: 'break' });
    expect(payload.locations[2]).toEqual({ lat: 33, lon: -117, type: 'break' });
  });
});
