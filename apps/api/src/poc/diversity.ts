import { haversineMeters } from './anchors';
import { POC_CONFIG } from './config';
import type { PocCoordinate } from './types';

/**
 * Lightweight POC diversity rule (documented):
 * A candidate is a near-duplicate when its geometry midpoint is closer than
 * `minMidpointSeparationFraction * estimatedLoopRadius` to any already-accepted
 * midpoint, where estimatedLoopRadius = targetDistanceMeters / (2π).
 *
 * This is intentionally geometric and deterministic. It is not a production
 * edge-overlap similarity engine.
 */
export function isNearDuplicateMidpoint(
  candidateMidpoint: PocCoordinate,
  acceptedMidpoints: readonly PocCoordinate[],
  targetDistanceMeters: number,
): boolean {
  const minSeparation =
    (targetDistanceMeters / (2 * Math.PI)) * POC_CONFIG.minMidpointSeparationFraction;
  return acceptedMidpoints.some(
    (existing) => haversineMeters(existing, candidateMidpoint) < minSeparation,
  );
}
