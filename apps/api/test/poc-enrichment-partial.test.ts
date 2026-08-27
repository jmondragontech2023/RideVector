import { describe, expect, it } from 'vitest';
import { METERS_PER_MILE } from '../src/poc/config';
import { DEFAULT_POC_FEATURES } from '../src/poc/features';
import { generatePocRoutes } from '../src/poc/generate';
import type {
  RouteLoopRequest,
  RouteLoopResult,
  RouteRequest,
  RoutingProvider,
} from '../src/poc/routing/provider';
import type { ElevationProvider } from '../src/poc/elevation/provider';
import type { WeatherProvider } from '../src/poc/weather/provider';
import type { TrafficProvider } from '../src/poc/traffic/provider';
import type { ValidatedPocGenerateRequest } from '../src/poc/validate';

class MockRoutingProvider implements RoutingProvider {
  route(request: RouteRequest): Promise<RouteLoopResult> {
    const start = request.locations[0]!;
    return this.routeLoop({
      start,
      waypoints: request.locations.slice(1, -1),
      costing: request.costing ?? 'road',
    });
  }

  routeLoop(request: RouteLoopRequest): Promise<RouteLoopResult> {
    const wp = request.waypoints[0] ?? request.start;
    return Promise.resolve({
      ok: true,
      geometry: {
        type: 'LineString',
        coordinates: [
          [request.start.longitude, request.start.latitude],
          [wp.longitude, wp.latitude],
          [request.start.longitude + 0.01, request.start.latitude + 0.01],
          [request.start.longitude, request.start.latitude],
        ],
      },
      distanceMeters: 20_000,
      durationSeconds: 3600,
    });
  }
}

describe('partial enrichment failures', () => {
  const request: ValidatedPocGenerateRequest = {
    start: { latitude: 37.7749, longitude: -122.4194 },
    targetDistanceMeters: 20_000,
    distanceFlexibilityMeters: 3 * METERS_PER_MILE,
    costing: 'road',
    seed: 1,
    features: {
      ...DEFAULT_POC_FEATURES,
      elevationEnrichment: true,
      weatherForecast: true,
      motorTrafficEnrichment: true,
    },
    elevationPreference: 'none',
    trafficPreference: 'none',
    departure: {
      mode: 'now',
      departureInstantIso: '2026-08-26T18:00:00.000Z',
      timeZone: 'UTC',
    },
  };

  it('keeps routing success when elevation, weather, and traffic fail', async () => {
    const elevationProvider: ElevationProvider = {
      profile: async () => {
        throw new Error('elevation down');
      },
    };
    const weatherProvider: WeatherProvider = {
      forecast: async () => {
        throw new Error('weather down');
      },
    };
    const trafficProvider: TrafficProvider = {
      sample: async () => {
        throw new Error('traffic down');
      },
    };

    const result = await generatePocRoutes(request, {
      provider: new MockRoutingProvider(),
      elevationProvider,
      weatherProvider,
      trafficProvider,
      candidateCount: 3,
    });

    expect(result.acceptedCount).toBeGreaterThan(0);
    expect(result.alternatives[0]?.elevation?.status).toBe('unavailable');
    expect(result.alternatives[0]?.weather?.status).toBe('unavailable');
    expect(result.alternatives[0]?.traffic?.status).toMatch(/unavailable|partial|ok/);
    expect(JSON.stringify(result)).not.toContain('elevation down');
    expect(JSON.stringify(result)).not.toContain('api.tomtom');
  });
});
