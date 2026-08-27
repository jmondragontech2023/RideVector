import { haversineMeters } from '../anchors';
import type { PocCoordinate, PocLineString } from '../types';
import { POC_SCORING_CONFIG } from './config';

function toCoordinate(point: [number, number]): PocCoordinate {
  return { longitude: point[0], latitude: point[1] };
}

/** Deterministically sample geometry for overlap estimates. */
export function sampleGeometryPoints(
  geometry: PocLineString,
  count = POC_SCORING_CONFIG.geometry.samplePointCount,
): PocCoordinate[] {
  const coords = geometry.coordinates;
  if (coords.length === 0) {
    return [];
  }
  if (coords.length <= count) {
    return coords.map(toCoordinate);
  }
  const sampled: PocCoordinate[] = [];
  for (let i = 0; i < count; i += 1) {
    const index = Math.round((i * (coords.length - 1)) / (count - 1));
    sampled.push(toCoordinate(coords[index]!));
  }
  return sampled;
}

/**
 * Approximate shared-route fraction: fraction of left samples within
 * `matchRadiusMeters` of any right sample (symmetric mean of both directions).
 */
export function estimatePairwiseOverlapFraction(
  left: PocLineString,
  right: PocLineString,
  matchRadiusMeters = 75,
): number {
  const leftPoints = sampleGeometryPoints(left);
  const rightPoints = sampleGeometryPoints(right);
  if (leftPoints.length === 0 || rightPoints.length === 0) {
    return 0;
  }

  const coverage = (from: PocCoordinate[], onto: PocCoordinate[]): number => {
    let hits = 0;
    for (const point of from) {
      if (onto.some((other) => haversineMeters(point, other) <= matchRadiusMeters)) {
        hits += 1;
      }
    }
    return hits / from.length;
  };

  return (coverage(leftPoints, rightPoints) + coverage(rightPoints, leftPoints)) / 2;
}

export type DiversityBreakdown = {
  /** Shared-route percentage 0–100 keyed by peer alternative id. */
  sharedRoutePercentByPeer: Record<string, number>;
  /** Mean pairwise overlap fraction 0–1 with other returned routes. */
  meanOverlapFraction: number;
  /** Diversity contribution score 0–100. */
  contributionScore: number;
};

export function computeDiversityBreakdown(
  routeId: string,
  geometry: PocLineString,
  peers: Array<{ id: string; geometry: PocLineString }>,
): DiversityBreakdown {
  const others = peers.filter((peer) => peer.id !== routeId);
  const sharedRoutePercentByPeer: Record<string, number> = {};
  if (others.length === 0) {
    return {
      sharedRoutePercentByPeer,
      meanOverlapFraction: 0,
      contributionScore: 100,
    };
  }

  let sum = 0;
  for (const peer of others) {
    const overlap = estimatePairwiseOverlapFraction(geometry, peer.geometry);
    sharedRoutePercentByPeer[peer.id] = Math.round(overlap * 1000) / 10;
    sum += overlap;
  }
  const meanOverlapFraction = sum / others.length;
  const contributionScore = Math.max(
    0,
    Math.min(100, Math.round(100 * (1 - meanOverlapFraction))),
  );
  return { sharedRoutePercentByPeer, meanOverlapFraction, contributionScore };
}
