/** GeoJSON order: [longitude, latitude]. */
export type LonLat = [number, number];

export type DirectionMarkerKind = 'regular' | 'ambiguity-before' | 'ambiguity-after';

export type DirectionMarker = {
  lon: number;
  lat: number;
  /** Compass bearing in degrees (0 = north, 90 = east). */
  bearing: number;
  /** Travel-order sequence starting at 1. */
  sequence: number;
  /** Cumulative distance from route departure in meters. */
  distanceMeters: number;
  kind: DirectionMarkerKind;
};

export const ROUTE_DIRECTION_DEFAULTS = {
  minMarkers: 6,
  maxMarkers: 8,
  /** Exclude the first/last fraction of route length from baseline placement. */
  endpointExclusionFraction: 0.08,
  /** Minimum distance from departure before placing marker 1. */
  startExclusionMeters: 150,
  /** Minimum route length required before placing any arrow. */
  minRouteLengthMeters: 400,
  /** Minimum bearing change (degrees) to flag a reversal or self-overlap. */
  reversalBearingThreshold: 135,
  /** Distance before/after an ambiguity center for paired markers. */
  ambiguityMarkerOffsetMeters: 30,
  /** Merge ambiguity zones whose centers are closer than this. */
  ambiguityMergeDistanceMeters: 80,
  /** Spatial proximity for endpoint crossings in meters. */
  selfOverlapProximityMeters: 35,
  /** Maximum corridor separation for same-road out-and-back overlap. */
  corridorOverlapMaxSeparationMeters: 15,
  /** Minimum along-route separation before comparing segments for overlap. */
  selfOverlapMinRouteSeparationMeters: 120,
  /** Bearing change for endpoint-adjacent crossings (figure-eight, junctions). */
  crossingBearingThreshold: 45,
  /** Suppress markers closer than this along the route. */
  minMarkerSeparationMeters: 45,
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

function detectSelfOverlapZones(
  segments: RouteSegment[],
  totalLength: number,
  options: {
    reversalBearingThreshold: number;
    crossingBearingThreshold: number;
    selfOverlapProximityMeters: number;
    corridorOverlapMaxSeparationMeters: number;
    selfOverlapMinRouteSeparationMeters: number;
    endpointExclusionMeters: number;
  },
): AmbiguityZone[] {
  const zones: AmbiguityZone[] = [];

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
        zones.push({ centerDistance: later.startDistance });
        break;
      }

      if (corridorSeparation > options.corridorOverlapMaxSeparationMeters) {
        continue;
      }
      if (bearingDelta < options.reversalBearingThreshold) {
        continue;
      }

      zones.push({ centerDistance: later.startDistance });
      break;
    }
  }

  return zones;
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
): number {
  if (totalMeters < minRouteLengthMeters) {
    return 0;
  }
  const scaled = Math.round(minMarkers + (totalMeters / 20_000) * (maxMarkers - minMarkers));
  return Math.max(minMarkers, Math.min(maxMarkers, scaled));
}

