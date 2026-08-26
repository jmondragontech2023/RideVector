import { POC_CONFIG, type PocCostingMode } from '../config';
import type { PocCoordinate, PocLineString } from '../types';
import { decodePolyline } from './polyline';

/** Valhalla wire format; kept inside the adapter only. */
export type ValhallaLocation = { lat: number; lon: number; type?: string };

export type ValhallaRouteBody = {
  locations: ValhallaLocation[];
  costing: 'bicycle';
  costing_options: {
    bicycle: Record<string, string | number>;
  };
  units: 'kilometers';
  shape_format?: 'polyline6';
};

type ValhallaTripSummary = {
  length?: number;
  time?: number;
};

type ValhallaLeg = {
  shape?: string;
  summary?: ValhallaTripSummary;
};

export type ValhallaResponse = {
  trip?: {
    legs?: ValhallaLeg[];
    summary?: ValhallaTripSummary;
    units?: string;
  };
  error?: string;
  error_code?: number;
};

export type NormalizedRoute = {
  geometry: PocLineString;
  distanceMeters: number;
  durationSeconds: number;
};

function costingOptionsFor(mode: PocCostingMode): Record<string, string | number> {
  return mode === 'road'
    ? { ...POC_CONFIG.roadCostingOptions }
    : { ...POC_CONFIG.gravelCostingOptions };
}

/** Maps provider-neutral coordinates to Valhalla location breaks. */
export function toValhallaLocations(
  locations: readonly PocCoordinate[],
  locationType: 'break' | 'through' = 'break',
): ValhallaLocation[] {
  return locations.map((point) => ({
    lat: point.latitude,
    lon: point.longitude,
    type: locationType,
  }));
}

/** Builds a Valhalla /route JSON body for an ordered location list (2+ points). */
export function buildValhallaRouteBody(
  locations: readonly PocCoordinate[],
  costing: PocCostingMode = 'road',
): ValhallaRouteBody {
  if (locations.length < 2) {
    throw new Error('At least two locations are required');
  }
  return {
    locations: toValhallaLocations(locations),
    costing: 'bicycle',
    costing_options: {
      bicycle: costingOptionsFor(costing),
    },
    units: 'kilometers',
    shape_format: 'polyline6',
  };
}

function joinLegShapes(legs: ValhallaLeg[]): Array<[number, number]> | null {
  const coordinates: Array<[number, number]> = [];
  for (const leg of legs) {
    if (typeof leg.shape !== 'string' || leg.shape.length === 0) {
      return null;
    }
    const decoded = decodePolyline(leg.shape, 6);
    if (decoded.length === 0) {
      return null;
    }
    if (coordinates.length > 0) {
      coordinates.push(...decoded.slice(1));
    } else {
      coordinates.push(...decoded);
    }
  }
  return coordinates.length >= 2 ? coordinates : null;
}

/** Maps a Valhalla /route response into provider-neutral geometry and metrics. */
export function mapValhallaRouteResponse(
  payload: ValhallaResponse,
):
  | { ok: true; route: NormalizedRoute }
  | { ok: false; reason: 'upstream_failure' | 'malformed_geometry'; message: string } {
  if (payload.error || payload.error_code) {
    return {
      ok: false,
      reason: 'upstream_failure',
      message: 'upstream reported a routing error',
    };
  }

  const legs = payload.trip?.legs;
  if (!legs || legs.length === 0) {
    return {
      ok: false,
      reason: 'malformed_geometry',
      message: 'upstream response missing legs',
    };
  }

  const coordinates = joinLegShapes(legs);
  if (!coordinates) {
    return {
      ok: false,
      reason: 'malformed_geometry',
      message: 'unable to decode route geometry',
    };
  }

  const summary = payload.trip?.summary;
  const lengthKm = summary?.length;
  const timeSeconds = summary?.time;
  if (!Number.isFinite(lengthKm) || !Number.isFinite(timeSeconds)) {
    return {
      ok: false,
      reason: 'malformed_geometry',
      message: 'upstream summary missing length or time',
    };
  }

  return {
    ok: true,
    route: {
      geometry: { type: 'LineString', coordinates },
      distanceMeters: (lengthKm as number) * 1000,
      durationSeconds: Math.round(timeSeconds as number),
    },
  };
}

/** Headers sent to the configured Valhalla-compatible upstream. */
export function valhallaUpstreamHeaders(clientId: string): HeadersInit {
  return {
    'content-type': 'application/json',
    accept: 'application/json',
    'X-Client-Id': clientId,
  };
}
