import { POC_SCORING_CONFIG } from '../scoring/config';
import type { WeatherProvider, WeatherRequest, WeatherSummary } from './provider';

type OpenMeteoHourly = {
  time?: string[];
  temperature_2m?: Array<number | null>;
  apparent_temperature?: Array<number | null>;
  precipitation_probability?: Array<number | null>;
  precipitation?: Array<number | null>;
  wind_speed_10m?: Array<number | null>;
  wind_direction_10m?: Array<number | null>;
  wind_gusts_10m?: Array<number | null>;
  weather_code?: Array<number | null>;
};

type OpenMeteoLocation = {
  latitude?: number;
  longitude?: number;
  generationtime_ms?: number;
  hourly?: OpenMeteoHourly;
};

export type OpenMeteoProviderOptions = {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /** In-generation cache shared across routes. */
  cache?: Map<string, WeatherSummary>;
};

const HOURLY_FIELDS = [
  'temperature_2m',
  'apparent_temperature',
  'precipitation_probability',
  'precipitation',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
  'weather_code',
].join(',');

export class OpenMeteoWeatherProvider implements WeatherProvider {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly cache: Map<string, WeatherSummary>;

  constructor(options: OpenMeteoProviderOptions = {}) {
    this.baseUrl = (options.baseUrl ?? 'https://api.open-meteo.com').replace(/\/+$/, '');
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? POC_SCORING_CONFIG.weather.timeoutMs;
    this.cache = options.cache ?? new Map();
  }

