import { acceptedRangeMeters } from '../distance-range';
import type { PocDistanceClassification } from '../types';

export type DistanceFitInput = {
  distanceMeters: number;
  targetDistanceMeters: number;
  distanceFlexibilityMeters: number;
  classification: PocDistanceClassification;
};

/**
 * Distance-fit score 0–100.
 * In-range candidates always score strictly above near matches.
 */
export function scoreDistanceFit(input: DistanceFitInput): {
  score: number;
  absoluteDifferenceMeters: number;
  percentDifference: number;
  insideRange: boolean;
} {
  const absoluteDifferenceMeters = Math.abs(input.distanceMeters - input.targetDistanceMeters);
  const percentDifference =
    input.targetDistanceMeters === 0
      ? 100
      : (absoluteDifferenceMeters / input.targetDistanceMeters) * 100;
  const range = acceptedRangeMeters(
    input.targetDistanceMeters,
    input.distanceFlexibilityMeters,
  );
  const insideRange = input.classification === 'within_range';

  if (insideRange) {
    const halfWidth = Math.max(1, (range.max - range.min) / 2);
    const closeness = 1 - Math.min(1, absoluteDifferenceMeters / halfWidth);
    const score = Math.round(70 + closeness * 30);
    return {
      score: Math.max(70, Math.min(100, score)),
      absoluteDifferenceMeters,
      percentDifference,
      insideRange: true,
    };
  }

  // Near match: cap below the minimum in-range score (70).
  const nearSpan = Math.max(1, input.distanceFlexibilityMeters + input.targetDistanceMeters * 0.35);
  const closeness = 1 - Math.min(1, absoluteDifferenceMeters / nearSpan);
  const score = Math.round(20 + closeness * 35);
  return {
    score: Math.max(20, Math.min(55, score)),
    absoluteDifferenceMeters,
    percentDifference,
    insideRange: false,
  };
}
