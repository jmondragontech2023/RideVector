import { METERS_PER_MILE } from './units';

export type PocCostingMode = 'road' | 'gravel';

export type PocCoordinate = {
  latitude: number;
  longitude: number;
};

export type PocLineString = {
  type: 'LineString';
  coordinates: Array<[number, number]>;
};

export type PocAlternative = {
  id: string;
  name: string;
  geometry: PocLineString;
  distanceMeters: number;
  durationSeconds: number;
  distanceFromTargetMeters: number;
  bearingFamily: string;
  warnings: string[];
};

export type PocRejectionReason =
  | 'upstream_failure'
  | 'malformed_geometry'
  | 'outside_tolerance'
  | 'duplicate_candidate';

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
};

export type PocGenerateRequestBody = {
  start: PocCoordinate;
  targetDistanceMeters: number;
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
