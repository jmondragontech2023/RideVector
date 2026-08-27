import { buildAnchorPatterns } from './anchors';
import { POC_CONFIG } from './config';
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
import {
  geometryMidpointForCandidate,
  selectRouteAlternatives,
  type RoutableCandidate,
} from './selection';
import type { RoutingProvider } from './routing/provider';
import type {
  PocAlternative,
  PocCandidateDiagnostic,
  PocGenerateRequest,
  PocGenerateResponse,
  PocRejectionReason,
} from './types';

export type GenerateDeps = {
  provider: RoutingProvider;
  now?: () => number;
  /** Override candidate attempt count (tests). Defaults to initial then expands. */
  candidateCount?: number;
};

function emptyRejections(): Record<PocRejectionReason, number> {
  return {
    upstream_failure: 0,
    malformed_geometry: 0,
    outside_tolerance: 0,
    duplicate_candidate: 0,
  };
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

function toAlternative(
  candidate: RoutableCandidate,
  index: number,
  seed: number,
  targetDistanceMeters: number,
  distanceFlexibilityMeters: number,
): PocAlternative {
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

/**
 * Generates up to three factual loop alternatives via seeded anchors.
 * Deterministic for identical normalized input and seed (given deterministic provider).
 */
export async function generatePocRoutes(
  request: Required<PocGenerateRequest>,
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

  const runBatch = async (from: number, to: number): Promise<void> => {
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
      const { attemptNumber, bearingFamily, result } = attempt;

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
          }),
        );
        continue;
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
          }),
        );
        continue;
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
          }),
        );
        continue;
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
  };

  await runBatch(0, attemptCount);

  if (
    routableCandidates.filter((item) => item.classification === 'within_range').length < 2 &&
    attemptCount < POC_CONFIG.maxCandidateCount &&
    deps.candidateCount === undefined
  ) {
    const expanded = POC_CONFIG.maxCandidateCount;
    await runBatch(attemptCount, expanded);
    attemptCount = expanded;
  }

  const selection = selectRouteAlternatives(routableCandidates, request.targetDistanceMeters);
  const alternatives = selection.selected.map((candidate, index) =>
    toAlternative(
      candidate,
      index,
      seed,
      request.targetDistanceMeters,
      request.distanceFlexibilityMeters,
    ),
  );

  for (const [index, candidate] of selection.selected.entries()) {
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
        acceptedRouteName: alternativeName(index),
        distanceClassification:
          candidate.classification === 'near_match' ? 'near_match' : 'within_range',
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
      }),
    );
  }

  for (const candidate of selection.notSelected) {
    candidateDiagnostics.push(
      buildCandidateDiagnostic({
        attemptNumber: candidate.attemptNumber,
        bearingFamily: candidate.bearingFamily,
        outcome: 'rejected',
        distanceMeters: candidate.distanceMeters,
        durationSeconds: candidate.durationSeconds,
        distanceFromTargetMeters: candidate.distanceFromTargetMeters,
        geometry: candidate.geometry,
        targetDistanceMeters: request.targetDistanceMeters,
        distanceFlexibilityMeters: request.distanceFlexibilityMeters,
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
    warnings.push('No valid loop candidates remained after filtering.');
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

  return {
    seed,
    durationMs,
    attemptedCount: attemptCount,
    acceptedCount: alternatives.length,
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
  };
}
