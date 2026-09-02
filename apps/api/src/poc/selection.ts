import { geometryMidpoint } from './anchors';
import { POC_CONFIG } from './config';
import type { PocLineString } from './types';
import { isNearDuplicateMidpoint } from './diversity';
import type { DistanceClassification } from './distance-range';
import { estimatePairwiseOverlapFraction } from './scoring/overlap';

export type RoutableCandidate = {
  attemptNumber: number;
  bearingFamily: string;
  geometry: PocLineString;
  distanceMeters: number;
  durationSeconds: number;
  distanceFromTargetMeters: number;
  midpoint: ReturnType<typeof geometryMidpoint>;
  classification: DistanceClassification;
};

export type CandidateSelectionResult = {
  selected: RoutableCandidate[];
  duplicates: RoutableCandidate[];
  notSelected: RoutableCandidate[];
};

function sortSelectedCandidates(candidates: RoutableCandidate[]): RoutableCandidate[] {
  return [...candidates].sort((left, right) => {
    const classRank = (candidate: RoutableCandidate): number =>
      candidate.classification === 'within_range' ? 0 : 1;
    const byClass = classRank(left) - classRank(right);
    if (byClass !== 0) {
      return byClass;
    }
    return Math.abs(left.distanceFromTargetMeters) - Math.abs(right.distanceFromTargetMeters);
  });
}

function selectWithDiversity(
  candidates: RoutableCandidate[],
  targetDistanceMeters: number,
  maxCount: number,
  existingMidpoints: Array<ReturnType<typeof geometryMidpoint>>,
): { selected: RoutableCandidate[]; duplicates: RoutableCandidate[] } {
  const sorted = [...candidates].sort(
    (left, right) =>
      Math.abs(left.distanceFromTargetMeters) - Math.abs(right.distanceFromTargetMeters),
  );
  const selected: RoutableCandidate[] = [];
  const duplicates: RoutableCandidate[] = [];
  const usedMidpoints = [...existingMidpoints];

  for (const candidate of sorted) {
    if (selected.length >= maxCount) {
      break;
    }
    if (isNearDuplicateMidpoint(candidate.midpoint, usedMidpoints, targetDistanceMeters)) {
      duplicates.push(candidate);
      continue;
    }
    selected.push(candidate);
    usedMidpoints.push(candidate.midpoint);
  }

  return { selected, duplicates };
}

function isNearDuplicateOverlap(
  candidate: RoutableCandidate,
  selected: RoutableCandidate[],
  threshold: number,
): boolean {
  return selected.some(
    (other) => estimatePairwiseOverlapFraction(candidate.geometry, other.geometry) >= threshold,
  );
}

function selectWithOverlap(
  candidates: RoutableCandidate[],
  maxCount: number,
  existing: RoutableCandidate[],
  overlapThreshold: number,
): { selected: RoutableCandidate[]; duplicates: RoutableCandidate[] } {
  const sorted = [...candidates].sort(
    (left, right) =>
      Math.abs(left.distanceFromTargetMeters) - Math.abs(right.distanceFromTargetMeters),
  );
  const selected: RoutableCandidate[] = [];
  const duplicates: RoutableCandidate[] = [];
  const used = [...existing];

  for (const candidate of sorted) {
    if (selected.length >= maxCount) {
      break;
    }
    if (isNearDuplicateOverlap(candidate, used, overlapThreshold)) {
      duplicates.push(candidate);
      continue;
    }
    selected.push(candidate);
    used.push(candidate);
  }

  return { selected, duplicates };
}

/**
 * Point-to-point shortlist: reuse the loop within/near-match counts, but treat
 * corridor overlap (not loop midpoints) as the duplicate heuristic.
 */
export function selectPointToPointAlternatives(
  candidates: RoutableCandidate[],
  _targetDistanceMeters: number,
  overlapThreshold = POC_CONFIG.pointToPointDuplicateOverlapFraction,
): CandidateSelectionResult {
  const withinPool = candidates.filter((item) => item.classification === 'within_range');
  const nearPool = candidates.filter((item) => item.classification === 'near_match');

  const withinResult = selectWithOverlap(withinPool, 3, [], overlapThreshold);

  let nearSelected: RoutableCandidate[] = [];
  let nearDuplicates: RoutableCandidate[] = [];

  if (withinResult.selected.length < 2) {
    const nearLimit = Math.min(2, 3 - withinResult.selected.length);
    const nearResult = selectWithOverlap(
      nearPool,
      nearLimit,
      withinResult.selected,
      overlapThreshold,
    );
    nearSelected = nearResult.selected;
    nearDuplicates = nearResult.duplicates;
  }

  const selected = sortSelectedCandidates([...withinResult.selected, ...nearSelected]);
  const duplicates = [...withinResult.duplicates, ...nearDuplicates];
  const chosenAttempts = new Set(selected.map((item) => item.attemptNumber));
  const duplicateAttempts = new Set(duplicates.map((item) => item.attemptNumber));
  const notSelected = candidates.filter(
    (item) =>
      item.classification !== 'outside' &&
      !chosenAttempts.has(item.attemptNumber) &&
      !duplicateAttempts.has(item.attemptNumber),
  );

  return { selected, duplicates, notSelected };
}

export function selectRouteAlternatives(
  candidates: RoutableCandidate[],
  targetDistanceMeters: number,
): CandidateSelectionResult {
  const withinPool = candidates.filter((item) => item.classification === 'within_range');
  const nearPool = candidates.filter((item) => item.classification === 'near_match');

  const withinResult = selectWithDiversity(withinPool, targetDistanceMeters, 3, []);

  let nearSelected: RoutableCandidate[] = [];
  let nearDuplicates: RoutableCandidate[] = [];

  if (withinResult.selected.length < 2) {
    const nearLimit = Math.min(2, 3 - withinResult.selected.length);
    const nearResult = selectWithDiversity(
      nearPool,
      targetDistanceMeters,
      nearLimit,
      withinResult.selected.map((item) => item.midpoint),
    );
    nearSelected = nearResult.selected;
    nearDuplicates = nearResult.duplicates;
  }

  const selected = sortSelectedCandidates([...withinResult.selected, ...nearSelected]);
  const duplicates = [...withinResult.duplicates, ...nearDuplicates];
  const chosenAttempts = new Set(selected.map((item) => item.attemptNumber));
  const duplicateAttempts = new Set(duplicates.map((item) => item.attemptNumber));
  const notSelected = candidates.filter(
    (item) =>
      item.classification !== 'outside' &&
      !chosenAttempts.has(item.attemptNumber) &&
      !duplicateAttempts.has(item.attemptNumber),
  );

  return { selected, duplicates, notSelected };
}

export function geometryMidpointForCandidate(
  geometry: PocLineString,
): ReturnType<typeof geometryMidpoint> {
  return geometryMidpoint(geometry.coordinates);
}
