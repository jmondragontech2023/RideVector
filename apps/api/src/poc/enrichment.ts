import { haversineMeters } from './anchors';
import type { ElevationProvider, ElevationSummary } from './elevation/provider';
import { POC_SCORING_CONFIG } from './scoring/config';
import {
  summarizeTrafficSamples,
  type TrafficProvider,
  type TrafficRouteSummary,
  type TrafficSample,
} from './traffic/provider';
import type { PocCoordinate, PocExperimentalFeatures, PocLineString } from './types';
import {
  farthestPointFromStart,
  type WeatherProvider,
  type WeatherSummary,
} from './weather/provider';

export type EnrichmentRouteInput = {
  id: string;
  geometry: PocLineString;
  distanceMeters: number;
  durationSeconds: number;
  start: PocCoordinate;
};

export type RouteEnrichment = {
  elevation: ElevationSummary | null;
  weather: WeatherSummary | null;
  traffic: TrafficRouteSummary | null;
};

export type EnrichmentResult = {
  byRouteId: Map<string, RouteEnrichment>;
  warnings: string[];
  attribution: string[];
  trafficRankingEnabled: boolean;
};

export type EnrichmentDeps = {
  features: PocExperimentalFeatures;
  elevation?: ElevationProvider | null;
  weather?: WeatherProvider | null;
  traffic?: TrafficProvider | null;
  departureInstant: Date;
  signal?: AbortSignal;
};

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  async function run(): Promise<void> {
    while (nextIndex < items.length) {
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await worker(items[current]!);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, Math.max(1, items.length)) }, () => run()),
  );
  return results;
}

function samplePointsAlongRoute(
  geometry: PocLineString,
  count: number,
): PocCoordinate[] {
  const coords = geometry.coordinates;
  if (coords.length === 0) {
    return [];
  }
  if (coords.length <= count) {
    return coords.map(([longitude, latitude]) => ({ latitude, longitude }));
  }
  const points: PocCoordinate[] = [];
  for (let i = 0; i < count; i += 1) {
    const index = Math.round((i * (coords.length - 1)) / (count - 1));
    const point = coords[index]!;
    points.push({ longitude: point[0], latitude: point[1] });
  }
  return points;
}

function dedupeNearby(
  points: PocCoordinate[],
  radiusMeters: number,
): PocCoordinate[] {
  const kept: PocCoordinate[] = [];
  for (const point of points) {
    if (kept.some((existing) => haversineMeters(existing, point) < radiusMeters)) {
      continue;
    }
    kept.push(point);
  }
  return kept;
}

/**
 * Enrich final selected alternatives only. Provider failures yield partial/unknown
 * and never fail the overall generation.
 */
