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
  costing: PocCostingMode;
  /** Optional integer seed for deterministic anchors. */
  seed?: number;
};

export type PocRejectionReason =
  | 'upstream_failure'
  | 'malformed_geometry'
  | 'outside_tolerance'
  | 'duplicate_candidate';

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
};

export type PocGenerateResponse = {
  seed: number;
  durationMs: number;
  attemptedCount: number;
  acceptedCount: number;
  alternatives: PocAlternative[];
  rejections: Record<PocRejectionReason, number>;
  warnings: string[];
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
