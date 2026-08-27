import { haversineMeters } from './anchors';
import type { ElevationProvider, ElevationSummary } from './elevation/provider';
import { POC_SCORING_CONFIG } from './scoring/config';
import {
  summarizeTrafficSamples,
  type TrafficProvider,
  type TrafficRouteSummary,
  type TrafficSample,
} from './traffic/provider';
import type {
  PocCoordinate,
  PocExperimentalFeatures,
  PocLineString,
  PocTrafficDiagnostics,
  PocTrafficPreference,
} from './types';
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
  trafficDiagnostics: PocTrafficDiagnostics;
};

export type EnrichmentDeps = {
  features: PocExperimentalFeatures;
  elevation?: ElevationProvider | null;
  weather?: WeatherProvider | null;
  traffic?: TrafficProvider | null;
  /** Whether TOMTOM_API_KEY was present (never the key itself). */
  trafficApiKeyConfigured?: boolean;
  trafficPreference?: PocTrafficPreference;
  departureInstant: Date;
  signal?: AbortSignal;
};

function emptyCallOutcomes(): PocTrafficDiagnostics['callOutcomes'] {
  return { ok: 0, timeout: 0, error: 0, unavailable: 0 };
}

export function buildTrafficDiagnostics(input: {
  features: PocExperimentalFeatures;
  apiKeyConfigured: boolean;
  providerPresent: boolean;
  preference: PocTrafficPreference;
  callsAttempted: number;
  callOutcomes: PocTrafficDiagnostics['callOutcomes'];
  httpStatusCounts: Record<string, number>;
  routesConsidered: number;
  routesEnriched: number;
  routesWithComparableCoverage: number;
  rankingEnabled: boolean;
}): PocTrafficDiagnostics {
  const enrichmentRequested = input.features.motorTrafficEnrichment;
  const scoringRequested = input.features.motorTrafficScoring;
  let rankingDisabledReason: PocTrafficDiagnostics['rankingDisabledReason'] = null;

  if (!enrichmentRequested) {
    rankingDisabledReason = 'enrichment_disabled';
  } else if (!input.apiKeyConfigured) {
    rankingDisabledReason = 'api_key_missing';
  } else if (!input.providerPresent) {
    rankingDisabledReason = 'no_provider';
  } else if (input.callsAttempted === 0) {
    rankingDisabledReason = 'no_calls_attempted';
  } else if (!scoringRequested) {
    rankingDisabledReason = 'scoring_disabled';
  } else if (input.preference === 'none') {
    rankingDisabledReason = 'preference_none';
  } else if (!input.rankingEnabled) {
    rankingDisabledReason = 'insufficient_comparable_coverage';
  }

  return {
    enrichmentRequested,
    scoringRequested,
    apiKeyConfigured: input.apiKeyConfigured,
    providerInvoked: input.providerPresent && enrichmentRequested && input.callsAttempted > 0,
    callsAttempted: input.callsAttempted,
    callOutcomes: input.callOutcomes,
    httpStatusCounts: input.httpStatusCounts,
    routesConsidered: input.routesConsidered,
    routesEnriched: input.routesEnriched,
    routesWithComparableCoverage: input.routesWithComparableCoverage,
    minComparableCoverage: POC_SCORING_CONFIG.traffic.minComparableCoverage,
    minComparableRoutes: POC_SCORING_CONFIG.traffic.minComparableRoutes,
    rankingEnabled: input.rankingEnabled,
    rankingDisabledReason: input.rankingEnabled ? null : rankingDisabledReason,
  };
}

export function describeHttpStatusCounts(counts: Record<string, number>): string {
  const entries = Object.entries(counts).sort(([left], [right]) => Number(left) - Number(right));
  if (entries.length === 0) {
    return 'none';
  }
  return entries.map(([status, count]) => `${status}×${count}`).join(', ');
}

export function tomtomAuthFailureHint(counts: Record<string, number>): string | null {
  const unauthorized = (counts['401'] ?? 0) + (counts['403'] ?? 0);
  if (unauthorized === 0) {
    return null;
  }
  return (
    `TomTom rejected authentication on ${unauthorized} call(s) (HTTP 401/403). ` +
    `Confirm TOMTOM_API_KEY in apps/api/.dev.vars is a valid developer key with Traffic API access, then restart the Worker.`
  );
}

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

