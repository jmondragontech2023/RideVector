import { buildAnchorPatterns, geometryMidpoint } from './anchors';
import { POC_CONFIG } from './config';
import { isNearDuplicateMidpoint } from './diversity';
import type { RoutingProvider } from './routing/provider';
import type {
  PocAlternative,
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

type CandidateOk = {
  status: 'ok';
  alternative: Omit<PocAlternative, 'name' | 'id'> & { midpoint: ReturnType<typeof geometryMidpoint> };
};

type CandidateReject = {
  status: 'reject';
  reason: PocRejectionReason;
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

  const initialCount = deps.candidateCount ?? POC_CONFIG.initialCandidateCount;
  let attemptCount = Math.min(initialCount, POC_CONFIG.maxCandidateCount);

  const accepted: Array<CandidateOk['alternative'] & { id: string }> = [];

  const runBatch = async (from: number, to: number): Promise<void> => {
    const patterns = buildAnchorPatterns(
      request.start,
      request.targetDistanceMeters,
      seed,
      to,
    ).slice(from, to);

    const outcomes = await mapPool(patterns, POC_CONFIG.concurrency, async (pattern) => {
      const result = await deps.provider.routeLoop({
        start: request.start,
        waypoints: pattern.waypoints,
        costing: request.costing,
      });

      if (!result.ok) {
        return {
          status: 'reject',
          reason: result.reason,
        } satisfies CandidateReject;
      }

      if (result.geometry.coordinates.length < 2) {
        return { status: 'reject', reason: 'malformed_geometry' } satisfies CandidateReject;
      }

      if (!withinTolerance(result.distanceMeters, request.targetDistanceMeters)) {
        return { status: 'reject', reason: 'outside_tolerance' } satisfies CandidateReject;
      }

      const midpoint = geometryMidpoint(result.geometry.coordinates);
      return {
        status: 'ok',
        alternative: {
          geometry: result.geometry,
          distanceMeters: result.distanceMeters,
          durationSeconds: result.durationSeconds,
          distanceFromTargetMeters: result.distanceMeters - request.targetDistanceMeters,
          bearingFamily: pattern.bearingFamily,
          warnings: [],
          midpoint,
        },
      } satisfies CandidateOk;
    });

    for (const outcome of outcomes) {
      if (outcome.status === 'reject') {
        rejections[outcome.reason] += 1;
        continue;
      }

      const isDuplicate = isNearDuplicateMidpoint(
        outcome.alternative.midpoint,
        accepted.map((item) => item.midpoint),
        request.targetDistanceMeters,
      );
      if (isDuplicate) {
        rejections.duplicate_candidate += 1;
        continue;
      }

      accepted.push({
        ...outcome.alternative,
        id: `poc-${seed}-${accepted.length}-${outcome.alternative.bearingFamily}`,
      });

      if (accepted.length >= POC_CONFIG.maxAlternatives) {
        break;
      }
    }
  };

  await runBatch(0, attemptCount);

  if (accepted.length < 2 && attemptCount < POC_CONFIG.maxCandidateCount && deps.candidateCount === undefined) {
    const expanded = POC_CONFIG.maxCandidateCount;
    await runBatch(attemptCount, expanded);
    attemptCount = expanded;
  }

  const alternatives: PocAlternative[] = accepted.slice(0, POC_CONFIG.maxAlternatives).map((item, index) => {
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

  return {
    seed,
    durationMs,
    attemptedCount: attemptCount,
    acceptedCount: alternatives.length,
    alternatives,
    rejections,
    warnings,
  };
}
