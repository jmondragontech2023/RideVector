import type {
  PocCandidateDiagnostic,
  PocDiagnosticSummary,
  PocGenerateResponse,
  PocLineString,
  PocRejectionReason,
} from './types';
import { formatMiles, metersToMiles } from './units';

export type RejectionReasonLabel = {
  short: string;
  description: string;
};

const REJECTION_LABELS: Record<PocRejectionReason, RejectionReasonLabel> = {
  outside_tolerance: {
    short: 'Outside distance range',
    description: 'Routed successfully but distance was outside the accepted range.',
  },
  duplicate_candidate: {
    short: 'Near duplicate',
    description: 'Routed within range but too similar to an already accepted loop.',
  },
  upstream_failure: {
    short: 'Routing failed',
    description: 'The routing service did not return a usable route.',
  },
  malformed_geometry: {
    short: 'Invalid geometry',
    description: 'Returned geometry could not be displayed on the map.',
  },
};

export function rejectionReasonLabel(reason: PocRejectionReason): RejectionReasonLabel {
  return REJECTION_LABELS[reason];
}

export function canPreviewOnMap(diagnostic: PocCandidateDiagnostic): boolean {
  return (
    diagnostic.geometry !== undefined &&
    diagnostic.geometry.coordinates.length >= 2 &&
    (diagnostic.rejectionReason === 'outside_tolerance' ||
      diagnostic.rejectionReason === 'duplicate_candidate')
  );
}

function rangeBandMiles(requestedRangeMeters: { min: number; max: number }): {
  low: number;
  high: number;
} {
  return {
    low: metersToMiles(requestedRangeMeters.min),
    high: metersToMiles(requestedRangeMeters.max),
  };
}

function formatRejectionBreakdown(
  counts: Record<PocRejectionReason, number>,
  requestedRangeMeters: { min: number; max: number },
): string[] {
  const band = rangeBandMiles(requestedRangeMeters);
  const parts: string[] = [];
  if (counts.outside_tolerance > 0) {
    parts.push(
      `${counts.outside_tolerance} ${counts.outside_tolerance === 1 ? 'was' : 'were'} outside the ${band.low.toFixed(1)}–${band.high.toFixed(1)} mile range`,
    );
  }
  if (counts.duplicate_candidate > 0) {
    parts.push(
      `${counts.duplicate_candidate} ${counts.duplicate_candidate === 1 ? 'was a' : 'were'} near duplicate${counts.duplicate_candidate === 1 ? '' : 's'}`,
    );
  }
  if (counts.upstream_failure > 0) {
    parts.push(
      `${counts.upstream_failure} routing ${counts.upstream_failure === 1 ? 'request' : 'requests'} failed`,
    );
  }
  if (counts.malformed_geometry > 0) {
    parts.push(
      `${counts.malformed_geometry} ${counts.malformed_geometry === 1 ? 'returned' : 'returned'} invalid geometry`,
    );
  }
  return parts;
}

function joinEnglishParts(parts: string[]): string {
  if (parts.length === 0) {
    return '';
  }
  if (parts.length === 1) {
    return parts[0]!;
  }
  if (parts.length === 2) {
    return `${parts[0]} and ${parts[1]}`;
  }
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}

function closestSummaryText(
  summary: PocDiagnosticSummary,
  requestedRangeMeters: { min: number; max: number },
): string | null {
  const closest = summary.closestRoutableRejected;
  if (!closest) {
    return null;
  }

  const band = rangeBandMiles(requestedRangeMeters);
  const distanceText = formatMiles(closest.distanceMeters, 1);
  const missMiles = metersToMiles(closest.toleranceMissMeters).toFixed(1);
  const missPercent = closest.toleranceMissPercent.toFixed(1);

  if (closest.direction === 'below') {
    return `Closest: ${distanceText}, ${missMiles} miles below the accepted range (${missPercent}% off target).`;
  }
  if (closest.direction === 'above') {
    return `Closest: ${distanceText}, ${missMiles} miles above the accepted range (${missPercent}% off target).`;
  }

  return `Closest: ${distanceText}, within the ${band.low.toFixed(1)}–${band.high.toFixed(1)} mile range but rejected as a near duplicate.`;
}