function buildAmbiguityMarkerCandidates(
  zones: AmbiguityZone[],
  totalLength: number,
  ambiguityMarkerOffsetMeters: number,
): ResolvedMarkerCandidate[] {
  const candidates: ResolvedMarkerCandidate[] = [];

  for (const zone of zones) {
    const beforeDistance = Math.max(0, zone.centerDistance - ambiguityMarkerOffsetMeters);
    const afterDistance = Math.min(totalLength, zone.centerDistance + ambiguityMarkerOffsetMeters);
    candidates.push({
      distanceMeters: beforeDistance,
      kind: 'ambiguity-before',
      priority: 2,
    });
    candidates.push({
      distanceMeters: afterDistance,
      kind: 'ambiguity-after',
      priority: 2,
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
    .filter((candidate) => candidate.kind !== 'regular')
    .sort((left, right) => left.distanceMeters - right.distanceMeters);
  const regular = resolved
    .filter((candidate) => candidate.kind === 'regular')
    .sort((left, right) => left.distanceMeters - right.distanceMeters);

  const kept = [...ambiguity];
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

  return kept.sort((left, right) => left.distanceMeters - right.distanceMeters);
}

export type SampleDirectionMarkersOptions = {
  minMarkers?: number;
  maxMarkers?: number;
  endpointExclusionFraction?: number;
  startExclusionMeters?: number;
  minRouteLengthMeters?: number;
  reversalBearingThreshold?: number;
  ambiguityMarkerOffsetMeters?: number;
  ambiguityMergeDistanceMeters?: number;
  selfOverlapProximityMeters?: number;
  corridorOverlapMaxSeparationMeters?: number;
  selfOverlapMinRouteSeparationMeters?: number;
  crossingBearingThreshold?: number;
  minMarkerSeparationMeters?: number;
};

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
  const endpointExclusionFraction =
    options.endpointExclusionFraction ?? ROUTE_DIRECTION_DEFAULTS.endpointExclusionFraction;
  const startExclusionMeters =
    options.startExclusionMeters ?? ROUTE_DIRECTION_DEFAULTS.startExclusionMeters;
  const minRouteLengthMeters =
    options.minRouteLengthMeters ?? ROUTE_DIRECTION_DEFAULTS.minRouteLengthMeters;
  const reversalBearingThreshold =
    options.reversalBearingThreshold ?? ROUTE_DIRECTION_DEFAULTS.reversalBearingThreshold;
  const ambiguityMarkerOffsetMeters =
    options.ambiguityMarkerOffsetMeters ?? ROUTE_DIRECTION_DEFAULTS.ambiguityMarkerOffsetMeters;
  const ambiguityMergeDistanceMeters =
    options.ambiguityMergeDistanceMeters ?? ROUTE_DIRECTION_DEFAULTS.ambiguityMergeDistanceMeters;
  const selfOverlapProximityMeters =
    options.selfOverlapProximityMeters ?? ROUTE_DIRECTION_DEFAULTS.selfOverlapProximityMeters;
  const corridorOverlapMaxSeparationMeters =
    options.corridorOverlapMaxSeparationMeters ??
    ROUTE_DIRECTION_DEFAULTS.corridorOverlapMaxSeparationMeters;
  const selfOverlapMinRouteSeparationMeters =
    options.selfOverlapMinRouteSeparationMeters ??
    ROUTE_DIRECTION_DEFAULTS.selfOverlapMinRouteSeparationMeters;
  const crossingBearingThreshold =
    options.crossingBearingThreshold ?? ROUTE_DIRECTION_DEFAULTS.crossingBearingThreshold;
  const minMarkerSeparationMeters =
    options.minMarkerSeparationMeters ?? ROUTE_DIRECTION_DEFAULTS.minMarkerSeparationMeters;

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
  const overlapZones = detectSelfOverlapZones(segments, totalLength, {
    reversalBearingThreshold,
    crossingBearingThreshold,
    selfOverlapProximityMeters,
    corridorOverlapMaxSeparationMeters,
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

  const ambiguityCandidates = buildAmbiguityMarkerCandidates(
    ambiguityZones,
    totalLength,
    ambiguityMarkerOffsetMeters,
  );
  const baselineCount = Math.max(0, markerBudget - ambiguityCandidates.length);
  const baselineCandidates = buildBaselineMarkerCandidates(
    placementStart,
    placementEnd,
    baselineCount,
    ambiguityCandidates,
    minMarkerSeparationMeters,
  );

  const resolvedCandidates = resolveMarkerCollisions(
    [...ambiguityCandidates, ...baselineCandidates],
    maxMarkers,
    minMarkerSeparationMeters,
  );

  const markers: DirectionMarker[] = [];
  for (let index = 0; index < resolvedCandidates.length; index += 1) {
    const candidate = resolvedCandidates[index]!;
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
      kind: candidate.kind,
    });
  }

  return markers;
}

/** Rotation for a chevron that points east at 0° (Unicode ▶). */
export function chevronRotationDegrees(bearing: number): number {
  return bearing - 90;
}

export function directionMarkerAccessibleLabel(marker: DirectionMarker): string {
  if (marker.kind === 'ambiguity-before') {
    return `Direction ${marker.sequence}, before route reversal.`;
  }
  if (marker.kind === 'ambiguity-after') {
    return `Direction ${marker.sequence}, after route reversal.`;
  }
  return `Direction ${marker.sequence}.`;
}

function ambiguityModifierClass(kind: DirectionMarkerKind): string {
  if (kind === 'ambiguity-before') {
    return ' route-direction-badge--ambiguity-before';
  }
  if (kind === 'ambiguity-after') {
    return ' route-direction-badge--ambiguity-after';
  }
  return '';
}

/** Builds HTML for a numbered direction badge (inner arrow element is rotated). */
export function directionBadgeHtml(
  sequence: number,
  bearing: number,
  kind: DirectionMarkerKind = 'regular',
): string {
  const rotation = chevronRotationDegrees(bearing);
  const modifier = ambiguityModifierClass(kind);
  return `<div class="route-direction-badge${modifier}" aria-hidden="true"><span class="route-direction-badge__disc"><span class="route-direction-badge__arrow" style="transform: rotate(${rotation}deg)">▶</span></span><span class="route-direction-badge__number">${sequence}</span></div>`;
}
