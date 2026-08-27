import { haversineMeters } from '../anchors';
import type { PocCoordinate, PocLineString } from '../types';
import { POC_SCORING_CONFIG } from './config';

export type LoopQualityMetrics = {
  closureDistanceMeters: number;
  repeatedGeometryFraction: number;
  backtrackFraction: number;
  selfIntersectionCount: number;
  spikeCount: number;
  malformedGeometryWarning: boolean;
};

function toCoordinate(point: [number, number]): PocCoordinate {
  return { longitude: point[0], latitude: point[1] };
}

function sampleCoordinates(geometry: PocLineString, count: number): Array<[number, number]> {
  const coords = geometry.coordinates;
  if (coords.length <= count) {
    return [...coords];
  }
  const sampled: Array<[number, number]> = [];
  for (let i = 0; i < count; i += 1) {
    const index = Math.round((i * (coords.length - 1)) / (count - 1));
    sampled.push(coords[index]!);
  }
  return sampled;
}

function bearingDegrees(a: PocCoordinate, b: PocCoordinate): number {
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const bearing = (Math.atan2(y, x) * 180) / Math.PI;
  return (bearing + 360) % 360;
}

function angleDelta(a: number, b: number): number {
  const delta = Math.abs(a - b) % 360;
  return delta > 180 ? 360 - delta : delta;
}

function segmentsIntersect(
  a1: PocCoordinate,
  a2: PocCoordinate,
  b1: PocCoordinate,
  b2: PocCoordinate,
): boolean {
  const orient = (p: PocCoordinate, q: PocCoordinate, r: PocCoordinate): number => {
    const value =
      (q.latitude - p.latitude) * (r.longitude - q.longitude) -
      (q.longitude - p.longitude) * (r.latitude - q.latitude);
    if (Math.abs(value) < 1e-12) {
      return 0;
    }
    return value > 0 ? 1 : 2;
  };
  const o1 = orient(a1, a2, b1);
  const o2 = orient(a1, a2, b2);
  const o3 = orient(b1, b2, a1);
  const o4 = orient(b1, b2, a2);
  return o1 !== o2 && o3 !== o4;
}

/**
 * Deterministic loop-quality approximations for the POC.
 * Documented in poc/SCORING_AND_ENRICHMENT.md — not a safety score.
 */
export function analyzeLoopQuality(geometry: PocLineString): LoopQualityMetrics {
  const coords = geometry.coordinates;
  if (coords.length < 2) {
    return {
      closureDistanceMeters: Number.POSITIVE_INFINITY,
      repeatedGeometryFraction: 1,
      backtrackFraction: 1,
      selfIntersectionCount: 0,
      spikeCount: 0,
      malformedGeometryWarning: true,
    };
  }

  const start = toCoordinate(coords[0]!);
  const end = toCoordinate(coords[coords.length - 1]!);
  const closureDistanceMeters = haversineMeters(start, end);

  const sampled = sampleCoordinates(geometry, POC_SCORING_CONFIG.geometry.samplePointCount);
  const cellSize = 0.0003; // ~30m latitude cells — coarse reuse estimate
  const seen = new Map<string, number>();
  let repeats = 0;
  for (const point of sampled) {
    const key = `${Math.round(point[1] / cellSize)}:${Math.round(point[0] / cellSize)}`;
    const prior = seen.get(key) ?? 0;
    if (prior > 0) {
      repeats += 1;
    }
    seen.set(key, prior + 1);
  }
  const repeatedGeometryFraction = sampled.length === 0 ? 0 : repeats / sampled.length;

  let backtrackSegments = 0;
  let measuredSegments = 0;
  let spikeCount = 0;
  for (let i = 1; i < sampled.length - 1; i += 1) {
    const prev = toCoordinate(sampled[i - 1]!);
    const curr = toCoordinate(sampled[i]!);
    const next = toCoordinate(sampled[i + 1]!);
    const legIn = haversineMeters(prev, curr);
    const legOut = haversineMeters(curr, next);
    if (legIn < 5 || legOut < 5) {
      continue;
    }
    measuredSegments += 1;
    const inBearing = bearingDegrees(prev, curr);
    const outBearing = bearingDegrees(curr, next);
    const turn = angleDelta(inBearing, outBearing);
    if (turn > 150) {
      backtrackSegments += 1;
    }
    if (
      turn > 180 - POC_SCORING_CONFIG.geometry.spikeAngleDegrees &&
      Math.min(legIn, legOut) < POC_SCORING_CONFIG.geometry.spikeLengthMeters
    ) {
      spikeCount += 1;
    }
  }
  const backtrackFraction = measuredSegments === 0 ? 0 : backtrackSegments / measuredSegments;

  let selfIntersectionCount = 0;
  const points = sampled.map(toCoordinate);
  for (let i = 0; i < points.length - 1; i += 1) {
    for (let j = i + 2; j < points.length - 1; j += 1) {
      if (i === 0 && j === points.length - 2) {
        continue; // ignore near-closure of loops
      }
      if (segmentsIntersect(points[i]!, points[i + 1]!, points[j]!, points[j + 1]!)) {
        selfIntersectionCount += 1;
      }
    }
  }

  const malformedGeometryWarning =
    !Number.isFinite(closureDistanceMeters) ||
    coords.some((point) => !Number.isFinite(point[0]) || !Number.isFinite(point[1]));

  return {
    closureDistanceMeters,
    repeatedGeometryFraction,
    backtrackFraction,
    selfIntersectionCount,
    spikeCount,
    malformedGeometryWarning,
  };
}

/** Maps loop-quality metrics to a 0–100 component score. */
export function scoreLoopQuality(metrics: LoopQualityMetrics): number {
  if (metrics.malformedGeometryWarning) {
    return 0;
  }
  let score = 100;
  const { closureExcellentMeters, closurePoorMeters } = POC_SCORING_CONFIG.geometry;
  if (metrics.closureDistanceMeters > closureExcellentMeters) {
    const span = closurePoorMeters - closureExcellentMeters;
    const excess =
      Math.min(metrics.closureDistanceMeters, closurePoorMeters) - closureExcellentMeters;
    score -= (excess / span) * 35;
  }
  score -= Math.min(25, metrics.repeatedGeometryFraction * 40);
  score -= Math.min(20, metrics.backtrackFraction * 35);
  score -= Math.min(15, metrics.selfIntersectionCount * 3);
  score -= Math.min(10, metrics.spikeCount * 2);
  return Math.max(0, Math.min(100, Math.round(score)));
}
