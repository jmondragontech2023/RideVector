import { buildAnchorPatterns } from './anchors';
import { POC_CONFIG } from './config';
import { geometryMeetsRequestedEndpoints } from './coordinates';
import {
  acceptedRangeMeters,
  buildNearMatchWarning,
  classifyRouteDistance,
  targetDifferencePercent,
} from './distance-range';
import {
  buildCandidateDiagnostic,
  buildDiagnosticSummary,
  sanitizeDiagnosticsForResponse,
} from './diagnostics';
import { enrichSelectedRoutes, type EnrichmentDeps } from './enrichment';
import type { ElevationProvider } from './elevation/provider';
import {
  geometryMidpointForCandidate,
  selectPointToPointAlternatives,
  selectRouteAlternatives,
  type RoutableCandidate,
} from './selection';
import { assignCategoryBadges } from './scoring/categories';
import { combineComponentScores } from './scoring/combine';
import { SCORING_CONFIG_VERSION } from './scoring/config';
import { scoreDistanceFit } from './scoring/distance-fit';
import { analyzeLoopQuality, scoreGeometryQuality } from './scoring/geometry-quality';
import { computeDiversityBreakdown } from './scoring/overlap';
import {
  scoreElevationPreference,
  scoreTrafficPreference,
  scoreWeatherSuitability,
} from './scoring/preferences';
import { trafficExposureLabelText } from './traffic/provider';
import type { RoutingProvider } from './routing/provider';
import type { TrafficProvider } from './traffic/provider';
import { buildPointToPointPatterns, estimateBaselineDistanceMeters } from './point-to-point';
import type {
  PocAlternative,
  PocCandidateDiagnostic,
  PocCoordinate,
  PocGenerateResponse,
  PocRejectionReason,
  PocRouteScoring,
} from './types';
import { emptyRejectionCounts } from './types';
import { isPointToPointRequest, type ValidatedPocGenerateRequest } from './validate';
import type { WeatherProvider } from './weather/provider';

export type GenerateDeps = {
  provider: RoutingProvider;
  now?: () => number;
  /** Override candidate attempt count (tests). Defaults to initial then expands. */
  candidateCount?: number;
  elevationProvider?: ElevationProvider | null;
  weatherProvider?: WeatherProvider | null;
  trafficProvider?: TrafficProvider | null;
  /** Safe flag only — never pass the key itself. */
  trafficApiKeyConfigured?: boolean;
};

function emptyRejections(): Record<PocRejectionReason, number> {
  return emptyRejectionCounts();
}

function alternativeName(index: number): string {
  return `Route ${String.fromCharCode(65 + index)}`;
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function runWorker(): Promise<void> {
    while (nextIndex < items.length) {
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await worker(items[current]!, current);
    }
  }

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker());
  await Promise.all(runners);
  return results;
}

type RoutedCandidate = {
  attemptNumber: number;
  bearingFamily: string;
  result: Awaited<ReturnType<RoutingProvider['routeLoop']>>;
};

function buildFitSummary(scoring: Omit<PocRouteScoring, 'fitSummary'>, extras: string[]): string {
  const scorePart =
    scoring.overallScore === null ? 'POC fit unavailable' : `POC fit ${scoring.overallScore}/100`;
  const parts = [...scoring.explanations, ...extras].filter(Boolean);
  if (parts.length === 0) {
    return scorePart;
  }
  return `${scorePart} — ${parts.join(', ')}.`;
}

function toBaseAlternative(
  candidate: RoutableCandidate,
  index: number,
  seed: number,
  targetDistanceMeters: number,
  distanceFlexibilityMeters: number,
): Omit<
  PocAlternative,
  'categories' | 'scoring' | 'diversity' | 'elevation' | 'weather' | 'traffic'
