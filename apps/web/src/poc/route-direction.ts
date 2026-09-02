/** GeoJSON order: [longitude, latitude]. */
export type LonLat = [number, number];

export type DirectionMarkerKind =
  | 'regular'
  | 'ambiguity-before'
  | 'ambiguity-after'
  | 'turn-before'
  | 'turn-after';

export type DirectionMarker = {
  lon: number;
  lat: number;
  /** Compass bearing in degrees (0 = north, 90 = east). */
  bearing: number;
  /** Travel-order sequence starting at 1. */
  sequence: number;
  /** Cumulative distance from route departure in meters. */
  distanceMeters: number;
  /** Fraction of total route length (0 at start → 1 at finish). */
  progress: number;
  kind: DirectionMarkerKind;
};

export const ROUTE_DIRECTION_DEFAULTS = {
  minMarkers: 12,
  maxMarkers: 40,
  /** Aim for roughly one marker per this many meters of route. */
  targetSpacingMeters: 400,
  /** Insert fillers when consecutive markers exceed this along-route gap. */
  maxGapMeters: 550,
  /** Exclude the first/last fraction of route length from baseline placement. */
  endpointExclusionFraction: 0.06,
  /** Minimum distance from departure before placing marker 1. */
  startExclusionMeters: 120,
  /** Minimum route length required before placing any arrow. */
  minRouteLengthMeters: 400,
  /** Minimum bearing change (degrees) to flag a significant navigation turn. */
  turnBearingThreshold: 55,
  /** Minimum bearing change (degrees) to flag a reversal or self-overlap. */
  reversalBearingThreshold: 135,
  /** Distance before/after an ambiguity center for paired markers. */
  ambiguityMarkerOffsetMeters: 75,
  /** Distance before/after a turn for paired approach/departure markers. */
  turnMarkerOffsetMeters: 40,
  /** Merge ambiguity zones whose centers are closer than this. */
  ambiguityMergeDistanceMeters: 80,
  /** Merge turn zones whose centers are closer than this. */
  turnMergeDistanceMeters: 100,
  /**
   * Collapse consecutive same-road corridor overlap hits into one region when
   * adjacent hits are within this along-route gap.
   */
  corridorOverlapRegionGapMeters: 250,
  /** Spatial proximity for endpoint crossings in meters. */
  selfOverlapProximityMeters: 35,
  /** Maximum corridor separation for same-road out-and-back overlap. */
  corridorOverlapMaxSeparationMeters: 15,
  /** Minimum along-route separation before comparing segments for overlap. */
  selfOverlapMinRouteSeparationMeters: 120,
  /** Bearing change for endpoint-adjacent crossings (figure-eight, junctions). */
  crossingBearingThreshold: 45,
  /** Suppress markers closer than this along the route. */
  minMarkerSeparationMeters: 55,
  /** Suppress markers closer than this in geographic space (out-and-back stacks). */
  minSpatialSeparationMeters: 40,
} as const;

const EARTH_RADIUS_METERS = 6_371_000;

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

/** Smallest angle between two compass bearings in degrees (0–180). */
export function bearingDifferenceDegrees(from: number, to: number): number {
  const diff = Math.abs(normalizeBearing(from) - normalizeBearing(to));
  return diff > 180 ? 360 - diff : diff;
}