export function buildGenerationSummary(response: PocGenerateResponse): string {
  const { diagnosticSummary, acceptedCount, requestedRangeMeters, alternatives, warnings } =
    response;
  const attempted = diagnosticSummary.attemptedCount;
  const band = rangeBandMiles(requestedRangeMeters);
  const withinCount = alternatives.filter(
    (item) => item.distanceClassification === 'within_range',
  ).length;

  if (acceptedCount > 0 && withinCount === 0) {
    return (
      warnings.find((warning) => warning.includes('exact range')) ??
      'No routes met your exact range. Showing the closest near matches.'
    );
  }

  if (acceptedCount === 0) {
    const breakdown = joinEnglishParts(
      formatRejectionBreakdown(diagnosticSummary.rejectionCounts, requestedRangeMeters),
    );
    const closest = closestSummaryText(diagnosticSummary, requestedRangeMeters);
    const base = breakdown
      ? `Tried ${attempted} candidates. ${breakdown.charAt(0).toUpperCase()}${breakdown.slice(1)}.`
      : `Tried ${attempted} candidates. None passed filtering.`;
    return closest ? `${base} ${closest}` : base;
  }

  const range = diagnosticSummary.acceptedDistanceRangeMeters;
  const rangeText = range
    ? ` Accepted routes span ${formatMiles(range.min, 1)}–${formatMiles(range.max, 1)}.`
    : '';
  const rejectedTotal = attempted - acceptedCount;
  if (rejectedTotal <= 0) {
    return `Tried ${attempted} candidates. ${acceptedCount} passed within the ${band.low.toFixed(1)}–${band.high.toFixed(1)} mile range.${rangeText}`;
  }

  const breakdown = joinEnglishParts(
    formatRejectionBreakdown(diagnosticSummary.rejectionCounts, requestedRangeMeters),
  );
  return `Tried ${attempted} candidates. ${acceptedCount} passed; ${breakdown}.${rangeText}`;
}

export function formatTargetDeltaWithTarget(
  distanceFromTargetMeters: number,
  targetDistanceMeters: number,
): string {
  const miles = metersToMiles(Math.abs(distanceFromTargetMeters));
  const percent = ((Math.abs(distanceFromTargetMeters) / targetDistanceMeters) * 100).toFixed(1);
  const direction = distanceFromTargetMeters >= 0 ? 'above' : 'below';
  return `${miles.toFixed(1)} mi (${percent}%) ${direction} target`;
}

export type RejectedPreview = {
  attemptNumber: number;
  geometry: PocLineString;
  label: string;
};

export function rejectedPreviewFromDiagnostic(
  diagnostic: PocCandidateDiagnostic,
): RejectedPreview | null {
  if (!canPreviewOnMap(diagnostic) || !diagnostic.geometry) {
    return null;
  }
  const reason = diagnostic.rejectionReason
    ? rejectionReasonLabel(diagnostic.rejectionReason).short
    : 'Rejected candidate';
  return {
    attemptNumber: diagnostic.attemptNumber,
    geometry: diagnostic.geometry,
    label: `Rejected attempt ${diagnostic.attemptNumber} · ${reason}`,
  };
}

export function findRejectedPreview(
  result: PocGenerateResponse | null,
  previewAttemptNumber: number | null,
): RejectedPreview | null {
  if (!result || previewAttemptNumber === null) {
    return null;
  }
  const diagnostic = result.candidateDiagnostics.find(
    (item) => item.attemptNumber === previewAttemptNumber,
  );
  return diagnostic ? rejectedPreviewFromDiagnostic(diagnostic) : null;
}

export function emptyDiagnosticSummary(): PocGenerateResponse['diagnosticSummary'] {
  return {
    attemptedCount: 0,
    acceptedCount: 0,
    rejectionCounts: {
      upstream_failure: 0,
      malformed_geometry: 0,
      outside_tolerance: 0,
      duplicate_candidate: 0,
    },
  };
}
