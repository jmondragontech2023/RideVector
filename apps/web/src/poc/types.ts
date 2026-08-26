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

export type PocGenerateResponse = {
  seed: number;
  durationMs: number;
  attemptedCount: number;
  acceptedCount: number;
  alternatives: PocAlternative[];
  rejections: Record<PocRejectionReason, number>;
  warnings: string[];
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
