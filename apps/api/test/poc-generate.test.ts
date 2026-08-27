import { describe, expect, it } from 'vitest';
import { generatePocRoutes } from '../src/poc/generate';
import { isPocGenerationEnabled, handlePocGenerate } from '../src/poc/handler';
import type {
  RouteLoopRequest,
  RouteLoopResult,
  RouteRequest,
  RoutingProvider,
} from '../src/poc/routing/provider';
import { ValhallaRoutingProvider } from '../src/poc/routing/valhalla';

function squareLoop(
  startLat: number,
  startLon: number,
  sizeDegrees: number,
): Array<[number, number]> {
  return [
    [startLon, startLat],
    [startLon + sizeDegrees, startLat],
    [startLon + sizeDegrees, startLat + sizeDegrees],
    [startLon, startLat + sizeDegrees],
    [startLon, startLat],
  ];
}

class MockRoutingProvider implements RoutingProvider {
  constructor(
    private readonly impl: (
      request: RouteLoopRequest,
    ) => Promise<RouteLoopResult> | RouteLoopResult,
  ) {}

  route(request: RouteRequest): Promise<RouteLoopResult> {
    if (request.locations.length < 2) {
      return Promise.resolve({
        ok: false,
        reason: 'malformed_geometry',
        message: 'need two locations',
      });
    }
    const start = request.locations[0]!;
    const waypoints = request.locations.slice(1, -1);
    return this.routeLoop({
      start,
      waypoints,
      costing: request.costing ?? 'road',
    });
  }

  routeLoop(request: RouteLoopRequest): Promise<RouteLoopResult> {
    return Promise.resolve(this.impl(request));
  }
}

describe('generatePocRoutes with mocked provider', () => {
  const request = {
    start: { latitude: 37.7749, longitude: -122.4194 },
    targetDistanceMeters: 20_000,
    costing: 'road' as const,
    seed: 3,
  };

  it('maps successful candidates into factual alternatives within tolerance', async () => {
    const provider = new MockRoutingProvider((routeRequest) => {
      const wp = routeRequest.waypoints[0]!;
      const geometry = squareLoop(wp.latitude, wp.longitude, 0.02);
      return {
        ok: true,
        geometry: { type: 'LineString', coordinates: geometry },
        distanceMeters: 20_000,
        durationSeconds: 3600,
      };
    });

    const result = await generatePocRoutes(request, {
      provider,
      now: (() => {
        let t = 1000;
        return () => {
          t += 25;
          return t;
        };
      })(),
    });

    expect(result.seed).toBe(3);
    expect(result.acceptedCount).toBeGreaterThanOrEqual(1);
    expect(result.alternatives.length).toBeGreaterThanOrEqual(1);
    expect(result.alternatives.length).toBeLessThanOrEqual(3);
    expect(result.alternatives[0]?.name).toBe('Route A');
    expect(result.alternatives[0]?.geometry.type).toBe('LineString');
    expect(result.durationMs).toBeGreaterThan(0);
    expect(result.candidateDiagnostics.length).toBeGreaterThan(0);
    expect(result.diagnosticSummary.acceptedCount).toBe(result.acceptedCount);
    expect(JSON.stringify(result)).not.toContain('timeout');
  });

  it('is deterministic for identical input and seed', async () => {
    let calls = 0;
    const provider = new MockRoutingProvider(() => {
      calls += 1;
      const offset = (calls % 6) * 0.01;
      return {
        ok: true,
        geometry: {
          type: 'LineString',
          coordinates: squareLoop(37.77 + offset, -122.42 - offset, 0.03),
        },
        distanceMeters: 19_500 + calls * 10,
        durationSeconds: 3500,
      };
    });

    const a = await generatePocRoutes(request, { provider, candidateCount: 6 });
    calls = 0;
    const b = await generatePocRoutes(request, { provider, candidateCount: 6 });
    expect(a.alternatives.map((alt) => alt.bearingFamily)).toEqual(
      b.alternatives.map((alt) => alt.bearingFamily),
    );
    expect(a.rejections).toEqual(b.rejections);
  });

  it('counts outside_tolerance and upstream_failure separately', async () => {
    let call = 0;
    const provider = new MockRoutingProvider(() => {
      call += 1;
      if (call === 1) {
        return { ok: false, reason: 'upstream_failure', message: 'timeout' };
      }
      return {
        ok: true,
        geometry: { type: 'LineString', coordinates: squareLoop(37.7, -122.4, 0.01) },
        distanceMeters: 50_000,
        durationSeconds: 1000,
      };
    });

    const result = await generatePocRoutes(request, { provider, candidateCount: 3 });
    expect(result.acceptedCount).toBe(0);
    expect(result.rejections.upstream_failure).toBeGreaterThanOrEqual(1);
    expect(result.rejections.outside_tolerance).toBeGreaterThanOrEqual(1);
    expect(result.warnings.length).toBeGreaterThan(0);
    const outside = result.candidateDiagnostics.find(
      (item) => item.rejectionReason === 'outside_tolerance',
    );
    expect(outside?.geometry).toBeDefined();
    const upstream = result.candidateDiagnostics.find(
      (item) => item.rejectionReason === 'upstream_failure',
    );
    expect(upstream?.geometry).toBeUndefined();
  });

  it('filters near-duplicate midpoints', async () => {
    const provider = new MockRoutingProvider(() => ({
      ok: true,
      geometry: {
        type: 'LineString',
        coordinates: squareLoop(37.78, -122.41, 0.02),
      },
      distanceMeters: 20_000,
      durationSeconds: 3000,
    }));

    const result = await generatePocRoutes(request, { provider, candidateCount: 6 });
    expect(result.acceptedCount).toBe(1);
    expect(result.rejections.duplicate_candidate).toBeGreaterThanOrEqual(1);
    const duplicate = result.candidateDiagnostics.find(
      (item) => item.rejectionReason === 'duplicate_candidate',
    );
    expect(duplicate?.geometry).toBeDefined();
  });

  it('returns at most ten candidate diagnostics', async () => {
    const provider = new MockRoutingProvider(() => ({
      ok: true,
      geometry: {
        type: 'LineString',
        coordinates: squareLoop(37.78, -122.41, 0.02),
      },
      distanceMeters: 50_000,
      durationSeconds: 3000,
    }));

    const result = await generatePocRoutes(request, { provider });
    expect(result.candidateDiagnostics.length).toBeLessThanOrEqual(10);
    expect(result.attemptedCount).toBeLessThanOrEqual(10);
  });
});