function samplePointsAlongRoute(geometry: PocLineString, count: number): PocCoordinate[] {
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

function dedupeNearby(points: PocCoordinate[], radiusMeters: number): PocCoordinate[] {
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
      const farthest = farthestPointFromStart(
        route.start,
        route.geometry.coordinates,
        haversineMeters,
      );
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
  const callOutcomes = emptyCallOutcomes();
  const httpStatusCounts: Record<string, number> = {};
  let callsAttempted = 0;
  let routesEnriched = 0;
  const apiKeyConfigured = deps.trafficApiKeyConfigured === true;
  const preference = deps.trafficPreference ?? 'none';

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
      const desired = Math.min(POC_SCORING_CONFIG.traffic.maxSamplesPerRoute, callsRemaining);
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
      if (points.length === 0) {
        continue;
      }
      const samples: TrafficSample[] = await mapPool(
        points,
        POC_SCORING_CONFIG.traffic.concurrency,
        async (coordinate) => {
          callsRemaining -= 1;
          callsAttempted += 1;
          try {
            const sample = await deps.traffic!.sample({ coordinate, signal: deps.signal });
            callOutcomes[sample.status] += 1;
            if (typeof sample.httpStatus === 'number') {
              const key = String(sample.httpStatus);
              httpStatusCounts[key] = (httpStatusCounts[key] ?? 0) + 1;
            }
            return sample;
          } catch {
            callOutcomes.error += 1;
            return {
              status: 'error',
              httpStatus: null,
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
      routesEnriched += 1;
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
      preference !== 'none' &&
      comparable >= POC_SCORING_CONFIG.traffic.minComparableRoutes;

    const authHint = tomtomAuthFailureHint(httpStatusCounts);
    if (authHint) {
      warnings.push(authHint);
    }

    if (deps.features.motorTrafficScoring && preference !== 'none' && !trafficRankingEnabled) {
      warnings.push(
        `Insufficient comparable traffic coverage; motor-traffic ranking disabled for this result set. ` +
          `TomTom calls attempted: ${callsAttempted} ` +
          `(ok ${callOutcomes.ok}, timeout ${callOutcomes.timeout}, error ${callOutcomes.error}, unavailable ${callOutcomes.unavailable}). ` +
          `HTTP statuses: ${describeHttpStatusCounts(httpStatusCounts)}. ` +
          `Routes with ≥${Math.round(POC_SCORING_CONFIG.traffic.minComparableCoverage * 100)}% coverage: ${comparable}/${limitedRoutes.length} ` +
          `(need ≥${POC_SCORING_CONFIG.traffic.minComparableRoutes}).`,
      );
    }

    return {
      byRouteId,
      warnings,
      attribution,
      trafficRankingEnabled,
      trafficDiagnostics: buildTrafficDiagnostics({
        features: deps.features,
        apiKeyConfigured,
        providerPresent: true,
        preference,
        callsAttempted,
        callOutcomes,
        httpStatusCounts,
        routesConsidered: limitedRoutes.length,
        routesEnriched,
        routesWithComparableCoverage: comparable,
        rankingEnabled: trafficRankingEnabled,
      }),
    };
  }

  if (deps.features.motorTrafficEnrichment && !deps.traffic) {
    warnings.push(
      apiKeyConfigured
        ? 'Motor-traffic enrichment enabled but traffic provider was not attached.'
        : 'Motor-traffic enrichment enabled but TOMTOM_API_KEY is not configured; no TomTom calls were made.',
    );
  }

  return {
    byRouteId,
    warnings,
    attribution,
    trafficRankingEnabled,
    trafficDiagnostics: buildTrafficDiagnostics({
      features: deps.features,
      apiKeyConfigured,
      providerPresent: Boolean(deps.traffic),
      preference,
      callsAttempted: 0,
      callOutcomes,
      httpStatusCounts,
      routesConsidered: 0,
      routesEnriched: 0,
      routesWithComparableCoverage: 0,
      rankingEnabled: false,
    }),
  };
}
