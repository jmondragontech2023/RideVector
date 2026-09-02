import type { PocCoordinate, PocLineString } from '../types';

export type ElevationSummary = {
  status: 'ok' | 'unknown' | 'unavailable' | 'partial';
  gainMeters: number | null;
  lossMeters: number | null;
  minMeters: number | null;
  maxMeters: number | null;
  gainPerMile: number | null;
  coverage: number | null;
  confidence: 'high' | 'medium' | 'low' | 'unknown';
  provider: 'valhalla_height';
};

export type ElevationRequest = {
  geometry: PocLineString;
  distanceMeters: number;
  signal?: AbortSignal;
};

export interface ElevationProvider {
  profile(request: ElevationRequest): Promise<ElevationSummary>;
}

export function sampleRouteForElevation(
  geometry: PocLineString,
  maxPoints: number,
): PocCoordinate[] {
  const coords = geometry.coordinates;
  if (coords.length === 0) {
    return [];
  }
  if (coords.length <= maxPoints) {
    return coords.map(([longitude, latitude]) => ({ latitude, longitude }));
  }
  const sampled: PocCoordinate[] = [];
  for (let i = 0; i < maxPoints; i += 1) {
    const index = Math.round((i * (coords.length - 1)) / (maxPoints - 1));
    const point = coords[index]!;
    sampled.push({ longitude: point[0], latitude: point[1] });
  }
  return sampled;
}

export function summarizeHeights(
  heights: Array<number | null>,
  distanceMeters: number,
  metersPerMile: number,
): Omit<ElevationSummary, 'provider'> {
  const known = heights.filter(
    (value): value is number => value !== null && Number.isFinite(value),
  );
  if (known.length < 2) {
    return {
      status: 'unknown',
      gainMeters: null,
      lossMeters: null,
      minMeters: null,
      maxMeters: null,
      gainPerMile: null,
      coverage: known.length / Math.max(1, heights.length),
      confidence: 'unknown',
    };
  }

  let gain = 0;
  let loss = 0;
  for (let i = 1; i < heights.length; i += 1) {
    const prev = heights[i - 1];
    const curr = heights[i];
    if (
      prev === null ||
      prev === undefined ||
      curr === null ||
      curr === undefined ||
      !Number.isFinite(prev) ||
      !Number.isFinite(curr)
    ) {
      continue;
    }
    const delta = curr - prev;
    if (delta > 0) {
      gain += delta;
    } else {
      loss += -delta;
    }
  }

  const coverage = known.length / heights.length;
  const miles = distanceMeters / metersPerMile;
  return {
    status: coverage < 0.8 ? 'partial' : 'ok',
    gainMeters: Math.round(gain),
    lossMeters: Math.round(loss),
    minMeters: Math.min(...known),
    maxMeters: Math.max(...known),
    gainPerMile: miles > 0 ? Math.round((gain / miles) * 10) / 10 : null,
    coverage: Math.round(coverage * 1000) / 1000,
    confidence: coverage >= 0.9 ? 'high' : coverage >= 0.6 ? 'medium' : 'low',
  };
}
