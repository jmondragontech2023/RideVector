import { haversineMeters } from './anchors';
import { POC_CONFIG } from './config';
import type { PocCoordinate, PocLineString, PocValidationIssue } from './types';

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function parseCoordinate(
  value: unknown,
  field: string,
): { ok: true; coordinate: PocCoordinate } | { ok: false; details: PocValidationIssue[] } {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return {
      ok: false,
      details: [{ field, reason: 'must be an object with latitude and longitude' }],
    };
  }
  const record = value as Record<string, unknown>;
  const details: PocValidationIssue[] = [];
  if (!isFiniteNumber(record.latitude) || record.latitude < -90 || record.latitude > 90) {
    details.push({
      field: `${field}.latitude`,
      reason: 'must be a finite number between -90 and 90',
    });
  }
  if (!isFiniteNumber(record.longitude) || record.longitude < -180 || record.longitude > 180) {
    details.push({
      field: `${field}.longitude`,
      reason: 'must be a finite number between -180 and 180',
    });
  }
  if (details.length > 0) {
    return { ok: false, details };
  }
  return {
    ok: true,
    coordinate: {
      latitude: record.latitude as number,
      longitude: record.longitude as number,
    },
  };
}

export function coordinatesAreWithinMeters(
  left: PocCoordinate,
  right: PocCoordinate,
  meters: number,
): boolean {
  return haversineMeters(left, right) < meters;
}

export function coordinatesAreCoincident(left: PocCoordinate, right: PocCoordinate): boolean {
  return coordinatesAreWithinMeters(left, right, POC_CONFIG.coincidentEndpointMeters);
}

export function adjacentLocationsCollapse(
  left: PocCoordinate,
  right: PocCoordinate,
): boolean {
  return coordinatesAreWithinMeters(left, right, POC_CONFIG.zeroLengthLegMeters);
}

export function lineStringEndpoints(
  geometry: PocLineString,
): { start: PocCoordinate; end: PocCoordinate } | null {
  const first = geometry.coordinates[0];
  const last = geometry.coordinates[geometry.coordinates.length - 1];
  if (!first || !last) {
    return null;
  }
  return {
    start: { longitude: first[0], latitude: first[1] },
    end: { longitude: last[0], latitude: last[1] },
  };
}

/**
 * Hard endpoint compliance: first/last geometry points must stay within the
 * centralized snap tolerance of the requested Start/End. Requested coordinates
 * remain the source of truth; snapped geometry is not rewritten onto the request.
 */
export function geometryMeetsRequestedEndpoints(
  geometry: PocLineString,
  start: PocCoordinate,
  end: PocCoordinate,
  snapMeters = POC_CONFIG.endpointSnapToleranceMeters,
): boolean {
  const endpoints = lineStringEndpoints(geometry);
  if (!endpoints) {
    return false;
  }
  return (
    coordinatesAreWithinMeters(endpoints.start, start, snapMeters) &&
    coordinatesAreWithinMeters(endpoints.end, end, snapMeters)
  );
}
