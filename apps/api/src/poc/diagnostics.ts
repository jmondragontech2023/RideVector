import { METERS_PER_MILE, POC_CONFIG } from './config';
import type {
  PocCandidateDiagnostic,
  PocCandidateOutcome,
  PocDiagnosticSummary,
  PocLineString,
  PocRejectionReason,
} from './types';

export type BuildDiagnosticInput = {
  attemptNumber: number;
  bearingFamily: string;
  outcome: PocCandidateOutcome;
  rejectionReason?: PocRejectionReason;
  distanceMeters?: number;
  durationSeconds?: number;
  distanceFromTargetMeters?: number;
  geometry?: PocLineString;
  targetDistanceMeters: number;
  acceptedRouteName?: string;
};

function toleranceBounds(targetMeters: number): { min: number; max: number } {
  const delta = targetMeters * POC_CONFIG.toleranceFraction;
  return {
    min: targetMeters - delta,
    max: targetMeters + delta,
  };
}

function formatDistanceMiles(meters: number, digits = 1): string {
  return `${(meters / METERS_PER_MILE).toFixed(digits)}`;
}

function buildExplanation(input: BuildDiagnosticInput): string {
  const miles =
    input.distanceMeters !== undefined ? formatDistanceMiles(input.distanceMeters) : null;
  const targetMiles = formatDistanceMiles(input.targetDistanceMeters);
  const bandLow = formatDistanceMiles(toleranceBounds(input.targetDistanceMeters).min, 1);
  const bandHigh = formatDistanceMiles(toleranceBounds(input.targetDistanceMeters).max, 1);

  if (input.outcome === 'accepted') {
    return input.acceptedRouteName
      ? `Accepted as ${input.acceptedRouteName} within the ${bandLow}–${bandHigh} mile band.`
      : `Met distance tolerance and diversity checks within the ${bandLow}–${bandHigh} mile band.`;
  }

  switch (input.rejectionReason) {
    case 'upstream_failure':
      return 'The routing service did not return a usable route for this bearing family.';
    case 'malformed_geometry':
      return 'The routing service returned geometry that could not be displayed.';
    case 'outside_tolerance':
      return miles
        ? `Routed ${miles} mi, outside the ${bandLow}–${bandHigh} mile band around the ${targetMiles} mi target.`
        : `Route distance was outside the ${bandLow}–${bandHigh} mile band around the ${targetMiles} mi target.`;
    case 'duplicate_candidate':
      return miles
        ? `Routed ${miles} mi within tolerance, but the loop shape was too similar to an already accepted candidate.`
        : 'Loop shape was too similar to an already accepted candidate.';
    default:
      return input.geometry
        ? 'Routable loop was not returned as an alternative.'
        : 'This candidate was not returned as an alternative.';
  }
}

export function buildCandidateDiagnostic(input: BuildDiagnosticInput): PocCandidateDiagnostic {
  const includeGeometry =
    input.geometry !== undefined &&
    input.geometry.coordinates.length >= 2 &&
    (input.outcome === 'accepted' ||
      input.rejectionReason === 'outside_tolerance' ||
      input.rejectionReason === 'duplicate_candidate');

  return {
    attemptNumber: input.attemptNumber,
    bearingFamily: input.bearingFamily,
    outcome: input.outcome,
    ...(input.rejectionReason ? { rejectionReason: input.rejectionReason } : {}),
    ...(input.distanceMeters !== undefined ? { distanceMeters: input.distanceMeters } : {}),
    ...(input.durationSeconds !== undefined ? { durationSeconds: input.durationSeconds } : {}),
    ...(input.distanceFromTargetMeters !== undefined
      ? { distanceFromTargetMeters: input.distanceFromTargetMeters }
      : {}),
    ...(includeGeometry ? { geometry: input.geometry } : {}),
    explanation: buildExplanation(input),
  };
}

type SummaryInput = {
  targetDistanceMeters: number;
  diagnostics: readonly PocCandidateDiagnostic[];
  rejections: Record<PocRejectionReason, number>;
  attemptedCount: number;
  acceptedCount: number;
};

function closestRoutableRejected(
  diagnostics: readonly PocCandidateDiagnostic[],
  targetDistanceMeters: number,
): PocDiagnosticSummary['closestRoutableRejected'] {
  const routableRejected = diagnostics.filter(
    (item) =>
      item.outcome === 'rejected' &&
      item.geometry !== undefined &&
      item.distanceMeters !== undefined &&
      (item.rejectionReason === 'outside_tolerance' ||
        item.rejectionReason === 'duplicate_candidate'),
  );
  if (routableRejected.length === 0) {
    return undefined;
  }

  const closest = routableRejected.reduce((best, item) => {
    const delta = Math.abs(
      item.distanceFromTargetMeters ?? item.distanceMeters! - targetDistanceMeters,
    );
    const bestDelta = Math.abs(
      best.distanceFromTargetMeters ?? best.distanceMeters! - targetDistanceMeters,
    );
    return delta < bestDelta ? item : best;
  });

  const distanceMeters = closest.distanceMeters!;
  const { min, max } = toleranceBounds(targetDistanceMeters);
  let direction: 'below' | 'above' | 'within';
  let toleranceMissMeters = 0;

  if (distanceMeters < min) {
    direction = 'below';
    toleranceMissMeters = min - distanceMeters;
  } else if (distanceMeters > max) {
    direction = 'above';
    toleranceMissMeters = distanceMeters - max;
  } else {
    direction = 'within';
    toleranceMissMeters = Math.abs(distanceMeters - targetDistanceMeters);
  }

  return {
    attemptNumber: closest.attemptNumber,
    distanceMeters,
    distanceFromTargetMeters:
      closest.distanceFromTargetMeters ?? distanceMeters - targetDistanceMeters,
    toleranceMissMeters,
    toleranceMissPercent: (toleranceMissMeters / targetDistanceMeters) * 100,
    direction,
  };
}

export function buildDiagnosticSummary(input: SummaryInput): PocDiagnosticSummary {
  const acceptedDistances = input.diagnostics
    .filter((item) => item.outcome === 'accepted' && item.distanceMeters !== undefined)
    .map((item) => item.distanceMeters!);

  return {
    attemptedCount: input.attemptedCount,
    acceptedCount: input.acceptedCount,
    rejectionCounts: { ...input.rejections },
    ...(acceptedDistances.length > 0
      ? {
          acceptedDistanceRangeMeters: {
            min: Math.min(...acceptedDistances),
            max: Math.max(...acceptedDistances),
          },
        }
      : {}),
    closestRoutableRejected: closestRoutableRejected(input.diagnostics, input.targetDistanceMeters),
  };
}

/** Ensures diagnostics never leak provider details from upstream messages. */
export function sanitizeDiagnosticsForResponse(
  diagnostics: readonly PocCandidateDiagnostic[],
): PocCandidateDiagnostic[] {
  return diagnostics.slice(0, POC_CONFIG.maxCandidateCount).map((item) => ({ ...item }));
}
