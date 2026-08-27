import type { PocCostingMode } from './config';

/** WGS84 coordinate used at the POC API boundary. */
export type PocCoordinate = {
  latitude: number;
  longitude: number;
};

/** Provider-neutral GeoJSON LineString; coordinates are [longitude, latitude]. */
export type PocLineString = {
  type: 'LineString';
  coordinates: Array<[number, number]>;
};

export type PocGenerateRequest = {
  start: PocCoordinate;
  /** Canonical target distance in meters. */
  targetDistanceMeters: number;
  /** ± flexibility around target in meters (user-controlled). */
  distanceFlexibilityMeters: number;
  costing: PocCostingMode;
  /** Optional integer seed for deterministic anchors. */
  seed?: number;
};

export type PocDistanceClassification = 'within_range' | 'near_match';

export type PocRejectionReason =
  | 'upstream_failure'
  | 'malformed_geometry'
  | 'outside_tolerance'
  | 'duplicate_candidate'
  | 'selection_limit';

export type PocCandidateOutcome = 'accepted' | 'rejected';

export type PocCandidateDiagnostic = {
  /** Stable 1-based attempt index for this generation. */
  attemptNumber: number;
  bearingFamily: string;
  outcome: PocCandidateOutcome;
  rejectionReason?: PocRejectionReason;
  distanceMeters?: number;
  durationSeconds?: number;
  distanceFromTargetMeters?: number;
  geometry?: PocLineString;
  /** Safe factual explanation without provider internals. */
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

export type PocAlternative = {
  /** Opaque POC-local identifier. */
  id: string;
  /** Factual label: Route A / Route B / Route C. */
  name: string;
  geometry: PocLineString;
  distanceMeters: number;
  durationSeconds: number;
  distanceFromTargetMeters: number;
  /** Bearing-family label for debugging. */
  bearingFamily: string;
  warnings: string[];
  distanceClassification: PocDistanceClassification;
  requestedRangeMeters: { min: number; max: number };
  rangeDeviationMeters?: number;
  targetDifferencePercent?: number;
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

export type PocValidationIssue = {
  field: string;
  reason: string;
};

export type PocErrorBody = {
  error: {
    code: string;
    message: string;
    details?: PocValidationIssue[];
  };
};