/** Haversine distance between two lon/lat points in meters. */
export function segmentLengthMeters(from: LonLat, to: LonLat): number {
  const [lon1, lat1] = from;
  const [lon2, lat2] = to;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const lat1Rad = toRadians(lat1);
  const lat2Rad = toRadians(lat2);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial compass bearing from `from` to `to` in degrees. */
export function bearingDegrees(from: LonLat, to: LonLat): number {
  const [lon1, lat1] = from;
  const [lon2, lat2] = to;
  const lat1Rad = toRadians(lat1);
  const lat2Rad = toRadians(lat2);
  const dLon = toRadians(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
  return normalizeBearing(toDegrees(Math.atan2(y, x)));
}

type RouteSegment = {
  start: LonLat;
  end: LonLat;
  startDistance: number;
  endDistance: number;
};

function buildSegments(coordinates: readonly LonLat[]): RouteSegment[] {
  const segments: RouteSegment[] = [];
  let cumulative = 0;

  for (let index = 1; index < coordinates.length; index += 1) {
    const start = coordinates[index - 1]!;
    const end = coordinates[index]!;
    const length = segmentLengthMeters(start, end);
    if (length === 0) {
      continue;
    }
    segments.push({
      start,
      end,
      startDistance: cumulative,
      endDistance: cumulative + length,
    });
    cumulative += length;
  }

  return segments;
}

/** Total traversed distance along ordered coordinates in meters. */
export function cumulativeRouteLengthMeters(coordinates: readonly LonLat[]): number {
  const segments = buildSegments(coordinates);
  if (segments.length === 0) {
    return 0;
  }
  return segments[segments.length - 1]!.endDistance;
}

function interpolatePoint(from: LonLat, to: LonLat, fraction: number): LonLat {
  const [lon1, lat1] = from;
  const [lon2, lat2] = to;
  return [lon1 + (lon2 - lon1) * fraction, lat1 + (lat2 - lat1) * fraction];
}

export type RoutePointAtDistance = {
  point: LonLat;
  bearing: number;
  distanceMeters: number;
};

/** Locates a point and travel bearing at a cumulative route distance. */
export function lookupPointAtRouteDistance(
  segments: RouteSegment[],
  distanceMeters: number,
): RoutePointAtDistance | null {
  if (segments.length === 0) {
    return null;
  }

  const clamped = Math.max(0, Math.min(distanceMeters, segments[segments.length - 1]!.endDistance));

  for (const segment of segments) {
    if (clamped > segment.endDistance) {
      continue;
    }
    if (clamped <= segment.startDistance) {
      return {
        point: segment.start,
        bearing: bearingDegrees(segment.start, segment.end),
        distanceMeters: clamped,
      };
    }
    const span = segment.endDistance - segment.startDistance;
    const fraction = span === 0 ? 0 : (clamped - segment.startDistance) / span;
    return {
      point: interpolatePoint(segment.start, segment.end, fraction),
      bearing: bearingDegrees(segment.start, segment.end),
      distanceMeters: clamped,
    };
  }

  const last = segments[segments.length - 1]!;
  return {
    point: last.end,
    bearing: bearingDegrees(last.start, last.end),
    distanceMeters: clamped,
  };
}

type AmbiguityZone = {
  centerDistance: number;
};

type ResolvedMarkerCandidate = {
  distanceMeters: number;
  kind: DirectionMarkerKind;
  priority: number;
};

function segmentMidpoint(segment: RouteSegment): LonLat {
  return interpolatePoint(segment.start, segment.end, 0.5);
}

function minEndpointSeparationMeters(left: RouteSegment, right: RouteSegment): number {
  return Math.min(
    segmentLengthMeters(left.start, right.start),
    segmentLengthMeters(left.start, right.end),
    segmentLengthMeters(left.end, right.start),
    segmentLengthMeters(left.end, right.end),
  );
}

function pointToSegmentDistanceMeters(point: LonLat, segment: RouteSegment): number {
  const segmentLength = segmentLengthMeters(segment.start, segment.end);
  if (segmentLength === 0) {
    return segmentLengthMeters(point, segment.start);
  }

  const [px, py] = point;
  const [ax, ay] = segment.start;
  const [bx, by] = segment.end;
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  const projected: LonLat = [ax + dx * t, ay + dy * t];
  return segmentLengthMeters(point, projected);
}

function corridorSeparationMeters(left: RouteSegment, right: RouteSegment): number {
  const leftSamples = [left.start, left.end, segmentMidpoint(left)];
  const rightSamples = [right.start, right.end, segmentMidpoint(right)];
  let minimum = Number.POSITIVE_INFINITY;

  for (const sample of leftSamples) {
    minimum = Math.min(minimum, pointToSegmentDistanceMeters(sample, right));
  }
  for (const sample of rightSamples) {
    minimum = Math.min(minimum, pointToSegmentDistanceMeters(sample, left));
  }

  return minimum;
}

function detectReversalZones(
  segments: RouteSegment[],
  reversalBearingThreshold: number,
): AmbiguityZone[] {
  const zones: AmbiguityZone[] = [];

  for (let index = 1; index < segments.length; index += 1) {
    const previous = segments[index - 1]!;
    const current = segments[index]!;
    const previousBearing = bearingDegrees(previous.start, previous.end);
    const currentBearing = bearingDegrees(current.start, current.end);
    if (bearingDifferenceDegrees(previousBearing, currentBearing) >= reversalBearingThreshold) {
      zones.push({ centerDistance: current.startDistance });
    }
  }

  return zones;
}

/** Significant navigation turns that are not full reversals (e.g. 90° corners). */
function detectTurnZones(
  segments: RouteSegment[],
  turnBearingThreshold: number,
  reversalBearingThreshold: number,
): AmbiguityZone[] {
  const zones: AmbiguityZone[] = [];

  for (let index = 1; index < segments.length; index += 1) {
    const previous = segments[index - 1]!;
    const current = segments[index]!;
    const previousBearing = bearingDegrees(previous.start, previous.end);
    const currentBearing = bearingDegrees(current.start, current.end);
    const delta = bearingDifferenceDegrees(previousBearing, currentBearing);
    if (delta >= turnBearingThreshold && delta < reversalBearingThreshold) {
      zones.push({ centerDistance: current.startDistance });
    }
  }

  return zones;
}

function isLoopClosureOverlap(
  earlier: RouteSegment,
  later: RouteSegment,
  totalLength: number,
  endpointExclusionMeters: number,
): boolean {
  const laterNearEnd = later.endDistance >= totalLength - endpointExclusionMeters;
  const earlierNearStart = earlier.startDistance <= endpointExclusionMeters;
  return laterNearEnd && earlierNearStart;
}

/**
 * Collapses consecutive corridor-overlap hit distances into one zone per contiguous
 * region (midpoint). Prevents long out-and-backs from emitting a pair on every segment.
 */
function collapseCorridorOverlapRegions(
  hitDistances: readonly number[],
  regionGapMeters: number,
): AmbiguityZone[] {
  if (hitDistances.length === 0) {
    return [];
  }

  const sorted = [...hitDistances].sort((left, right) => left - right);
  const regions: AmbiguityZone[] = [];
  let regionStart = sorted[0]!;
  let regionEnd = sorted[0]!;

  for (let index = 1; index < sorted.length; index += 1) {
    const distance = sorted[index]!;
    if (distance - regionEnd <= regionGapMeters) {
      regionEnd = distance;
      continue;
    }
    regions.push({ centerDistance: (regionStart + regionEnd) / 2 });
    regionStart = distance;
    regionEnd = distance;
  }
  regions.push({ centerDistance: (regionStart + regionEnd) / 2 });
  return regions;
}

function detectSelfOverlapZones(
  segments: RouteSegment[],
  totalLength: number,
  options: {
    reversalBearingThreshold: number;
    crossingBearingThreshold: number;
    selfOverlapProximityMeters: number;
    corridorOverlapMaxSeparationMeters: number;
    corridorOverlapRegionGapMeters: number;
    selfOverlapMinRouteSeparationMeters: number;
    endpointExclusionMeters: number;
  },
): AmbiguityZone[] {
  const crossingZones: AmbiguityZone[] = [];
  const corridorHitDistances: number[] = [];

  for (let laterIndex = 0; laterIndex < segments.length; laterIndex += 1) {
    const later = segments[laterIndex]!;
    const laterMidDistance = (later.startDistance + later.endDistance) / 2;
    const laterBearing = bearingDegrees(later.start, later.end);

    for (let earlierIndex = 0; earlierIndex < laterIndex; earlierIndex += 1) {
      const earlier = segments[earlierIndex]!;
      const earlierMidDistance = (earlier.startDistance + earlier.endDistance) / 2;
      if (laterMidDistance - earlierMidDistance < options.selfOverlapMinRouteSeparationMeters) {
        continue;
      }
      if (isLoopClosureOverlap(earlier, later, totalLength, options.endpointExclusionMeters)) {
        continue;
      }

      const endpointSeparation = minEndpointSeparationMeters(earlier, later);
      const corridorSeparation = corridorSeparationMeters(earlier, later);
      const earlierBearing = bearingDegrees(earlier.start, earlier.end);
      const bearingDelta = bearingDifferenceDegrees(earlierBearing, laterBearing);

      const endpointsCoincident = endpointSeparation <= 1;
      if (endpointsCoincident) {
        if (laterIndex - earlierIndex <= 1) {
          continue;
        }
        if (bearingDelta < options.crossingBearingThreshold) {
          continue;
        }
        crossingZones.push({ centerDistance: later.startDistance });
        break;
      }

      if (corridorSeparation > options.corridorOverlapMaxSeparationMeters) {
        continue;
      }
      if (bearingDelta < options.reversalBearingThreshold) {
        continue;
      }

      corridorHitDistances.push(later.startDistance);
      break;
    }
  }

  return [
    ...crossingZones,
    ...collapseCorridorOverlapRegions(corridorHitDistances, options.corridorOverlapRegionGapMeters),
  ];
}

function mergeAmbiguityZones(zones: AmbiguityZone[], mergeDistanceMeters: number): AmbiguityZone[] {
  if (zones.length === 0) {
    return [];
  }

  const sorted = [...zones].sort((left, right) => left.centerDistance - right.centerDistance);
  const merged: AmbiguityZone[] = [sorted[0]!];

  for (let index = 1; index < sorted.length; index += 1) {
    const zone = sorted[index]!;
    const previous = merged[merged.length - 1]!;
    if (zone.centerDistance - previous.centerDistance <= mergeDistanceMeters) {
      previous.centerDistance = (previous.centerDistance + zone.centerDistance) / 2;
      continue;
    }
    merged.push({ centerDistance: zone.centerDistance });
  }

  return merged;
}

function markerCountForLength(
  totalMeters: number,
  minMarkers: number,
  maxMarkers: number,
  minRouteLengthMeters: number,
  targetSpacingMeters: number,
): number {
  if (totalMeters < minRouteLengthMeters) {
    return 0;
  }
  const bySpacing = Math.round(totalMeters / targetSpacingMeters);
  return Math.max(minMarkers, Math.min(maxMarkers, bySpacing));
}

function buildPairedMarkerCandidates(
  zones: AmbiguityZone[],
  totalLength: number,
  offsetMeters: number,
  beforeKind: DirectionMarkerKind,
  afterKind: DirectionMarkerKind,
  priority: number,
): ResolvedMarkerCandidate[] {
  const candidates: ResolvedMarkerCandidate[] = [];

  for (const zone of zones) {
    const beforeDistance = Math.max(0, zone.centerDistance - offsetMeters);
    const afterDistance = Math.min(totalLength, zone.centerDistance + offsetMeters);
    candidates.push({
      distanceMeters: beforeDistance,
      kind: beforeKind,
      priority,
    });
    candidates.push({
      distanceMeters: afterDistance,
      kind: afterKind,
      priority,
    });
  }

  return candidates;
}

function isNearExistingCandidate(
  distanceMeters: number,
  candidates: ResolvedMarkerCandidate[],
  minMarkerSeparationMeters: number,
): boolean {
  return candidates.some(
    (candidate) => Math.abs(candidate.distanceMeters - distanceMeters) < minMarkerSeparationMeters,
  );
}

function buildBaselineMarkerCandidates(
  placementStart: number,
  placementEnd: number,
  baselineCount: number,
  existing: ResolvedMarkerCandidate[],
  minMarkerSeparationMeters: number,
): ResolvedMarkerCandidate[] {
  if (baselineCount <= 0 || placementEnd <= placementStart) {
    return [];
  }

  const span = placementEnd - placementStart;
  const step = span / (baselineCount + 1);
  const candidates: ResolvedMarkerCandidate[] = [];

  for (let index = 1; index <= baselineCount; index += 1) {
    const distance = placementStart + step * index;
    if (isNearExistingCandidate(distance, existing, minMarkerSeparationMeters)) {
      continue;
    }
    if (isNearExistingCandidate(distance, candidates, minMarkerSeparationMeters)) {
      continue;
    }
    candidates.push({
      distanceMeters: distance,
      kind: 'regular',
      priority: 0,
    });
  }

  return candidates;
}

/** Groups sorted paired markers into before/after pairs when possible. */
function groupBeforeAfterPairs(
  markers: ResolvedMarkerCandidate[],
  beforeKind: DirectionMarkerKind,
  afterKind: DirectionMarkerKind,
): ResolvedMarkerCandidate[][] {
  const pairs: ResolvedMarkerCandidate[][] = [];
  const used = new Set<number>();

  for (let index = 0; index < markers.length; index += 1) {
    if (used.has(index)) {
      continue;
    }
    const candidate = markers[index]!;
    if (candidate.kind === beforeKind) {
      const afterIndex = markers.findIndex(
        (other, otherIndex) =>
          otherIndex > index && !used.has(otherIndex) && other.kind === afterKind,
      );
      if (afterIndex >= 0) {
        used.add(index);
        used.add(afterIndex);
        pairs.push([candidate, markers[afterIndex]!]);
        continue;
      }
    }
    used.add(index);
    pairs.push([candidate]);
  }

  return pairs;
}

/** Picks up to `count` items evenly along an ordered list (includes ends when count > 1). */
function evenlyPick<T>(items: readonly T[], count: number): T[] {
  if (count <= 0 || items.length === 0) {
    return [];
  }
  if (items.length <= count) {
    return [...items];
  }
  if (count === 1) {
    return [items[Math.floor((items.length - 1) / 2)]!];
  }

  const picked: T[] = [];
  for (let index = 0; index < count; index += 1) {
    const position = Math.round((index * (items.length - 1)) / (count - 1));
    picked.push(items[position]!);
  }
  return picked;
}

function fillLargeGaps(
  candidates: ResolvedMarkerCandidate[],
  maxGapMeters: number,
  maxMarkers: number,
  minMarkerSeparationMeters: number,
  placementStart: number,
  placementEnd: number,
): ResolvedMarkerCandidate[] {
  if (maxGapMeters <= 0 || placementEnd <= placementStart) {
    return candidates;
  }

  const filled = [...candidates].sort((left, right) => left.distanceMeters - right.distanceMeters);

  while (filled.length < maxMarkers) {
    const distances = [
      placementStart,
      ...filled.map((candidate) => candidate.distanceMeters),
      placementEnd,
    ];
    let worstGap = 0;
    let worstLeft = placementStart;
    let worstRight = placementEnd;

    for (let index = 0; index < distances.length - 1; index += 1) {
      const left = distances[index]!;
      const right = distances[index + 1]!;
      const gap = right - left;
      if (gap > worstGap) {
        worstGap = gap;
        worstLeft = left;
        worstRight = right;
      }
    }

    if (worstGap <= maxGapMeters) {
      break;
    }

    const midpoint = (worstLeft + worstRight) / 2;
    if (isNearExistingCandidate(midpoint, filled, minMarkerSeparationMeters)) {
      // Cannot place at midpoint; try stepping inward from the larger gap edges.
      const step = Math.max(minMarkerSeparationMeters, worstGap / 3);
      const candidatesToTry = [worstLeft + step, worstRight - step, midpoint];
      let inserted = false;
      for (const distance of candidatesToTry) {
        if (
          distance <= placementStart ||
          distance >= placementEnd ||
          isNearExistingCandidate(distance, filled, minMarkerSeparationMeters)
        ) {
          continue;
        }
        filled.push({
          distanceMeters: distance,
          kind: 'regular',
          priority: 0,
        });
        inserted = true;
        break;
      }
      if (!inserted) {
        break;
      }
    } else {
      filled.push({
        distanceMeters: midpoint,
        kind: 'regular',
        priority: 0,
      });
    }

    filled.sort((left, right) => left.distanceMeters - right.distanceMeters);
  }

  return filled;
}

function resolveMarkerCollisions(
  candidates: ResolvedMarkerCandidate[],
  maxMarkers: number,
  minMarkerSeparationMeters: number,
): ResolvedMarkerCandidate[] {
  const sorted = [...candidates].sort((left, right) => {
    if (left.distanceMeters !== right.distanceMeters) {
      return left.distanceMeters - right.distanceMeters;
    }
    return right.priority - left.priority;
  });

  const resolved: ResolvedMarkerCandidate[] = [];

  for (const candidate of sorted) {
    const collides = resolved.some(
      (existing) =>
        Math.abs(existing.distanceMeters - candidate.distanceMeters) < minMarkerSeparationMeters,
    );
    if (collides) {
      const existingIndex = resolved.findIndex(
        (existing) =>
          Math.abs(existing.distanceMeters - candidate.distanceMeters) < minMarkerSeparationMeters,
      );
      if (existingIndex >= 0 && candidate.priority > resolved[existingIndex]!.priority) {
        resolved[existingIndex] = candidate;
      }
      continue;
    }
    resolved.push(candidate);
  }

  if (resolved.length <= maxMarkers) {
    return resolved.sort((left, right) => left.distanceMeters - right.distanceMeters);
  }

  const ambiguity = resolved
    .filter(
      (candidate) => candidate.kind === 'ambiguity-before' || candidate.kind === 'ambiguity-after',
    )
    .sort((left, right) => left.distanceMeters - right.distanceMeters);
  const turns = resolved
    .filter((candidate) => candidate.kind === 'turn-before' || candidate.kind === 'turn-after')
    .sort((left, right) => left.distanceMeters - right.distanceMeters);
  const regular = resolved
    .filter((candidate) => candidate.kind === 'regular')
    .sort((left, right) => left.distanceMeters - right.distanceMeters);

  const ambiguityPairs = groupBeforeAfterPairs(ambiguity, 'ambiguity-before', 'ambiguity-after');
  const turnPairs = groupBeforeAfterPairs(turns, 'turn-before', 'turn-after');

  const maxAmbiguityPairs = Math.max(0, Math.floor(maxMarkers / 2));
  const selectedAmbiguity = evenlyPick(ambiguityPairs, maxAmbiguityPairs);
  const kept: ResolvedMarkerCandidate[] = selectedAmbiguity.flat();

  const remainingForTurns = Math.max(0, maxMarkers - kept.length);
  const maxTurnPairs = Math.max(0, Math.floor(remainingForTurns / 2));
  const selectedTurns = evenlyPick(turnPairs, maxTurnPairs);
  kept.push(...selectedTurns.flat());

  for (const candidate of regular) {
    if (kept.length >= maxMarkers) {
      break;
    }
    if (
      kept.some(
        (existing) =>
          Math.abs(existing.distanceMeters - candidate.distanceMeters) < minMarkerSeparationMeters,
      )
    ) {
      continue;
    }
    kept.push(candidate);
  }

  return kept
    .sort((left, right) => left.distanceMeters - right.distanceMeters)
    .slice(0, maxMarkers);
}

export type SampleDirectionMarkersOptions = {
  minMarkers?: number;
  maxMarkers?: number;
  targetSpacingMeters?: number;
  maxGapMeters?: number;
  endpointExclusionFraction?: number;
  startExclusionMeters?: number;
  minRouteLengthMeters?: number;
  turnBearingThreshold?: number;
  reversalBearingThreshold?: number;
  ambiguityMarkerOffsetMeters?: number;
  turnMarkerOffsetMeters?: number;
  ambiguityMergeDistanceMeters?: number;
  turnMergeDistanceMeters?: number;
  selfOverlapProximityMeters?: number;
  corridorOverlapMaxSeparationMeters?: number;
  corridorOverlapRegionGapMeters?: number;
  selfOverlapMinRouteSeparationMeters?: number;
  crossingBearingThreshold?: number;
  minMarkerSeparationMeters?: number;
  minSpatialSeparationMeters?: number;
};

function markerKindPriority(kind: DirectionMarkerKind): number {
  if (kind === 'ambiguity-before' || kind === 'ambiguity-after') {
    return 2;
  }
  if (kind === 'turn-before' || kind === 'turn-after') {
    return 1;
  }
  return 0;
}

function isIntentionalPair(left: DirectionMarkerKind, right: DirectionMarkerKind): boolean {
  return (
    (left === 'ambiguity-before' && right === 'ambiguity-after') ||
    (left === 'ambiguity-after' && right === 'ambiguity-before') ||
    (left === 'turn-before' && right === 'turn-after') ||
    (left === 'turn-after' && right === 'turn-before')
  );
}

/**
 * Drops markers that land on top of an already-kept marker geographically.
 * Earlier travel-order markers win; ambiguity markers replace a nearby regular.
 * Intentional before/after ambiguity pairs are kept even when geographically tight.
 */
function suppressSpatiallyOverlappingMarkers(
  markers: DirectionMarker[],
  minSpatialSeparationMeters: number,
): DirectionMarker[] {
  if (markers.length === 0 || minSpatialSeparationMeters <= 0) {
    return markers;
  }

  const kept: DirectionMarker[] = [];

  for (const marker of markers) {
    const collidingIndex = kept.findIndex(
      (existing) =>
        segmentLengthMeters([existing.lon, existing.lat], [marker.lon, marker.lat]) <
        minSpatialSeparationMeters,
    );
    if (collidingIndex < 0) {
      kept.push(marker);
      continue;
    }

    const existing = kept[collidingIndex]!;
    if (isIntentionalPair(existing.kind, marker.kind)) {
      kept.push(marker);
      continue;
    }

    if (markerKindPriority(marker.kind) > markerKindPriority(existing.kind)) {
      kept[collidingIndex] = marker;
    }
  }

  return kept
    .sort((left, right) => left.distanceMeters - right.distanceMeters)
    .map((marker, index) => ({ ...marker, sequence: index + 1 }));
}

/**
 * Places numbered direction markers along a route. Ambiguity zones (reversals and
 * self-overlaps) receive paired before/after markers; remaining capacity is filled
 * with evenly spaced baseline markers. Coordinates must be in travel order.
 */
export function sampleDirectionMarkers(
  coordinates: readonly LonLat[],
  options: SampleDirectionMarkersOptions = {},
): DirectionMarker[] {
  const minMarkers = options.minMarkers ?? ROUTE_DIRECTION_DEFAULTS.minMarkers;
  const maxMarkers = options.maxMarkers ?? ROUTE_DIRECTION_DEFAULTS.maxMarkers;
  const targetSpacingMeters =
    options.targetSpacingMeters ?? ROUTE_DIRECTION_DEFAULTS.targetSpacingMeters;
  const maxGapMeters = options.maxGapMeters ?? ROUTE_DIRECTION_DEFAULTS.maxGapMeters;
  const endpointExclusionFraction =
    options.endpointExclusionFraction ?? ROUTE_DIRECTION_DEFAULTS.endpointExclusionFraction;
  const startExclusionMeters =
    options.startExclusionMeters ?? ROUTE_DIRECTION_DEFAULTS.startExclusionMeters;
  const minRouteLengthMeters =
    options.minRouteLengthMeters ?? ROUTE_DIRECTION_DEFAULTS.minRouteLengthMeters;
  const turnBearingThreshold =
    options.turnBearingThreshold ?? ROUTE_DIRECTION_DEFAULTS.turnBearingThreshold;
  const reversalBearingThreshold =
    options.reversalBearingThreshold ?? ROUTE_DIRECTION_DEFAULTS.reversalBearingThreshold;
  const ambiguityMarkerOffsetMeters =
    options.ambiguityMarkerOffsetMeters ?? ROUTE_DIRECTION_DEFAULTS.ambiguityMarkerOffsetMeters;
  const turnMarkerOffsetMeters =
    options.turnMarkerOffsetMeters ?? ROUTE_DIRECTION_DEFAULTS.turnMarkerOffsetMeters;
  const ambiguityMergeDistanceMeters =
    options.ambiguityMergeDistanceMeters ?? ROUTE_DIRECTION_DEFAULTS.ambiguityMergeDistanceMeters;
  const turnMergeDistanceMeters =
    options.turnMergeDistanceMeters ?? ROUTE_DIRECTION_DEFAULTS.turnMergeDistanceMeters;
  const selfOverlapProximityMeters =
    options.selfOverlapProximityMeters ?? ROUTE_DIRECTION_DEFAULTS.selfOverlapProximityMeters;
  const corridorOverlapMaxSeparationMeters =
    options.corridorOverlapMaxSeparationMeters ??
    ROUTE_DIRECTION_DEFAULTS.corridorOverlapMaxSeparationMeters;
  const corridorOverlapRegionGapMeters =
    options.corridorOverlapRegionGapMeters ??
    ROUTE_DIRECTION_DEFAULTS.corridorOverlapRegionGapMeters;
  const selfOverlapMinRouteSeparationMeters =
    options.selfOverlapMinRouteSeparationMeters ??
    ROUTE_DIRECTION_DEFAULTS.selfOverlapMinRouteSeparationMeters;
  const crossingBearingThreshold =
    options.crossingBearingThreshold ?? ROUTE_DIRECTION_DEFAULTS.crossingBearingThreshold;
  const minMarkerSeparationMeters =
    options.minMarkerSeparationMeters ?? ROUTE_DIRECTION_DEFAULTS.minMarkerSeparationMeters;
  const minSpatialSeparationMeters =
    options.minSpatialSeparationMeters ?? ROUTE_DIRECTION_DEFAULTS.minSpatialSeparationMeters;

  if (coordinates.length < 2) {
    return [];
  }

  const segments = buildSegments(coordinates);
  const totalLength = segments.length === 0 ? 0 : segments[segments.length - 1]!.endDistance;
  if (totalLength < minRouteLengthMeters) {
    return [];
  }

  const markerBudget = markerCountForLength(
    totalLength,
    minMarkers,
    maxMarkers,
    minRouteLengthMeters,
    targetSpacingMeters,
  );
  if (markerBudget === 0) {
    return [];
  }

  const endpointExclusionMeters = totalLength * endpointExclusionFraction;
  const placementStart = Math.max(endpointExclusionMeters, startExclusionMeters);
  const placementEnd = totalLength - endpointExclusionMeters;
  if (placementEnd <= placementStart) {
    return [];
  }

  const reversalZones = detectReversalZones(segments, reversalBearingThreshold);
  const turnZones = detectTurnZones(segments, turnBearingThreshold, reversalBearingThreshold);
  const overlapZones = detectSelfOverlapZones(segments, totalLength, {
    reversalBearingThreshold,
    crossingBearingThreshold,
    selfOverlapProximityMeters,
    corridorOverlapMaxSeparationMeters,
    corridorOverlapRegionGapMeters,
    selfOverlapMinRouteSeparationMeters,
    endpointExclusionMeters,
  });
  const mergedReversal = mergeAmbiguityZones(reversalZones, ambiguityMergeDistanceMeters);
  const supplementalOverlaps = overlapZones.filter(
    (overlap) =>
      !mergedReversal.some(
        (reversal) =>
          Math.abs(reversal.centerDistance - overlap.centerDistance) <=
          ambiguityMergeDistanceMeters,
      ),
  );
  const ambiguityZones = mergeAmbiguityZones(
    [...mergedReversal, ...supplementalOverlaps],
    ambiguityMergeDistanceMeters,
  );
  const mergedTurns = mergeAmbiguityZones(turnZones, turnMergeDistanceMeters).filter(
    (turn) =>
      !ambiguityZones.some(
        (ambiguity) =>
          Math.abs(ambiguity.centerDistance - turn.centerDistance) <= turnMergeDistanceMeters,
      ),
  );

  const ambiguityCandidates = buildPairedMarkerCandidates(
    ambiguityZones,
    totalLength,
    ambiguityMarkerOffsetMeters,
    'ambiguity-before',
    'ambiguity-after',
    2,
  );
  const turnCandidates = buildPairedMarkerCandidates(
    mergedTurns,
    totalLength,
    turnMarkerOffsetMeters,
    'turn-before',
    'turn-after',
    1,
  );
  const priorityCandidates = [...ambiguityCandidates, ...turnCandidates];
  const baselineCount = Math.max(0, markerBudget - priorityCandidates.length);
  const baselineCandidates = buildBaselineMarkerCandidates(
    placementStart,
    placementEnd,
    baselineCount,
    priorityCandidates,
    minMarkerSeparationMeters,
  );

  const resolvedCandidates = resolveMarkerCollisions(
    [...priorityCandidates, ...baselineCandidates],
    maxMarkers,
    minMarkerSeparationMeters,
  );
  const gapFilledCandidates = fillLargeGaps(
    resolvedCandidates,
    maxGapMeters,
    maxMarkers,
    minMarkerSeparationMeters,
    placementStart,
    placementEnd,
  );

  const markers: DirectionMarker[] = [];
  for (let index = 0; index < gapFilledCandidates.length; index += 1) {
    const candidate = gapFilledCandidates[index]!;
    const located = lookupPointAtRouteDistance(segments, candidate.distanceMeters);
    if (!located) {
      continue;
    }
    markers.push({
      lon: located.point[0],
      lat: located.point[1],
      bearing: located.bearing,
      sequence: index + 1,
      distanceMeters: located.distanceMeters,
      progress: totalLength === 0 ? 0 : located.distanceMeters / totalLength,
      kind: candidate.kind,
    });
  }

  return suppressSpatiallyOverlappingMarkers(markers, minSpatialSeparationMeters);
}

/** Rotation for a chevron that points east at 0° (Unicode ▶). */
export function chevronRotationDegrees(bearing: number): number {
  return bearing - 90;
}

/**
 * Progress color for direction markers: green near the start, yellow mid-route,
 * red near the finish. `progress` is clamped to 0–1.
 */
export function directionMarkerProgressColor(progress: number): string {
  const clamped = Math.max(0, Math.min(1, progress));
  // Hue: 120 (green) → 60 (yellow) → 0 (red).
  const hue = (1 - clamped) * 120;
  return `hsl(${hue.toFixed(1)} 70% 36%)`;
}

/** Arrow/ink contrast for a progress-tinted disc (dark on yellow, light elsewhere). */
export function directionMarkerProgressInk(progress: number): string {
  const clamped = Math.max(0, Math.min(1, progress));
  return clamped > 0.28 && clamped < 0.62 ? '#0a1510' : '#f5fff9';
}

export function directionMarkerAccessibleLabel(marker: DirectionMarker): string {
  if (marker.kind === 'ambiguity-before') {
    return `Direction ${marker.sequence}, before route reversal.`;
  }
  if (marker.kind === 'ambiguity-after') {
    return `Direction ${marker.sequence}, after route reversal.`;
  }
  if (marker.kind === 'turn-before') {
    return `Direction ${marker.sequence}, approaching turn.`;
  }
  if (marker.kind === 'turn-after') {
    return `Direction ${marker.sequence}, after turn.`;
  }
  return `Direction ${marker.sequence}.`;
}

function markerModifierClass(kind: DirectionMarkerKind): string {
  if (kind === 'ambiguity-before') {
    return ' route-direction-badge--ambiguity-before';
  }
  if (kind === 'ambiguity-after') {
    return ' route-direction-badge--ambiguity-after';
  }
  if (kind === 'turn-before') {
    return ' route-direction-badge--turn-before';
  }
  if (kind === 'turn-after') {
    return ' route-direction-badge--turn-after';
  }
  return '';
}

export type DirectionBadgeHtmlOptions = {
  kind?: DirectionMarkerKind;
  progress?: number;
};

/** Builds HTML for a numbered direction badge (inner arrow element is rotated). */
export function directionBadgeHtml(
  sequence: number,
  bearing: number,
  kindOrOptions: DirectionMarkerKind | DirectionBadgeHtmlOptions = 'regular',
): string {
  const options: DirectionBadgeHtmlOptions =
    typeof kindOrOptions === 'string' ? { kind: kindOrOptions } : kindOrOptions;
  const kind = options.kind ?? 'regular';
  const progress = options.progress ?? 0;
  const fill = directionMarkerProgressColor(progress);
  const ink = directionMarkerProgressInk(progress);
  const rotation = chevronRotationDegrees(bearing);
  const modifier = markerModifierClass(kind);
  return `<div class="route-direction-badge${modifier}" style="--rv-direction-fill:${fill};--rv-direction-ink:${ink}" aria-hidden="true"><span class="route-direction-badge__disc"><span class="route-direction-badge__arrow" style="transform: rotate(${rotation}deg)">▶</span></span><span class="route-direction-badge__number">${sequence}</span></div>`;
}