  async forecast(request: WeatherRequest): Promise<WeatherSummary> {
    if (request.samples.length === 0) {
      return unavailable();
    }

    const cacheKey = cacheKeyFor(request);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const latitudes = request.samples.map((sample) => sample.coordinate.latitude).join(',');
    const longitudes = request.samples.map((sample) => sample.coordinate.longitude).join(',');
    const startIso = request.departureInstant.toISOString();
    const endIso = new Date(
      request.departureInstant.getTime() + Math.max(3600, request.durationSeconds) * 1000,
    ).toISOString();

    const url = new URL(`${this.baseUrl}/v1/forecast`);
    url.searchParams.set('latitude', latitudes);
    url.searchParams.set('longitude', longitudes);
    url.searchParams.set('hourly', HOURLY_FIELDS);
    url.searchParams.set('timezone', 'auto');
    url.searchParams.set('wind_speed_unit', 'kmh');
    url.searchParams.set('forecast_days', '3');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const onAbort = () => controller.abort();
    request.signal?.addEventListener('abort', onAbort);

    try {
      const response = await this.fetchImpl(url.toString(), {
        method: 'GET',
        headers: { accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) {
        return unavailable();
      }
      const payload = (await response.json()) as OpenMeteoLocation | OpenMeteoLocation[];
      const locations = Array.isArray(payload) ? payload : [payload];
      const summary = aggregateLocations(locations, request.departureInstant, endIso, startIso);
      this.cache.set(cacheKey, summary);
      return summary;
    } catch {
      return unavailable();
    } finally {
      clearTimeout(timer);
      request.signal?.removeEventListener('abort', onAbort);
    }
  }
}

function cacheKeyFor(request: WeatherRequest): string {
  const points = request.samples
    .map(
      (sample) =>
        `${sample.role}:${sample.coordinate.latitude.toFixed(4)},${sample.coordinate.longitude.toFixed(4)}`,
    )
    .join('|');
  return `${points}|${request.departureInstant.toISOString()}|${request.durationSeconds}`;
}

function aggregateLocations(
  locations: OpenMeteoLocation[],
  departure: Date,
  endIso: string,
  startIso: string,
): WeatherSummary {
  const temps: number[] = [];
  const apparent: number[] = [];
  const precipProb: number[] = [];
  const precip: number[] = [];
  const wind: number[] = [];
  const gust: number[] = [];
  const codes: number[] = [];
  let coveredHours = 0;
  let expectedHours = 0;

  for (const location of locations) {
    const hourly = location.hourly;
    if (!hourly?.time) {
      continue;
    }
    for (let i = 0; i < hourly.time.length; i += 1) {
      const raw = hourly.time[i]!;
      const normalized = /Z$|[+-]\d{2}:\d{2}$/.test(raw) ? raw : `${raw}Z`;
      const time = new Date(normalized);
      if (!Number.isFinite(time.getTime())) {
        continue;
      }
      if (time.getTime() < departure.getTime() || time.getTime() > Date.parse(endIso)) {
        continue;
      }
      expectedHours += 1;
      const t = hourly.temperature_2m?.[i];
      const a = hourly.apparent_temperature?.[i];
      const pp = hourly.precipitation_probability?.[i];
      const p = hourly.precipitation?.[i];
      const w = hourly.wind_speed_10m?.[i];
      const g = hourly.wind_gusts_10m?.[i];
      const c = hourly.weather_code?.[i];
      if (t !== null && t !== undefined && Number.isFinite(t)) {
        temps.push(t);
        coveredHours += 1;
      }
      if (a !== null && a !== undefined && Number.isFinite(a)) {
        apparent.push(a);
      }
      if (pp !== null && pp !== undefined && Number.isFinite(pp)) {
        precipProb.push(pp);
      }
      if (p !== null && p !== undefined && Number.isFinite(p)) {
        precip.push(p);
      }
      if (w !== null && w !== undefined && Number.isFinite(w)) {
        wind.push(w);
      }
      if (g !== null && g !== undefined && Number.isFinite(g)) {
        gust.push(g);
      }
      if (c !== null && c !== undefined && Number.isFinite(c)) {
        codes.push(c);
      }
    }
  }

  if (temps.length === 0) {
    return unavailable();
  }

  const warnings: string[] = [];
  const cfg = POC_SCORING_CONFIG.weather;
  const precipMm = precip.reduce((sum, value) => sum + value, 0);
  const maxProb = precipProb.length ? Math.max(...precipProb) : null;
  const maxWind = wind.length ? Math.max(...wind) : null;
  const maxGust = gust.length ? Math.max(...gust) : null;
  if (precipMm >= cfg.heavyPrecipitationMm) {
    warnings.push('Heavy precipitation expected in the ride window');
  }
  if (maxProb !== null && maxProb >= cfg.highPrecipProbability) {
    warnings.push('High precipitation probability');
  }
  if (maxWind !== null && maxWind >= cfg.strongWindKmh) {
    warnings.push('Strong sustained wind');
  }
  if (maxGust !== null && maxGust >= cfg.strongGustKmh) {
    warnings.push('Strong wind gusts');
  }
  const minTemp = Math.min(...temps);
  const maxTemp = Math.max(...temps);
  if (minTemp <= cfg.extremeTempLowC || maxTemp >= cfg.extremeTempHighC) {
    warnings.push('Extreme temperature in the ride window');
  }

  const coverage = expectedHours === 0 ? null : coveredHours / expectedHours;
  return {
    status: coverage !== null && coverage < 0.7 ? 'partial' : 'ok',
    temperatureMinC: Math.round(minTemp * 10) / 10,
    temperatureMaxC: Math.round(maxTemp * 10) / 10,
    apparentTemperatureMinC: apparent.length ? Math.round(Math.min(...apparent) * 10) / 10 : null,
    apparentTemperatureMaxC: apparent.length ? Math.round(Math.max(...apparent) * 10) / 10 : null,
    precipitationProbabilityMax: maxProb === null ? null : Math.round(maxProb),
    precipitationMm: Math.round(precipMm * 10) / 10,
    windSpeedMaxKmh: maxWind === null ? null : Math.round(maxWind * 10) / 10,
    windGustMaxKmh: maxGust === null ? null : Math.round(maxGust * 10) / 10,
    weatherCodes: [...new Set(codes)],
    warnings,
    coverage: coverage === null ? null : Math.round(coverage * 1000) / 1000,
    confidence:
      coverage === null ? 'unknown' : coverage >= 0.9 ? 'high' : coverage >= 0.6 ? 'medium' : 'low',
    provider: 'open_meteo',
    forecastGeneratedAtIso: new Date().toISOString(),
    intervalStartIso: startIso,
    intervalEndIso: endIso,
  };
}

function unavailable(): WeatherSummary {
  return {
    status: 'unavailable',
    temperatureMinC: null,
    temperatureMaxC: null,
    apparentTemperatureMinC: null,
    apparentTemperatureMaxC: null,
    precipitationProbabilityMax: null,
    precipitationMm: null,
    windSpeedMaxKmh: null,
    windGustMaxKmh: null,
    weatherCodes: [],
    warnings: [],
    coverage: null,
    confidence: 'unknown',
    provider: 'open_meteo',
    forecastGeneratedAtIso: null,
    intervalStartIso: null,
    intervalEndIso: null,
  };
}
