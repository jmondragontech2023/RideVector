import type { PocCostingMode } from '../config';
import type { PocCoordinate, PocLineString } from '../types';

export type RouteLoopRequest = {
  start: PocCoordinate;
  waypoints: PocCoordinate[];
  costing: PocCostingMode;
  signal?: AbortSignal;
};

export type RouteLoopSuccess = {
  ok: true;
  geometry: PocLineString;
  distanceMeters: number;
  durationSeconds: number;
};

export type RouteLoopFailure = {
  ok: false;
  reason: 'upstream_failure' | 'malformed_geometry';
  message: string;
};

export type RouteLoopResult = RouteLoopSuccess | RouteLoopFailure;

/**
 * Thin routing-provider port. Valhalla (or compatible) adapters implement this.
 * Domain/POC types never include provider payloads or URLs.
 */
export interface RoutingProvider {
  routeLoop(request: RouteLoopRequest): Promise<RouteLoopResult>;
}
