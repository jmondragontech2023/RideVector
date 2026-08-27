import { METERS_PER_MILE } from './units';

export const DEFAULT_DISTANCE_FLEXIBILITY_MILES = 3;

export type PocCostingMode = 'road' | 'gravel';

export type PocCoordinate = {
  latitude: number;
  longitude: number;
};

export type PocLineString = {
  type: 'LineString';
  coordinates: Array<[number, number]>;
};

export type PocDistanceClassification = 'within_range' | 'near_match';

export type PocAlternative = {
  id: string;
  name: string;
  geometry: PocLineString;
  distanceMeters: number;
  durationSeconds: number;
  distanceFromTargetMeters: number;
  bearingFamily: string;
  warnings: string[];
  distanceClassification: PocDistanceClassification;
  requestedRangeMeters: { min: number; max: number };
  rangeDeviationMeters?: number;
  targetDifferencePercent?: number;
};

export type PocRejectionReason =
  | 'upstream_failure'
  | 'malformed_geometry'
  | 'outside_tolerance'
  | 'duplicate_candidate'
  | 'selection_limit';

export type PocCandidateOutcome = 'accepted' | 'rejected';

export type PocCandidateDiagnostic = {
  attemptNumber: number;
  bearingFamily: string;
  outcome: PocCandidateOutcome;
  rejectionReason?: PocRejectionReason;
  distanceMeters?: number;
  durationSeconds?: number;
  distanceFromTargetMeters?: number;
  geometry?: PocLineString;
  explanation: string;
};

export type PocDiagnosticSummary = {
  attemptedCount: number;
  acceptedCount: number;
  rejectionCounts: Record<PocRejectionReason, number>;
  acceptedDistanceRangeMeters?: { min: number; max: number };
  closestRoutableRejected?: {
    attemptNumber: number;
    distanceMeters: number;
    distanceFromTargetMeters: number;
    toleranceMissMeters: number;
    toleranceMissPercent: number;
    direction: 'below' | 'above' | 'within';
  };
};

export type PocGenerateResponse = {
  seed: number;
  durationMs: number;
  attemptedCount: number;
  acceptedCount: number;
  alternatives: PocAlternative[];
  rejections: Record<PocRejectionReason, number>;
  warnings: string[];
  candidateDiagnostics: PocCandidateDiagnostic[];
  diagnosticSummary: PocDiagnosticSummary;
  distanceFlexibilityMeters: number;
  requestedRangeMeters: { min: number; max: number };
};

export type PocGenerateRequestBody = {
  start: PocCoordinate;
  targetDistanceMeters: number;
  distanceFlexibilityMeters: number;
  costing: PocCostingMode;
  seed?: number;
};

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: Array<{ field: string; reason: string }>;
  };
};

export { METERS_PER_MILE };

export function formatAcceptedRangeLabel(requestedRangeMeters: {
  min: number;
  max: number;
}): string {
  const low = requestedRangeMeters.min / METERS_PER_MILE;
  const high = requestedRangeMeters.max / METERS_PER_MILE;
  return `Accepted range: ${low.toFixed(1)}–${high.toFixed(1)} miles.`;
}

export function formatNearMatchDeviation(alternative: PocAlternative): string | null {
  if (alternative.distanceClassification !== 'near_match') {
    return null;
  }
  const miles = Math.abs(alternative.rangeDeviationMeters ?? 0) / METERS_PER_MILE;
  const direction = (alternative.rangeDeviationMeters ?? 0) < 0 ? 'below' : 'above';
  return `${miles.toFixed(1)} miles ${direction} your requested range.`;
}
