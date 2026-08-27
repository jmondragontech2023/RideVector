import { METERS_PER_MILE, POC_CONFIG } from './config';

export type DistanceClassification = 'within_range' | 'near_match' | 'outside';

export function acceptedRangeMeters(
  targetDistanceMeters: number,
  distanceFlexibilityMeters: number,
): { min: number; max: number } {
  return {
    min: Math.max(0, targetDistanceMeters - distanceFlexibilityMeters),
    max: targetDistanceMeters + distanceFlexibilityMeters,
  };
}

export function qualifiesAsNearMatch(
  distanceMeters: number,
  targetDistanceMeters: number,
  distanceFlexibilityMeters: number,
): boolean {
  const { min, max } = acceptedRangeMeters(targetDistanceMeters, distanceFlexibilityMeters);
  const extraMeters = POC_CONFIG.nearMatchExtraMiles * METERS_PER_MILE;

  if (distanceMeters >= min && distanceMeters <= max) {
    return false;
  }

  if (distanceMeters < min) {
    if (min - distanceMeters > extraMeters) {
      return false;
    }
  } else if (distanceMeters - max > extraMeters) {
    return false;
  }

  const absoluteDifference = Math.abs(distanceMeters - targetDistanceMeters);
  return absoluteDifference <= targetDistanceMeters * POC_CONFIG.nearMatchMaxTargetFraction;
}

export function classifyRouteDistance(
  distanceMeters: number,
  targetDistanceMeters: number,
  distanceFlexibilityMeters: number,
): DistanceClassification {
  const { min, max } = acceptedRangeMeters(targetDistanceMeters, distanceFlexibilityMeters);
  if (distanceMeters >= min && distanceMeters <= max) {
    return 'within_range';
  }
  if (qualifiesAsNearMatch(distanceMeters, targetDistanceMeters, distanceFlexibilityMeters)) {
    return 'near_match';
  }
  return 'outside';
}

/** Negative when below minimum, positive when above maximum, zero when inside range. */
export function rangeDeviationMeters(
  distanceMeters: number,
  targetDistanceMeters: number,
  distanceFlexibilityMeters: number,
): number {
  const { min, max } = acceptedRangeMeters(targetDistanceMeters, distanceFlexibilityMeters);
  if (distanceMeters < min) {
    return distanceMeters - min;
  }
  if (distanceMeters > max) {
    return distanceMeters - max;
  }
  return 0;
}

export function targetDifferencePercent(
  distanceMeters: number,
  targetDistanceMeters: number,
): number {
  return (Math.abs(distanceMeters - targetDistanceMeters) / targetDistanceMeters) * 100;
}

export function buildNearMatchWarning(
  distanceMeters: number,
  targetDistanceMeters: number,
  distanceFlexibilityMeters: number,
): string {
  const deviationMeters = rangeDeviationMeters(
    distanceMeters,
    targetDistanceMeters,
    distanceFlexibilityMeters,
  );
  const miles = Math.abs(deviationMeters) / METERS_PER_MILE;
  const direction = deviationMeters < 0 ? 'below' : 'above';
  const percent = targetDifferencePercent(distanceMeters, targetDistanceMeters).toFixed(1);
  return `Near match: ${miles.toFixed(1)} mi ${direction} your requested range (${percent}% from target). Does not satisfy the exact range.`;
}

export function defaultDistanceFlexibilityMeters(): number {
  return POC_CONFIG.defaultDistanceFlexibilityMiles * METERS_PER_MILE;
}
