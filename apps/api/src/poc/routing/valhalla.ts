import { POC_CONFIG } from '../config';
import type { RouteLoopRequest, RouteLoopResult, RouteRequest, RoutingProvider } from './provider';
import {
  buildValhallaRouteBody,
  mapValhallaRouteResponse,
  valhallaUpstreamHeaders,
  type ValhallaResponse,
} from './valhalla-mapping';

export type ValhallaProviderOptions = {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  clientId?: string;
};

/**
 * Valhalla-compatible HTTP adapter. Maps to provider-neutral POC types only.
 * Never returns raw upstream payloads or URLs to callers.
 */
export class ValhallaRoutingProvider implements RoutingProvider {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly clientId: string;

  constructor(options: ValhallaProviderOptions) {
    const trimmed = options.baseUrl.replace(/\/+$/, '');
    this.baseUrl = trimmed;
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
    this.timeoutMs = options.timeoutMs ?? POC_CONFIG.timeoutMs;
    this.clientId = options.clientId ?? POC_CONFIG.valhallaClientId;
  }

  async route(request: RouteRequest): Promise<RouteLoopResult> {
    if (request.locations.length < 2) {
      return {
        ok: false,
        reason: 'malformed_geometry',
        message: 'At least two locations are required',
      };
    }

    const body = buildValhallaRouteBody(request.locations, request.costing ?? 'road');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const onAbort = () => controller.abort();
    request.signal?.addEventListener('abort', onAbort, { once: true });

    try {
      const response = await this.fetchImpl(`${this.baseUrl}/route`, {
        method: 'POST',
        headers: valhallaUpstreamHeaders(this.clientId),
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

      const mapped = mapValhallaRouteResponse(payload);
      if (!mapped.ok) {
        return mapped;
      }

      return {
        ok: true,
        geometry: mapped.route.geometry,
        distanceMeters: mapped.route.distanceMeters,
        durationSeconds: mapped.route.durationSeconds,
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

  async routeLoop(request: RouteLoopRequest): Promise<RouteLoopResult> {
    const locations = [request.start, ...request.waypoints, request.start];
    return this.route({
      locations,
      costing: request.costing,
      signal: request.signal,
    });
  }
}
