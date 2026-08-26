import { POC_CONFIG, type PocCostingMode } from '../config';
import type {
  RouteLoopRequest,
  RouteLoopResult,
  RoutingProvider,
} from './provider';
import { decodePolyline } from './polyline';

type ValhallaLocation = { lat: number; lon: number; type?: string };

type ValhallaRouteBody = {
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

type ValhallaResponse = {
  trip?: {
    legs?: ValhallaLeg[];
    summary?: ValhallaTripSummary;
    units?: string;
  };
  error?: string;
  error_code?: number;
};

function costingOptionsFor(mode: PocCostingMode): Record<string, string | number> {
  return mode === 'road' ? { ...POC_CONFIG.roadCostingOptions } : { ...POC_CONFIG.gravelCostingOptions };
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
      // Avoid duplicating shared vertices between legs.
      coordinates.push(...decoded.slice(1));
    } else {
      coordinates.push(...decoded);
    }
  }
  return coordinates.length >= 2 ? coordinates : null;
}

export type ValhallaProviderOptions = {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

/**
 * Valhalla-compatible HTTP adapter. Maps to provider-neutral POC types only.
 * Never returns raw upstream payloads or URLs to callers of generate.
 */
export class ValhallaRoutingProvider implements RoutingProvider {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: ValhallaProviderOptions) {
    const trimmed = options.baseUrl.replace(/\/+$/, '');
    this.baseUrl = trimmed;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? POC_CONFIG.timeoutMs;
  }

  async routeLoop(request: RouteLoopRequest): Promise<RouteLoopResult> {
    const locations: ValhallaLocation[] = [
      { lat: request.start.latitude, lon: request.start.longitude, type: 'break' },
      ...request.waypoints.map((wp) => ({
        lat: wp.latitude,
        lon: wp.longitude,
        type: 'break' as const,
      })),
      { lat: request.start.latitude, lon: request.start.longitude, type: 'break' },
    ];

    const body: ValhallaRouteBody = {
      locations,
      costing: 'bicycle',
      costing_options: {
        bicycle: costingOptionsFor(request.costing),
      },
      units: 'kilometers',
      shape_format: 'polyline6',
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const onAbort = () => controller.abort();
    request.signal?.addEventListener('abort', onAbort, { once: true });

    try {
      const response = await this.fetchImpl(`${this.baseUrl}/route`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        return {
          ok: false,
          reason: 'upstream_failure',
          message: `upstream status ${response.status}`,
        };
      }

      let payload: ValhallaResponse;
      try {
        payload = (await response.json()) as ValhallaResponse;
      } catch {
        return {
          ok: false,
          reason: 'malformed_geometry',
          message: 'upstream response was not JSON',
        };
      }

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
        geometry: {
          type: 'LineString',
          coordinates,
        },
        distanceMeters: (lengthKm as number) * 1000,
        durationSeconds: Math.round(timeSeconds as number),
      };
    } catch {
      return {
        ok: false,
        reason: 'upstream_failure',
        message: 'upstream request failed or timed out',
      };
    } finally {
      clearTimeout(timeout);
      request.signal?.removeEventListener('abort', onAbort);
    }
  }
}
