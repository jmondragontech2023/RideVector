import {
  bearingDegrees,
  destinationPoint,
  haversineMeters,
  interpolateCoordinate,
} from './anchors';
import { POC_CONFIG } from './config';
import type { PocCoordinate } from './types';

export type PointToPointPattern = {
  id: string;
  locations: PocCoordinate[];
};

const DETOUR_ALONG_FRACTIONS = [0.35, 0.5, 0.65, 0.4, 0.6, 0.3, 0.7, 0.45, 0.55] as const;
const DETOUR_SIDES = [1, -1, 1, -1, 1, -1, 1, -1, 1] as const;
const DETOUR_SCALE_FACTORS = [0.45, 0.7, 1.0, 0.3, 1.25, 0.55, 0.85, 1.1, 0.4] as const;

/**
 * Deterministic Start → End patterns: the direct corridor plus seeded via-point
 * detours sized from the baseline routed (or estimated) distance. Endpoints are
 * never replaced; vias only add interior shaping.
 */
export function buildPointToPointPatterns(
  start: PocCoordinate,
  end: PocCoordinate,
  baselineDistanceMeters: number,
  targetDistanceMeters: number,
  seed: number,
  count: number,
): PointToPointPattern[] {
  const limited = Math.min(Math.max(count, 1), POC_CONFIG.maxCandidateCount);
  const patterns: PointToPointPattern[] = [{ id: 'direct', locations: [start, end] }];
  if (limited === 1) {
    return patterns;
  }

  const corridorBearing = bearingDegrees(start, end);
  const seedJitter = ((seed * 17) % 40) - 20;
  const extraNeeded = Math.max(0, targetDistanceMeters - baselineDistanceMeters);
  const varietyBase = Math.max(extraNeeded, baselineDistanceMeters * 0.22, 400);
  const corridorMeters = Math.max(haversineMeters(start, end), 1);

  for (let index = 0; index < limited - 1; index += 1) {
    const along = DETOUR_ALONG_FRACTIONS[index % DETOUR_ALONG_FRACTIONS.length]!;
    const side = DETOUR_SIDES[index % DETOUR_SIDES.length]!;
    const scale = DETOUR_SCALE_FACTORS[index % DETOUR_SCALE_FACTORS.length]!;
    const offsetDistance = Math.min(varietyBase * scale * 0.55, corridorMeters * 1.8);
    const alongPoint = interpolateCoordinate(start, end, along);
    const via = destinationPoint(
      alongPoint,
      corridorBearing + 90 * side + seedJitter,
      offsetDistance,
    );
    patterns.push({
      id: `detour-${index + 1}`,
      locations: [start, via, end],
    });
  }

  return patterns;
}

export function estimateBaselineDistanceMeters(start: PocCoordinate, end: PocCoordinate): number {
  return haversineMeters(start, end) * 1.3;
}
