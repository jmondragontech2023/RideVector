import { describe, expect, it } from 'vitest';
import { haversineMeters } from '../src/poc/anchors';
import { METERS_PER_MILE } from '../src/poc/config';
import { DEFAULT_POC_FEATURES } from '../src/poc/features';
import { generatePocRoutes } from '../src/poc/generate';
import { buildPointToPointPatterns } from '../src/poc/point-to-point';
import { geometryMeetsRequestedEndpoints } from '../src/poc/coordinates';
import type {
  RouteLoopRequest,
  RouteLoopResult,
  RouteRequest,
  RoutingProvider,
} from '../src/poc/routing/provider';
import type { ValidatedPocGenerateRequest } from '../src/poc/validate';

const START = { latitude: 37.7694, longitude: -122.4862 };
const END = { latitude: 37.8076, longitude: -122.475 };

function ptpRequest(
  overrides: Partial<ValidatedPocGenerateRequest> = {},
): ValidatedPocGenerateRequest {
  return {
    start: START,
    end: END,
    routeMode: 'point_to_point',
    targetDistanceMeters: 12 * METERS_PER_MILE,
    distanceFlexibilityMeters: 3 * METERS_PER_MILE,
    costing: 'road',
    seed: 4,
    features: { ...DEFAULT_POC_FEATURES },
    elevationPreference: 'none',
    trafficPreference: 'none',
    departure: {
      mode: 'now',
      departureInstantIso: '2026-09-02T18:00:00.000Z',
      timeZone: 'UTC',
    },
    ...overrides,
  };
}

function openLine(
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number,
  viaOffset = 0,
): Array<[number, number]> {
  return [
    [startLon, startLat],
    [startLon + viaOffset, startLat + 0.01],
    [endLon, endLat],
  ];
}

class OpenRouteProvider implements RoutingProvider {
  constructor(
    private readonly impl: (request: RouteRequest) => RouteLoopResult,
  ) {}

  route(request: RouteRequest): Promise<RouteLoopResult> {
    return Promise.resolve(this.impl(request));
  }

  routeLoop(request: RouteLoopRequest): Promise<RouteLoopResult> {
    return this.route({
      locations: [request.start, ...request.waypoints, request.start],
      costing: request.costing,
    });
  }
}

describe('buildPointToPointPatterns', () => {
  it('always starts with the direct Start → End corridor', () => {
    const patterns = buildPointToPointPatterns(START, END, 8_000, 12_000, 7, 6);
    expect(patterns[0]).toEqual({ id: 'direct', locations: [START, END] });
    expect(patterns.length).toBe(6);
    expect(patterns.slice(1).every((pattern) => pattern.locations[0] === START)).toBe(true);
    expect(patterns.slice(1).every((pattern) => pattern.locations.at(-1) === END)).toBe(true);
    expect(patterns.slice(1).every((pattern) => pattern.locations.length === 3)).toBe(true);
  });

  it('is deterministic for a fixed seed', () => {
    const a = buildPointToPointPatterns(START, END, 8_000, 12_000, 11, 5);
    const b = buildPointToPointPatterns(START, END, 8_000, 12_000, 11, 5);
    expect(a).toEqual(b);
  });
});

describe('generatePocRoutes point-to-point', () => {
  it('returns open alternatives that keep requested endpoints', async () => {
    let calls = 0;
    const provider = new OpenRouteProvider((request) => {
      calls += 1;
      const start = request.locations[0]!;
      const end = request.locations[request.locations.length - 1]!;
      const via = request.locations[1] ?? start;
      const offset = via.longitude - start.longitude;
      return {
        ok: true,
        geometry: {
          type: 'LineString',
          coordinates: openLine(start.latitude, start.longitude, end.latitude, end.longitude, offset),
        },
        distanceMeters: 12 * METERS_PER_MILE + calls * 80,
        durationSeconds: 3200,
      };
    });

    const result = await generatePocRoutes(ptpRequest(), { provider, candidateCount: 6 });
    expect(result.routeMode).toBe('point_to_point');
    expect(result.end).toEqual(END);
    expect(result.acceptedCount).toBeGreaterThanOrEqual(1);
    expect(result.alternatives.length).toBeLessThanOrEqual(3);
    expect(result.warnings.some((warning) => warning.includes('loop'))).toBe(false);
    for (const alternative of result.alternatives) {
      expect(
        geometryMeetsRequestedEndpoints(alternative.geometry, START, END),
      ).toBe(true);
      expect(alternative.id).toMatch(/^poc-4-\d+-(direct|detour-\d+)$/);
      const first = alternative.geometry.coordinates[0]!;
      const last = alternative.geometry.coordinates.at(-1)!;
      expect(haversineMeters({ longitude: first[0], latitude: first[1] }, START)).toBeLessThan(1);
      expect(haversineMeters({ longitude: last[0], latitude: last[1] }, END)).toBeLessThan(1);
    }
    expect(result.scoringVersion).toBe('poc-scoring-v2');
    expect(result.alternatives.some((alt) => alt.categories.includes('cleanest_loop'))).toBe(false);
  });

  it('rejects routes that miss the requested endpoints', async () => {
    const provider = new OpenRouteProvider(() => ({
      ok: true,
      geometry: {
        type: 'LineString',
        coordinates: [
          [-122.3, 37.7],
          [-122.2, 37.9],
        ],
      },
      distanceMeters: 12 * METERS_PER_MILE,
      durationSeconds: 3000,
    }));

    const result = await generatePocRoutes(ptpRequest(), { provider, candidateCount: 3 });
    expect(result.acceptedCount).toBe(0);
    expect(result.rejections.endpoint_mismatch).toBeGreaterThanOrEqual(1);
    expect(result.warnings[0]).toMatch(/start-to-end/);
    expect(result.candidateDiagnostics.some((item) => item.rejectionReason === 'endpoint_mismatch')).toBe(
      true,
    );
  });

  it('does not invent a third alternative from a duplicate corridor', async () => {
    const shared = openLine(START.latitude, START.longitude, END.latitude, END.longitude, 0.01);
    const provider = new OpenRouteProvider(() => ({
      ok: true,
      geometry: { type: 'LineString', coordinates: shared },
      distanceMeters: 12 * METERS_PER_MILE,
      durationSeconds: 3000,
    }));

    const result = await generatePocRoutes(ptpRequest({ seed: 2 }), {
      provider,
      candidateCount: 6,
    });
    expect(result.acceptedCount).toBe(1);
    expect(result.rejections.duplicate_candidate).toBeGreaterThanOrEqual(1);
    expect(result.alternatives).toHaveLength(1);
  });

  it('never applies a loop-closure penalty to an otherwise clean open path', async () => {
    const provider = new OpenRouteProvider(() => ({
      ok: true,
      geometry: {
        type: 'LineString',
        coordinates: openLine(START.latitude, START.longitude, END.latitude, END.longitude, 0.02),
      },
      distanceMeters: 12 * METERS_PER_MILE,
      durationSeconds: 3000,
    }));

    const result = await generatePocRoutes(ptpRequest(), { provider, candidateCount: 1 });
    const quality = result.alternatives[0]?.scoring.components.loopQuality;
    expect(quality?.score).toBeGreaterThan(70);
    expect(result.alternatives[0]?.scoring.explanations).not.toContain('clean loop shape');
  });
});
