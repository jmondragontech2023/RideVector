import type { PocCostingMode } from '../config';
import type { PocCoordinate, PocLineString } from '../types';

/** Ordered route through two or more locations (loop-ready). */
export type RouteRequest = {
  locations: readonly PocCoordinate[];
  costing?: PocCostingMode;
  signal?: AbortSignal;
};

export type RouteLoopRequest = {
  start: PocCoordinate;
  waypoints: PocCoordinate[];
  costing: PocCostingMode;
  signal?: AbortSignal;
};

export type RouteSuccess = {
  ok: true;
  geometry: PocLineString;
  distanceMeters: number;
  durationSeconds: number;
};

export type RouteFailure = {
  ok: false;
  reason: 'upstream_failure' | 'malformed_geometry';
  message: string;
};

export type RouteResult = RouteSuccess | RouteFailure;

/** @deprecated alias kept for existing loop-generation code */
export type RouteLoopResult = RouteResult;

/**
 * Thin routing-provider port. Valhalla adapters implement this.
 * Domain/POC types never include provider payloads or URLs.
 */
export interface RoutingProvider {
  /** Route through an ordered list of two or more locations. */
  route(request: RouteRequest): Promise<RouteResult>;
  /** Convenience for start → waypoints → start loops. */
  routeLoop(request: RouteLoopRequest): Promise<RouteResult>;
}
