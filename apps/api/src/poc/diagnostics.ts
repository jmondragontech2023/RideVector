import { METERS_PER_MILE, POC_CONFIG } from './config';
import { acceptedRangeMeters, rangeDeviationMeters } from './distance-range';
import type {
  PocCandidateDiagnostic,
  PocCandidateOutcome,
  PocDiagnosticSummary,
  PocDistanceClassification,
  PocLineString,
  PocRejectionReason,
  PocRouteMode,
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
  distanceFlexibilityMeters: number;
  acceptedRouteName?: string;
  distanceClassification?: PocDistanceClassification;
  routeMode?: PocRouteMode;
};

function formatDistanceMiles(meters: number, digits = 1): string {
  return `${(meters / METERS_PER_MILE).toFixed(digits)}`;
}

function buildExplanation(input: BuildDiagnosticInput): string {
  const miles =
    input.distanceMeters !== undefined ? formatDistanceMiles(input.distanceMeters) : null;
  const targetMiles = formatDistanceMiles(input.targetDistanceMeters);
  const { min, max } = acceptedRangeMeters(
    input.targetDistanceMeters,
    input.distanceFlexibilityMeters,
  );
  const bandLow = formatDistanceMiles(min, 1);
  const bandHigh = formatDistanceMiles(max, 1);

  if (input.outcome === 'accepted') {
    if (input.distanceClassification === 'near_match') {
      return input.acceptedRouteName
        ? `Accepted as ${input.acceptedRouteName} near match outside the ${bandLow}–${bandHigh} mile requested range.`
        : `Returned as a near match outside the ${bandLow}–${bandHigh} mile requested range.`;
    }
    return input.acceptedRouteName
      ? `Accepted as ${input.acceptedRouteName} within the ${bandLow}–${bandHigh} mile requested range.`
      : `Met distance range and diversity checks within the ${bandLow}–${bandHigh} mile requested range.`;
  }

  switch (input.rejectionReason) {
    case 'upstream_failure':
      return input.routeMode === 'point_to_point'
        ? 'The routing service did not return a usable start-to-end route for this candidate.'
        : 'The routing service did not return a usable route for this bearing family.';
    case 'malformed_geometry':
      return 'The routing service returned geometry that could not be displayed.';
    case 'endpoint_mismatch':
      return 'The routed geometry did not stay on the requested Start and End within the snap tolerance.';
    case 'outside_tolerance':
      return miles
        ? `Routed ${miles} mi, outside the ${bandLow}–${bandHigh} mile requested range around the ${targetMiles} mi target.`
        : `Route distance was outside the ${bandLow}–${bandHigh} mile requested range around the ${targetMiles} mi target.`;
    case 'duplicate_candidate':
      return miles
        ? input.routeMode === 'point_to_point'
          ? `Routed ${miles} mi within range, but the path overlapped an already accepted alternative too closely.`
          : `Routed ${miles} mi within range, but the loop shape was too similar to an already accepted candidate.`
        : input.routeMode === 'point_to_point'
          ? 'Path overlapped an already accepted alternative too closely.'
          : 'Loop shape was too similar to an already accepted candidate.';
    case 'selection_limit':
      return miles
        ? `Routed ${miles} mi and was eligible, but the bounded alternative set was already full.`
        : input.routeMode === 'point_to_point'
          ? 'Eligible start-to-end route was not returned because the bounded alternative set was already full.'
          : 'Eligible loop was not returned because the bounded alternative set was already full.';
    default:
      return input.geometry
        ? input.routeMode === 'point_to_point'
          ? 'Routable start-to-end path was not returned as an alternative.'
          : 'Routable loop was not returned as an alternative.'
        : 'This candidate was not returned as an alternative.';
  }
}

export function buildCandidateDiagnostic(input: BuildDiagnosticInput): PocCandidateDiagnostic {
  const includeGeometry =
    input.geometry !== undefined &&
    input.geometry.coordinates.length >= 2 &&
    (input.outcome === 'accepted' ||
      input.rejectionReason === 'outside_tolerance' ||
      input.rejectionReason === 'duplicate_candidate' ||
      input.rejectionReason === 'selection_limit' ||
      input.rejectionReason === 'endpoint_mismatch');

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
  distanceFlexibilityMeters: number;
  diagnostics: readonly PocCandidateDiagnostic[];
  rejections: Record<PocRejectionReason, number>;
  attemptedCount: number;
  acceptedCount: number;
};

function closestRoutableRejected(
  diagnostics: readonly PocCandidateDiagnostic[],
  targetDistanceMeters: number,
  distanceFlexibilityMeters: number,
): PocDiagnosticSummary['closestRoutableRejected'] {
  const routableRejected = diagnostics.filter(
    (item) =>
      item.outcome === 'rejected' &&
      item.geometry !== undefined &&
      item.distanceMeters !== undefined &&
      (item.rejectionReason === 'outside_tolerance' ||
        item.rejectionReason === 'duplicate_candidate' ||
        item.rejectionReason === 'selection_limit' ||
        item.rejectionReason === 'endpoint_mismatch'),
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
  const deviation = rangeDeviationMeters(
    distanceMeters,
    targetDistanceMeters,
    distanceFlexibilityMeters,
  );
  let direction: 'below' | 'above' | 'within';
  let toleranceMissMeters = 0;

  if (deviation < 0) {
    direction = 'below';
    toleranceMissMeters = Math.abs(deviation);
  } else if (deviation > 0) {
    direction = 'above';
    toleranceMissMeters = deviation;
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
    closestRoutableRejected: closestRoutableRejected(
      input.diagnostics,
      input.targetDistanceMeters,
      input.distanceFlexibilityMeters,
    ),
  };
}

/** Ensures diagnostics never leak provider details from upstream messages. */
export function sanitizeDiagnosticsForResponse(
  diagnostics: readonly PocCandidateDiagnostic[],
): PocCandidateDiagnostic[] {
  return diagnostics.slice(0, POC_CONFIG.maxCandidateCount).map((item) => ({ ...item }));
}
