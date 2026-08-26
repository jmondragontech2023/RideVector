/** GeoJSON order: [longitude, latitude]. */
export type LonLat = [number, number];

export type DirectionMarker = {
  lon: number;
  lat: number;
  /** Compass bearing in degrees (0 = north, 90 = east). */
  bearing: number;
  /** Travel-order sequence starting at 1. */
  sequence: number;
  /** Cumulative distance from route departure in meters. */
  distanceMeters: number;
};

export const ROUTE_DIRECTION_DEFAULTS = {
  minMarkers: 6,
  maxMarkers: 8,
  /** Exclude the first/last fraction of route length from arrow placement. */
  endpointExclusionFraction: 0.08,
  /** Minimum route length required before placing any arrow. */
  minRouteLengthMeters: 400,
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

function pointAtDistance(
  segments: RouteSegment[],
  distanceMeters: number,
): { point: LonLat; bearing: number; distanceMeters: number } | null {
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

export type SampleDirectionMarkersOptions = {
  minMarkers?: number;
  maxMarkers?: number;
  endpointExclusionFraction?: number;
  minRouteLengthMeters?: number;
};

/**
 * Places numbered direction markers at equal cumulative-distance intervals along a route.
 * Coordinates must be in travel order.
 */
export function sampleDirectionMarkers(
  coordinates: readonly LonLat[],
  options: SampleDirectionMarkersOptions = {},
): DirectionMarker[] {
  const minMarkers = options.minMarkers ?? ROUTE_DIRECTION_DEFAULTS.minMarkers;
  const maxMarkers = options.maxMarkers ?? ROUTE_DIRECTION_DEFAULTS.maxMarkers;
  const endpointExclusionFraction =
    options.endpointExclusionFraction ?? ROUTE_DIRECTION_DEFAULTS.endpointExclusionFraction;
  const minRouteLengthMeters =
    options.minRouteLengthMeters ?? ROUTE_DIRECTION_DEFAULTS.minRouteLengthMeters;

  if (coordinates.length < 2) {
    return [];
  }

  const segments = buildSegments(coordinates);
  const totalLength = segments.length === 0 ? 0 : segments[segments.length - 1]!.endDistance;
  if (totalLength < minRouteLengthMeters) {
    return [];
  }

  const markerCount = markerCountForLength(
    totalLength,
    minMarkers,
    maxMarkers,
    minRouteLengthMeters,
  );
  if (markerCount === 0) {
    return [];
  }

  const exclusion = totalLength * endpointExclusionFraction;
  const placementStart = exclusion;
  const placementEnd = totalLength - exclusion;
  const placementSpan = placementEnd - placementStart;

  if (placementSpan <= 0) {
    return [];
  }

  const step = placementSpan / (markerCount + 1);
  const markers: DirectionMarker[] = [];

  for (let sequence = 1; sequence <= markerCount; sequence += 1) {
    const distance = placementStart + step * sequence;
    const located = pointAtDistance(segments, distance);
    if (!located) {
      continue;
    }
    markers.push({
      lon: located.point[0],
      lat: located.point[1],
      bearing: located.bearing,
      sequence,
      distanceMeters: located.distanceMeters,
    });
  }

  return markers;
}

/** Rotation for a chevron that points east at 0° (Unicode ▶). */
export function chevronRotationDegrees(bearing: number): number {
  return bearing - 90;
}

/** Builds HTML for a numbered direction badge (inner arrow element is rotated). */
export function directionBadgeHtml(sequence: number, bearing: number): string {
  const rotation = chevronRotationDegrees(bearing);
  return `<div class="route-direction-badge" aria-hidden="true"><span class="route-direction-badge__disc"><span class="route-direction-badge__arrow" style="transform: rotate(${rotation}deg)">▶</span></span><span class="route-direction-badge__number">${sequence}</span></div>`;
}
