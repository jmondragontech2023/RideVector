import { POC_CONFIG } from './config';
import type { PocCoordinate } from './types';

const EARTH_RADIUS_METERS = 6_371_000;

export type PocAnchorPattern = {
  bearingFamily: string;
  bearingDegrees: number;
  waypoints: PocCoordinate[];
};

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

function normalizeBearing(degrees: number): number {
  const mod = degrees % 360;
  return mod < 0 ? mod + 360 : mod;
}

/** Destination point given start, bearing (degrees), and distance (meters). */
export function destinationPoint(
  start: PocCoordinate,
  bearingDegrees: number,
  distanceMeters: number,
): PocCoordinate {
  const angularDistance = distanceMeters / EARTH_RADIUS_METERS;
  const bearing = toRadians(bearingDegrees);
  const lat1 = toRadians(start.latitude);
  const lon1 = toRadians(start.longitude);

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(bearing),
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2),
    );

  return {
    latitude: toDegrees(lat2),
    longitude: ((toDegrees(lon2) + 540) % 360) - 180,
  };
}

export function haversineMeters(a: PocCoordinate, b: PocCoordinate): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Straight-line perimeter for start → wp1 → wp2 → start with 120° waypoint spacing. */
const TRIANGULAR_LOOP_PERIMETER_FACTOR = 2 + Math.sqrt(3);

/**
 * Builds deterministic loop waypoint patterns from start, target distance, and seed.
 * Anchor radius sizes the triangular loop so straight-line legs sum ≈ targetDistance.
 */
export function buildAnchorPatterns(
  start: PocCoordinate,
  targetDistanceMeters: number,
  seed: number,
  count: number,
): PocAnchorPattern[] {
  const radiusMeters = targetDistanceMeters / TRIANGULAR_LOOP_PERIMETER_FACTOR;
  const seedRotation = normalizeBearing(seed * 17);
  const baseBearings = [
    ...POC_CONFIG.bearingFamilyDegrees,
    ...POC_CONFIG.extraBearingFamilyDegrees,
  ];

  const limited = Math.min(Math.max(count, 1), POC_CONFIG.maxCandidateCount);
  const patterns: PocAnchorPattern[] = [];

  for (let i = 0; i < limited; i += 1) {
    const familyBearing = normalizeBearing(baseBearings[i]! + seedRotation);
    const wp1 = destinationPoint(start, familyBearing, radiusMeters);
    const wp2 = destinationPoint(start, normalizeBearing(familyBearing + 120), radiusMeters);
    patterns.push({
      bearingFamily: `bearing-${Math.round(familyBearing)}`,
      bearingDegrees: familyBearing,
      waypoints: [wp1, wp2],
    });
  }

  return patterns;
}

/** Geometry midpoint as the average of coordinate samples (provider-neutral). */
export function geometryMidpoint(coordinates: Array<[number, number]>): PocCoordinate {
  if (coordinates.length === 0) {
    return { latitude: 0, longitude: 0 };
  }
  let sumLat = 0;
  let sumLon = 0;
  for (const [lon, lat] of coordinates) {
    sumLat += lat;
    sumLon += lon;
  }
  return {
    latitude: sumLat / coordinates.length,
    longitude: sumLon / coordinates.length,
  };
}
