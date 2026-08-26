import type { PocCostingMode } from './config';
import type { PocCoordinate, PocValidationIssue } from './types';

export type RouteSpikeRequest = {
  start: PocCoordinate;
  destination: PocCoordinate;
  waypoints: PocCoordinate[];
  costing: PocCostingMode;
};

type LatLonRecord = Record<string, unknown>;

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isCostingMode(value: unknown): value is PocCostingMode {
  return value === 'road' || value === 'gravel';
}

/** Parses lat/lon or latitude/longitude coordinate objects. */
export function parseCoordinate(
  value: unknown,
  field: string,
  details: PocValidationIssue[],
): PocCoordinate | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    details.push({ field, reason: 'must be an object with lat/lon or latitude/longitude' });
    return null;
  }

  const record = value as LatLonRecord;
  const lat = record.lat ?? record.latitude;
  const lon = record.lon ?? record.longitude;

  if (!isFiniteNumber(lat) || lat < -90 || lat > 90) {
    details.push({ field: `${field}.lat`, reason: 'must be a finite number between -90 and 90' });
    return null;
  }
  if (!isFiniteNumber(lon) || lon < -180 || lon > 180) {
    details.push({
      field: `${field}.lon`,
      reason: 'must be a finite number between -180 and 180',
    });
    return null;
  }

  return { latitude: lat, longitude: lon };
}

export function validateRouteSpikeRequest(
  body: unknown,
): { ok: true; request: RouteSpikeRequest } | { ok: false; details: PocValidationIssue[] } {
  const details: PocValidationIssue[] = [];

  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return {
      ok: false,
      details: [{ field: 'body', reason: 'must be a JSON object' }],
    };
  }

  const record = body as Record<string, unknown>;
  const start = parseCoordinate(record.start, 'start', details);
  const destination = parseCoordinate(record.destination, 'destination', details);

  const waypoints: PocCoordinate[] = [];
  if (record.waypoints !== undefined) {
    if (!Array.isArray(record.waypoints)) {
      details.push({ field: 'waypoints', reason: 'must be an array when provided' });
    } else {
      record.waypoints.forEach((item, index) => {
        const parsed = parseCoordinate(item, `waypoints[${index}]`, details);
        if (parsed) {
          waypoints.push(parsed);
        }
      });
    }
  }

  const costing = record.costing === undefined ? 'road' : record.costing;
  if (!isCostingMode(costing)) {
    details.push({ field: 'costing', reason: 'must be "road" or "gravel" when provided' });
  }

  if (details.length > 0 || !start || !destination) {
    return { ok: false, details };
  }

  return {
    ok: true,
    request: {
      start,
      destination,
      waypoints,
      costing: costing as PocCostingMode,
    },
  };
}
