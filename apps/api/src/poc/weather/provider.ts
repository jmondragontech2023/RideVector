import type { PocCoordinate } from '../types';

export type WeatherSamplePoint = {
  role: 'start' | 'midpoint' | 'farthest';
  coordinate: PocCoordinate;
};

export type WeatherSummary = {
  status: 'ok' | 'unknown' | 'unavailable' | 'partial' | 'stale';
  temperatureMinC: number | null;
  temperatureMaxC: number | null;
  apparentTemperatureMinC: number | null;
  apparentTemperatureMaxC: number | null;
  precipitationProbabilityMax: number | null;
  precipitationMm: number | null;
  windSpeedMaxKmh: number | null;
  windGustMaxKmh: number | null;
  weatherCodes: number[];
  warnings: string[];
  coverage: number | null;
  confidence: 'high' | 'medium' | 'low' | 'unknown';
  provider: 'open_meteo';
  forecastGeneratedAtIso: string | null;
  intervalStartIso: string | null;
  intervalEndIso: string | null;
};

export type WeatherRequest = {
  samples: WeatherSamplePoint[];
  departureInstant: Date;
  durationSeconds: number;
  signal?: AbortSignal;
};

export interface WeatherProvider {
  forecast(request: WeatherRequest): Promise<WeatherSummary>;
}

export function farthestPointFromStart(
  start: PocCoordinate,
  coordinates: Array<[number, number]>,
  haversine: (a: PocCoordinate, b: PocCoordinate) => number,
): PocCoordinate {
  let farthest = start;
  let maxDistance = -1;
  for (const point of coordinates) {
    const coordinate = { longitude: point[0], latitude: point[1] };
    const distance = haversine(start, coordinate);
    if (distance > maxDistance) {
      maxDistance = distance;
      farthest = coordinate;
    }
  }
  return farthest;
}