export async function enrichSelectedRoutes(
  routes: EnrichmentRouteInput[],
  deps: EnrichmentDeps,
): Promise<EnrichmentResult> {
  const byRouteId = new Map<string, RouteEnrichment>();
  const warnings: string[] = [];
  const attribution: string[] = [];

  for (const route of routes) {
    byRouteId.set(route.id, { elevation: null, weather: null, traffic: null });
  }

  if (deps.features.elevationEnrichment && deps.elevation) {
    attribution.push('Elevation via Valhalla-compatible height service');
    await mapPool(routes, 3, async (route) => {
      try {
        const elevation = await deps.elevation!.profile({
          geometry: route.geometry,
          distanceMeters: route.distanceMeters,
          signal: deps.signal,
        });
        const current = byRouteId.get(route.id)!;
        byRouteId.set(route.id, { ...current, elevation });
      } catch {
        const current = byRouteId.get(route.id)!;
        byRouteId.set(route.id, {
          ...current,
          elevation: {
            status: 'unavailable',
            gainMeters: null,
            lossMeters: null,
            minMeters: null,
            maxMeters: null,
            gainPerMile: null,
            coverage: null,
            confidence: 'unknown',
            provider: 'valhalla_height',
          },
        });
      }
    });
  }

  if (deps.features.weatherForecast && deps.weather) {
    attribution.push('Weather data by Open-Meteo.com');
    await mapPool(routes, 3, async (route) => {
      const midpointCoords = samplePointsAlongRoute(route.geometry, 3);
      const midpoint = midpointCoords[1] ?? route.start;
      const farthest = farthestPointFromStart(route.start, route.geometry.coordinates, haversineMeters);
      try {
        const weather = await deps.weather!.forecast({
          samples: [
            { role: 'start', coordinate: route.start },
            { role: 'midpoint', coordinate: midpoint },
            { role: 'farthest', coordinate: farthest },
          ],
          departureInstant: deps.departureInstant,
          durationSeconds: route.durationSeconds,
          signal: deps.signal,
        });
        const current = byRouteId.get(route.id)!;
        byRouteId.set(route.id, { ...current, weather });
      } catch {
        const current = byRouteId.get(route.id)!;
        byRouteId.set(route.id, {
          ...current,
          weather: {
            status: 'unavailable',
            temperatureMinC: null,
            temperatureMaxC: null,
            apparentTemperatureMinC: null,
            apparentTemperatureMaxC: null,
            precipitationProbabilityMax: null,
            precipitationMm: null,
            windSpeedMaxKmh: null,
            windGustMaxKmh: null,
            weatherCodes: [],
            warnings: [],
            coverage: null,
            confidence: 'unknown',
            provider: 'open_meteo',
            forecastGeneratedAtIso: null,
            intervalStartIso: null,
            intervalEndIso: null,
          },
        });
      }
    });
  }

  let trafficRankingEnabled = false;
  if (deps.features.motorTrafficEnrichment && deps.traffic) {
    attribution.push('Traffic data © TomTom');
    const limitedRoutes = routes.slice(0, POC_SCORING_CONFIG.traffic.maxRoutes);
    let callsRemaining = POC_SCORING_CONFIG.traffic.maxCallsPerGeneration;
    const globalDedupe: PocCoordinate[] = [];

    for (const route of limitedRoutes) {
      if (callsRemaining <= 0) {
        warnings.push('Traffic sample budget reached; remaining routes lack traffic enrichment.');
        break;
      }
      const desired = Math.min(
        POC_SCORING_CONFIG.traffic.maxSamplesPerRoute,
        callsRemaining,
      );
      const candidates = dedupeNearby(
        samplePointsAlongRoute(route.geometry, desired + 2),
        POC_SCORING_CONFIG.traffic.dedupeRadiusMeters,
      ).filter((point) => {
        if (
          globalDedupe.some(
            (existing) =>
              haversineMeters(existing, point) < POC_SCORING_CONFIG.traffic.dedupeRadiusMeters,
          )
        ) {
          return false;
        }
        globalDedupe.push(point);
        return true;
      });
      const points = candidates.slice(0, desired);
      const samples: TrafficSample[] = await mapPool(
        points,
        POC_SCORING_CONFIG.traffic.concurrency,
        async (coordinate) => {
          callsRemaining -= 1;
          try {
            return await deps.traffic!.sample({ coordinate, signal: deps.signal });
          } catch {
            return {
              status: 'error',
              currentSpeedKmh: null,
              freeFlowSpeedKmh: null,
              currentFreeFlowRatio: null,
              functionalRoadClass: null,
              confidence: null,
              roadClosure: null,
              observedAtIso: null,
            };
          }
        },
      );
      const traffic = summarizeTrafficSamples(samples);
      const current = byRouteId.get(route.id)!;
      byRouteId.set(route.id, { ...current, traffic });
    }

    const comparable = [...byRouteId.values()].filter(
      (item) =>
        item.traffic &&
        (item.traffic.coverage ?? 0) >= POC_SCORING_CONFIG.traffic.minComparableCoverage,
    ).length;
    trafficRankingEnabled =
      deps.features.motorTrafficScoring &&
      comparable >= POC_SCORING_CONFIG.traffic.minComparableRoutes;
    if (deps.features.motorTrafficScoring && !trafficRankingEnabled) {
      warnings.push(
        'Insufficient comparable traffic coverage; motor-traffic ranking disabled for this result set.',
      );
    }
  }

  return { byRouteId, warnings, attribution, trafficRankingEnabled };
}