describe('ValhallaRoutingProvider mapping', () => {
  it('maps a Valhalla-shaped payload without exposing upstream URLs', async () => {
    // Minimal polyline6 for two nearby points (precision 6).
    const shape = encodePolyline6([
      [-122.4194, 37.7749],
      [-122.41, 37.78],
      [-122.4194, 37.7749],
    ]);

    const fetchImpl: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          trip: {
            legs: [{ shape }],
            summary: { length: 12.5, time: 2400 },
            units: 'kilometers',
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );

    const provider = new ValhallaRoutingProvider({
      baseUrl: 'http://valhalla.test',
      fetchImpl,
      timeoutMs: 1000,
    });

    const result = await provider.routeLoop({
      start: { latitude: 37.7749, longitude: -122.4194 },
      waypoints: [{ latitude: 37.78, longitude: -122.41 }],
      costing: 'road',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.distanceMeters).toBe(12_500);
      expect(result.durationSeconds).toBe(2400);
      expect(result.geometry.coordinates.length).toBeGreaterThanOrEqual(2);
      expect(JSON.stringify(result)).not.toContain('valhalla.test');
    }
  });
});

describe('POC handler environment gate', () => {
  it('enables generation only for local', () => {
    expect(isPocGenerationEnabled({ ENVIRONMENT: 'local' })).toBe(true);
    expect(isPocGenerationEnabled({ ENVIRONMENT: 'development' })).toBe(false);
    expect(isPocGenerationEnabled({ ENVIRONMENT: 'staging' })).toBe(false);
    expect(isPocGenerationEnabled({ ENVIRONMENT: 'production' })).toBe(false);
  });

  it('returns 404 outside local even when a body is valid', async () => {
    const env = {
      ENVIRONMENT: 'development',
      SUPABASE_URL: 'http://127.0.0.1:54321',
      VALHALLA_BASE_URL: 'https://valhalla.example.test',
    } as unknown as Env;
    const response = await handlePocGenerate(
      new Request('http://localhost/api/poc/routes/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          start: { latitude: 37.77, longitude: -122.42 },
          targetDistanceMeters: 10_000,
          costing: 'road',
        }),
      }),
      env,
    );
    expect(response.status).toBe(404);
  });

  it('returns validation errors locally without a provider call', async () => {
    const env = {
      ENVIRONMENT: 'local',
      SUPABASE_URL: 'http://127.0.0.1:54321',
      VALHALLA_BASE_URL: 'https://valhalla.example.test',
    } as unknown as Env;
    const response = await handlePocGenerate(
      new Request('http://localhost/api/poc/routes/generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ start: { latitude: 999, longitude: 0 } }),
      }),
      env,
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe('VALIDATION_FAILED');
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
  });
});

/** Local test helper: encode polyline6. */
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
