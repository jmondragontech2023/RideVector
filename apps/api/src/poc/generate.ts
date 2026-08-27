import { buildAnchorPatterns, geometryMidpoint } from './anchors';
import { POC_CONFIG } from './config';
import {
  buildCandidateDiagnostic,
  buildDiagnosticSummary,
  sanitizeDiagnosticsForResponse,
} from './diagnostics';
import { isNearDuplicateMidpoint } from './diversity';
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

function withinTolerance(distanceMeters: number, targetMeters: number): boolean {
  const delta = Math.abs(distanceMeters - targetMeters);
  return delta <= targetMeters * POC_CONFIG.toleranceFraction;
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

  const initialCount = deps.candidateCount ?? POC_CONFIG.initialCandidateCount;
  let attemptCount = Math.min(initialCount, POC_CONFIG.maxCandidateCount);

  const accepted: Array<{
    id: string;
    geometry: PocAlternative['geometry'];
    distanceMeters: number;
    durationSeconds: number;
    distanceFromTargetMeters: number;
    bearingFamily: string;
    warnings: string[];
    midpoint: ReturnType<typeof geometryMidpoint>;
  }> = [];

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
          }),
        );
        continue;
      }

      const distanceFromTargetMeters = result.distanceMeters - request.targetDistanceMeters;

      if (!withinTolerance(result.distanceMeters, request.targetDistanceMeters)) {
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
          }),
        );
        continue;
      }

      const midpoint = geometryMidpoint(result.geometry.coordinates);
      const isDuplicate = isNearDuplicateMidpoint(
        midpoint,
        accepted.map((item) => item.midpoint),
        request.targetDistanceMeters,
      );

      if (isDuplicate) {
        rejections.duplicate_candidate += 1;
        candidateDiagnostics.push(
          buildCandidateDiagnostic({
            attemptNumber,
            bearingFamily,
            outcome: 'rejected',
            rejectionReason: 'duplicate_candidate',
            distanceMeters: result.distanceMeters,
            durationSeconds: result.durationSeconds,
            distanceFromTargetMeters,
            geometry: result.geometry,
            targetDistanceMeters: request.targetDistanceMeters,
          }),
        );
        continue;
      }

      if (accepted.length >= POC_CONFIG.maxAlternatives) {
        candidateDiagnostics.push(
          buildCandidateDiagnostic({
            attemptNumber,
            bearingFamily,
            outcome: 'rejected',
            distanceMeters: result.distanceMeters,
            durationSeconds: result.durationSeconds,
            distanceFromTargetMeters,
            geometry: result.geometry,
            targetDistanceMeters: request.targetDistanceMeters,
          }),
        );
        continue;
      }

      const routeName = alternativeName(accepted.length);
      accepted.push({
        geometry: result.geometry,
        distanceMeters: result.distanceMeters,
        durationSeconds: result.durationSeconds,
        distanceFromTargetMeters,
        bearingFamily,
        warnings: [],
        midpoint,
        id: `poc-${seed}-${accepted.length}-${bearingFamily}`,
      });

      candidateDiagnostics.push(
        buildCandidateDiagnostic({
          attemptNumber,
          bearingFamily,
          outcome: 'accepted',
          distanceMeters: result.distanceMeters,
          durationSeconds: result.durationSeconds,
          distanceFromTargetMeters,
          geometry: result.geometry,
          targetDistanceMeters: request.targetDistanceMeters,
          acceptedRouteName: routeName,
        }),
      );
    }
  };

  await runBatch(0, attemptCount);

  if (
    accepted.length < 2 &&
    attemptCount < POC_CONFIG.maxCandidateCount &&
    deps.candidateCount === undefined
  ) {
    const expanded = POC_CONFIG.maxCandidateCount;
    await runBatch(attemptCount, expanded);
    attemptCount = expanded;
  }

  const alternatives: PocAlternative[] = accepted
    .slice(0, POC_CONFIG.maxAlternatives)
    .map((item, index) => {
      return {
        id: item.id,
        name: alternativeName(index),
        geometry: item.geometry,
        distanceMeters: item.distanceMeters,
        durationSeconds: item.durationSeconds,
        distanceFromTargetMeters: item.distanceFromTargetMeters,
        bearingFamily: item.bearingFamily,
        warnings: item.warnings,
      };
    });

  if (alternatives.length === 0) {
    warnings.push('No valid loop candidates remained after filtering.');
  } else if (alternatives.length < POC_CONFIG.maxAlternatives) {
    warnings.push(
      `Only ${alternatives.length} distinct alternative(s) satisfied tolerance and diversity checks.`,
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
      diagnostics: boundedDiagnostics,
      rejections,
      attemptedCount: attemptCount,
      acceptedCount: alternatives.length,
    }),
  };
}