> {
  const requestedRangeMeters = acceptedRangeMeters(targetDistanceMeters, distanceFlexibilityMeters);
  const warnings =
    candidate.classification === 'near_match'
      ? [
          buildNearMatchWarning(
            candidate.distanceMeters,
            targetDistanceMeters,
            distanceFlexibilityMeters,
          ),
        ]
      : [];

  return {
    id: `poc-${seed}-${index}-${candidate.bearingFamily}`,
    name: alternativeName(index),
    geometry: candidate.geometry,
    distanceMeters: candidate.distanceMeters,
    durationSeconds: candidate.durationSeconds,
    distanceFromTargetMeters: candidate.distanceFromTargetMeters,
    bearingFamily: candidate.bearingFamily,
    warnings,
    distanceClassification:
      candidate.classification === 'near_match' ? 'near_match' : 'within_range',
    requestedRangeMeters,
    ...(candidate.classification === 'near_match'
      ? {
          rangeDeviationMeters:
            candidate.distanceMeters < requestedRangeMeters.min
              ? candidate.distanceMeters - requestedRangeMeters.min
              : candidate.distanceMeters - requestedRangeMeters.max,
          targetDifferencePercent: targetDifferencePercent(
            candidate.distanceMeters,
            targetDistanceMeters,
          ),
        }
      : {}),
  };
}

function rankAlternatives(alternatives: PocAlternative[]): PocAlternative[] {
  return [...alternatives].sort((left, right) => {
    const classRank = (item: PocAlternative): number =>
      item.distanceClassification === 'within_range' ? 0 : 1;
    const byClass = classRank(left) - classRank(right);
    if (byClass !== 0) {
      return byClass;
    }
    const leftScore = left.scoring.overallScore ?? -1;
    const rightScore = right.scoring.overallScore ?? -1;
    if (rightScore !== leftScore) {
      return rightScore - leftScore;
    }
    const byDistance =
      Math.abs(left.distanceFromTargetMeters) - Math.abs(right.distanceFromTargetMeters);
    if (byDistance !== 0) {
      return byDistance;
    }
    return left.id.localeCompare(right.id);
  });
}

type AttemptContext = {
  request: ValidatedPocGenerateRequest;
  rejections: Record<PocRejectionReason, number>;
  candidateDiagnostics: PocCandidateDiagnostic[];
  routableCandidates: RoutableCandidate[];
};

function recordRoutedAttempt(
  context: AttemptContext,
  attempt: RoutedCandidate,
  endpoints?: { start: PocCoordinate; end: PocCoordinate },
): void {
  const { request, rejections, candidateDiagnostics, routableCandidates } = context;
  const { attemptNumber, bearingFamily, result } = attempt;
  const routeMode = request.routeMode;

  if (!result.ok) {
    rejections[result.reason] += 1;
    candidateDiagnostics.push(
      buildCandidateDiagnostic({
        attemptNumber,
        bearingFamily,
        outcome: 'rejected',
        rejectionReason: result.reason,
        targetDistanceMeters: request.targetDistanceMeters,
        distanceFlexibilityMeters: request.distanceFlexibilityMeters,
        routeMode,
      }),
    );
    return;
  }

  if (result.geometry.coordinates.length < 2) {
    rejections.malformed_geometry += 1;
    candidateDiagnostics.push(
      buildCandidateDiagnostic({
        attemptNumber,
        bearingFamily,
        outcome: 'rejected',
        rejectionReason: 'malformed_geometry',
        targetDistanceMeters: request.targetDistanceMeters,
        distanceFlexibilityMeters: request.distanceFlexibilityMeters,
        routeMode,
      }),
    );
    return;
  }

  if (
    endpoints &&
    !geometryMeetsRequestedEndpoints(result.geometry, endpoints.start, endpoints.end)
  ) {
    rejections.endpoint_mismatch += 1;
    candidateDiagnostics.push(
      buildCandidateDiagnostic({
        attemptNumber,
        bearingFamily,
        outcome: 'rejected',
        rejectionReason: 'endpoint_mismatch',
        distanceMeters: result.distanceMeters,
        durationSeconds: result.durationSeconds,
        geometry: result.geometry,
        targetDistanceMeters: request.targetDistanceMeters,
        distanceFlexibilityMeters: request.distanceFlexibilityMeters,
        routeMode,
      }),
    );
    return;
  }

  const distanceFromTargetMeters = result.distanceMeters - request.targetDistanceMeters;
  const classification = classifyRouteDistance(
    result.distanceMeters,
    request.targetDistanceMeters,
    request.distanceFlexibilityMeters,
  );

  if (classification === 'outside') {
    rejections.outside_tolerance += 1;
    candidateDiagnostics.push(
      buildCandidateDiagnostic({
        attemptNumber,
        bearingFamily,
        outcome: 'rejected',
        rejectionReason: 'outside_tolerance',
        distanceMeters: result.distanceMeters,
        durationSeconds: result.durationSeconds,
        distanceFromTargetMeters,
        geometry: result.geometry,
        targetDistanceMeters: request.targetDistanceMeters,
        distanceFlexibilityMeters: request.distanceFlexibilityMeters,
        routeMode,
      }),
    );
    return;
  }

  routableCandidates.push({
    attemptNumber,
    bearingFamily,
    geometry: result.geometry,
    distanceMeters: result.distanceMeters,
    durationSeconds: result.durationSeconds,
    distanceFromTargetMeters,
    midpoint: geometryMidpointForCandidate(result.geometry),
    classification,
  });
}

