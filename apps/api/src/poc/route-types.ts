import type { PocLineString } from './types';

export type RouteSpikeResponse = {
  geometry: PocLineString;
  distanceMeters: number;
  durationSeconds: number;
};