/**
 * Generates up to three factual alternatives. Loop mode uses seeded circular
 * anchors; point-to-point keeps Start/End fixed and seeds interior detours.
 * Deterministic for identical normalized input and seed (given deterministic provider).
 */
export async function generatePocRoutes(
  request: ValidatedPocGenerateRequest,
  deps: GenerateDeps,
): Promise<PocGenerateResponse> {
  const started = (deps.now ?? Date.now)();
  const rejections = emptyRejections();
  const warnings: string[] = [];
  const seed = request.seed;
  const candidateDiagnostics: PocCandidateDiagnostic[] = [];
  const routableCandidates: RoutableCandidate[] = [];
  const requestedRangeMeters = acceptedRangeMeters(
    request.targetDistanceMeters,
    request.distanceFlexibilityMeters,
  );

  const initialCount = deps.candidateCount ?? POC_CONFIG.initialCandidateCount;
  let attemptCount = Math.min(initialCount, POC_CONFIG.maxCandidateCount);
  const attemptContext: AttemptContext = {
    request,
    rejections,
    candidateDiagnostics,
    routableCandidates,
  };

  const runLoopBatch = async (from: number, to: number): Promise<void> => {
    const patterns = buildAnchorPatterns(
      request.start,
      request.targetDistanceMeters,
      seed,
      to,
    ).slice(from, to);

    const routed = await mapPool(patterns, POC_CONFIG.concurrency, async (pattern, index) => {
      const result = await deps.provider.routeLoop({
        start: request.start,
        waypoints: pattern.waypoints,
        costing: request.costing,
      });
      return {
        attemptNumber: from + index + 1,
        bearingFamily: pattern.bearingFamily,
        result,
      } satisfies RoutedCandidate;
    });

    for (const attempt of routed) {
      recordRoutedAttempt(attemptContext, attempt);
    }
  };

  const runPointToPoint = async (maxAttempts: number): Promise<number> => {
    if (!isPointToPointRequest(request)) {
      return 0;
    }
    const endpoints = { start: request.start, end: request.end };
    const directResult = await deps.provider.route({
      locations: [request.start, request.end],
      costing: request.costing,
    });
    recordRoutedAttempt(
      attemptContext,
      { attemptNumber: 1, bearingFamily: 'direct', result: directResult },
      endpoints,
    );
    const baselineDistanceMeters = directResult.ok
      ? directResult.distanceMeters
      : estimateBaselineDistanceMeters(request.start, request.end);

    if (maxAttempts <= 1) {
      return 1;
    }

    const patterns = buildPointToPointPatterns(
      request.start,
      request.end,
      baselineDistanceMeters,
      request.targetDistanceMeters,
      seed,
      maxAttempts,
    ).slice(1);

    const routed = await mapPool(patterns, POC_CONFIG.concurrency, async (pattern, index) => {
      const result = await deps.provider.route({
        locations: pattern.locations,
        costing: request.costing,
      });
      return {
        attemptNumber: index + 2,
        bearingFamily: pattern.id,
        result,
      } satisfies RoutedCandidate;
    });

    for (const attempt of routed) {
      recordRoutedAttempt(attemptContext, attempt, endpoints);
    }
    return 1 + patterns.length;
  };

  if (isPointToPointRequest(request)) {
    attemptCount = await runPointToPoint(attemptCount);
    if (
      routableCandidates.filter((item) => item.classification === 'within_range').length < 2 &&
      attemptCount < POC_CONFIG.maxCandidateCount &&
      deps.candidateCount === undefined
    ) {
      const extra = buildPointToPointPatterns(
        request.start,
        request.end,
        routableCandidates[0]?.distanceMeters ??
          estimateBaselineDistanceMeters(request.start, request.end),
        request.targetDistanceMeters,
        seed,
        POC_CONFIG.maxCandidateCount,
      ).slice(attemptCount);
      const endpoints = { start: request.start, end: request.end };
      const routed = await mapPool(extra, POC_CONFIG.concurrency, async (pattern, index) => {
        const result = await deps.provider.route({
          locations: pattern.locations,
          costing: request.costing,
        });
        return {
          attemptNumber: attemptCount + index + 1,
          bearingFamily: pattern.id,
          result,
        } satisfies RoutedCandidate;
      });
      for (const attempt of routed) {
        recordRoutedAttempt(attemptContext, attempt, endpoints);
      }
      attemptCount += extra.length;
    }
  } else {
    await runLoopBatch(0, attemptCount);
    if (
      routableCandidates.filter((item) => item.classification === 'within_range').length < 2 &&
      attemptCount < POC_CONFIG.maxCandidateCount &&
      deps.candidateCount === undefined
    ) {
      const expanded = POC_CONFIG.maxCandidateCount;
      await runLoopBatch(attemptCount, expanded);
      attemptCount = expanded;
    }
  }

  const selection =
    request.routeMode === 'point_to_point'
      ? selectPointToPointAlternatives(routableCandidates, request.targetDistanceMeters)
      : selectRouteAlternatives(routableCandidates, request.targetDistanceMeters);
  const baseAlternatives = selection.selected.map((candidate, index) =>
    toBaseAlternative(
      candidate,
      index,
      seed,
      request.targetDistanceMeters,
      request.distanceFlexibilityMeters,
    ),
  );

  const enrichmentDeps: EnrichmentDeps = {
    features: request.features,
    elevation: deps.elevationProvider ?? null,
    weather: deps.weatherProvider ?? null,
    traffic: deps.trafficProvider ?? null,
    trafficApiKeyConfigured: deps.trafficApiKeyConfigured === true,
    trafficPreference: request.trafficPreference,
    departureInstant: new Date(request.departure.departureInstantIso),
  };
  const enrichment = await enrichSelectedRoutes(
    baseAlternatives.map((alt) => ({
      id: alt.id,
      geometry: alt.geometry,
      distanceMeters: alt.distanceMeters,
      durationSeconds: alt.durationSeconds,
      start: request.start,
    })),
    enrichmentDeps,
  );

  const peerGeometries = baseAlternatives.map((alt) => ({
    id: alt.id,
    geometry: alt.geometry,
  }));

  const scoredDrafts = baseAlternatives.map((base) => {
    const enrichmentForRoute = enrichment.byRouteId.get(base.id);
    const distance = scoreDistanceFit({
      distanceMeters: base.distanceMeters,
      targetDistanceMeters: request.targetDistanceMeters,
      distanceFlexibilityMeters: request.distanceFlexibilityMeters,
      classification: base.distanceClassification,
    });
    const loopMetrics = analyzeLoopQuality(base.geometry);
    const loopScore = scoreGeometryQuality(loopMetrics, request.routeMode);
    const diversity = computeDiversityBreakdown(base.id, base.geometry, peerGeometries);
    const elevationScore = scoreElevationPreference(
      request.elevationPreference,
      enrichmentForRoute?.elevation ?? null,
    );
    const weatherScore = scoreWeatherSuitability(enrichmentForRoute?.weather ?? null);
    const trafficScore = scoreTrafficPreference(
      request.trafficPreference,
      enrichmentForRoute?.traffic ?? null,
      enrichment.trafficRankingEnabled,
    );

    const combined = combineComponentScores({
      features: request.features,
      routeMode: request.routeMode,
      distanceFit: request.features.distanceFitScoring
        ? {
            score: distance.score,
            raw: {
              absoluteDifferenceMeters: distance.absoluteDifferenceMeters,
              percentDifference: distance.percentDifference,
              insideRange: distance.insideRange,
            },
          }
        : null,
      loopQuality: request.features.loopQualityScoring
        ? { score: loopScore, raw: { ...loopMetrics } }
        : null,
      diversity: request.features.routeDiversityScoring
        ? {
            score: diversity.contributionScore,
            raw: {
              meanOverlapFraction: diversity.meanOverlapFraction,
              sharedRoutePercentByPeer: diversity.sharedRoutePercentByPeer,
            },
          }
        : null,
      elevation: request.features.elevationScoring ? elevationScore : null,
      motorTraffic: request.features.motorTrafficScoring ? trafficScore : null,
      weather: request.features.weatherScoring ? weatherScore : null,
    });

    const extraExplanations: string[] = [];
    if (enrichmentForRoute?.traffic?.exposureLabel) {
      const label = trafficExposureLabelText(enrichmentForRoute.traffic.exposureLabel);
      if (label) {
        extraExplanations.push(
          `${label.toLowerCase()}${
            enrichmentForRoute.traffic.coverage !== null
              ? ` with ${Math.round(enrichmentForRoute.traffic.coverage * 100)}% coverage`
              : ''
          }`,
        );
      }
    }
    if (
      enrichmentForRoute?.weather?.precipitationProbabilityMax !== null &&
      enrichmentForRoute?.weather?.precipitationProbabilityMax !== undefined &&
      enrichmentForRoute.weather.precipitationProbabilityMax < 30
    ) {
      extraExplanations.push('low rain probability');
    }

    const scoring: PocRouteScoring = {
      ...combined,
      fitSummary: buildFitSummary(combined, extraExplanations),
    };

    return {
      base,
      scoring,
      diversity,
      enrichmentForRoute,
      loopScore,
      weatherScore: weatherScore.score,
      trafficExposure: enrichmentForRoute?.traffic?.baselineExposure ?? null,
      elevationGainPerMile: enrichmentForRoute?.elevation?.gainPerMile ?? null,
      precipProbabilityMax: enrichmentForRoute?.weather?.precipitationProbabilityMax ?? null,
      windMaxKmh: enrichmentForRoute?.weather?.windSpeedMaxKmh ?? null,
    };
  });

  const badges = assignCategoryBadges(
    scoredDrafts.map((draft) => ({
      id: draft.base.id,
      distanceMeters: draft.base.distanceMeters,
      durationSeconds: draft.base.durationSeconds,
      distanceFromTargetMeters: draft.base.distanceFromTargetMeters,
      classification: draft.base.distanceClassification,
      loopQualityScore: request.features.loopQualityScoring ? draft.loopScore : null,
      diversityScore: request.features.routeDiversityScoring
        ? draft.diversity.contributionScore
        : null,
      elevationGainPerMile: request.features.elevationEnrichment
        ? draft.elevationGainPerMile
        : null,
      weatherSuitability: request.features.weatherForecast ? draft.weatherScore : null,
      precipProbabilityMax: request.features.weatherForecast ? draft.precipProbabilityMax : null,
      windMaxKmh: request.features.weatherForecast ? draft.windMaxKmh : null,
      trafficExposure: request.features.motorTrafficEnrichment ? draft.trafficExposure : null,
      trafficComparable: enrichment.trafficRankingEnabled,
    })),
    request.routeMode,
  );

  let alternatives: PocAlternative[] = scoredDrafts.map((draft) => {
    const categories = badges.get(draft.base.id) ?? [];
    const scoring = { ...draft.scoring };
    if (
      categories.includes('most_distinct') &&
      !scoring.explanationCodes.includes('most_distinct')
    ) {
      scoring.explanations = [...scoring.explanations, 'most distinct alternative'];
      scoring.explanationCodes = [...scoring.explanationCodes, 'most_distinct'];
      scoring.fitSummary = buildFitSummary(scoring, []);
    }
    return {
      ...draft.base,
      categories,
      scoring,
      diversity: draft.diversity,
      ...(draft.enrichmentForRoute?.elevation
        ? { elevation: draft.enrichmentForRoute.elevation }
        : {}),
      ...(draft.enrichmentForRoute?.weather ? { weather: draft.enrichmentForRoute.weather } : {}),
      ...(draft.enrichmentForRoute?.traffic ? { traffic: draft.enrichmentForRoute.traffic } : {}),
    };
  });

  alternatives = rankAlternatives(alternatives);

  for (const [index, candidate] of selection.selected.entries()) {
    const matched = alternatives.find((alt) => alt.bearingFamily === candidate.bearingFamily);
    candidateDiagnostics.push(
      buildCandidateDiagnostic({
        attemptNumber: candidate.attemptNumber,
        bearingFamily: candidate.bearingFamily,
        outcome: 'accepted',
        distanceMeters: candidate.distanceMeters,
        durationSeconds: candidate.durationSeconds,
        distanceFromTargetMeters: candidate.distanceFromTargetMeters,
        geometry: candidate.geometry,
        targetDistanceMeters: request.targetDistanceMeters,
        distanceFlexibilityMeters: request.distanceFlexibilityMeters,
        acceptedRouteName: matched?.name ?? alternativeName(index),
        distanceClassification:
          candidate.classification === 'near_match' ? 'near_match' : 'within_range',
        routeMode: request.routeMode,
      }),
    );
  }

  for (const candidate of selection.duplicates) {
    rejections.duplicate_candidate += 1;
    candidateDiagnostics.push(
      buildCandidateDiagnostic({
        attemptNumber: candidate.attemptNumber,
        bearingFamily: candidate.bearingFamily,
        outcome: 'rejected',
        rejectionReason: 'duplicate_candidate',
        distanceMeters: candidate.distanceMeters,
        durationSeconds: candidate.durationSeconds,
        distanceFromTargetMeters: candidate.distanceFromTargetMeters,
        geometry: candidate.geometry,
        targetDistanceMeters: request.targetDistanceMeters,
        distanceFlexibilityMeters: request.distanceFlexibilityMeters,
        routeMode: request.routeMode,
      }),
    );
  }

  for (const candidate of selection.notSelected) {
    rejections.selection_limit += 1;
    candidateDiagnostics.push(
      buildCandidateDiagnostic({
        attemptNumber: candidate.attemptNumber,
        bearingFamily: candidate.bearingFamily,
        outcome: 'rejected',
        rejectionReason: 'selection_limit',
        distanceMeters: candidate.distanceMeters,
        durationSeconds: candidate.durationSeconds,
        distanceFromTargetMeters: candidate.distanceFromTargetMeters,
        geometry: candidate.geometry,
        targetDistanceMeters: request.targetDistanceMeters,
        distanceFlexibilityMeters: request.distanceFlexibilityMeters,
        routeMode: request.routeMode,
      }),
    );
  }

  candidateDiagnostics.sort((left, right) => left.attemptNumber - right.attemptNumber);

  const withinRangeCount = alternatives.filter(
    (item) => item.distanceClassification === 'within_range',
  ).length;
  const nearMatchCount = alternatives.filter(
    (item) => item.distanceClassification === 'near_match',
  ).length;

  if (alternatives.length === 0) {
    warnings.push(
      request.routeMode === 'point_to_point'
        ? 'No valid start-to-end routes remained after filtering.'
        : 'No valid loop candidates remained after filtering.',
    );
  } else if (withinRangeCount === 0 && nearMatchCount > 0) {
    warnings.push(
      nearMatchCount === 1
        ? 'No routes met your exact range. Showing the closest near match.'
        : 'No routes met your exact range. Showing the two closest near matches.',
    );
  } else if (alternatives.length < POC_CONFIG.maxAlternatives && nearMatchCount === 0) {
    warnings.push(
      `Only ${alternatives.length} distinct alternative(s) satisfied range and diversity checks.`,
    );
  }

  const durationMs = Math.max(0, (deps.now ?? Date.now)() - started);
  const boundedDiagnostics = sanitizeDiagnosticsForResponse(candidateDiagnostics);
  const attribution = ['Map data © OpenStreetMap contributors', ...enrichment.attribution];

  return {
    seed,
    durationMs,
    attemptedCount: attemptCount,
    acceptedCount: alternatives.length,
    routeMode: request.routeMode,
    start: request.start,
    ...(request.end ? { end: request.end } : {}),
    alternatives,
    rejections,
    warnings,
    candidateDiagnostics: boundedDiagnostics,
    diagnosticSummary: buildDiagnosticSummary({
      targetDistanceMeters: request.targetDistanceMeters,
      distanceFlexibilityMeters: request.distanceFlexibilityMeters,
      diagnostics: boundedDiagnostics,
      rejections,
      attemptedCount: attemptCount,
      acceptedCount: alternatives.length,
    }),
    distanceFlexibilityMeters: request.distanceFlexibilityMeters,
    requestedRangeMeters,
    features: request.features,
    elevationPreference: request.elevationPreference,
    trafficPreference: request.trafficPreference,
    departure: request.departure,
    scoringVersion: SCORING_CONFIG_VERSION,
    enrichmentWarnings: enrichment.warnings,
    attribution,
    trafficDiagnostics: enrichment.trafficDiagnostics,
  };
}
