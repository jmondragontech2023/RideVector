import { POC_SCORING_CONFIG } from './config';
import type { ElevationSummary } from '../elevation/provider';
import type { WeatherSummary } from '../weather/provider';
import type { TrafficRouteSummary } from '../traffic/provider';
import type { PocElevationPreference, PocTrafficPreference } from '../types';

export function scoreElevationPreference(
  preference: PocElevationPreference,
  elevation: ElevationSummary | null,
): { score: number | null; applicable: boolean; raw: Record<string, unknown> } {
  if (preference === 'none') {
    return { score: null, applicable: false, raw: { preference } };
  }
  if (!elevation || elevation.gainPerMile === null) {
    return {
      score: null,
      applicable: true,
      raw: { preference, status: elevation?.status ?? 'unknown', missing: true },
    };
  }
  const gain = elevation.gainPerMile;
  const { flattestMaxGainPerMile, rollingMaxGainPerMile } = POC_SCORING_CONFIG.elevation;
  let score: number;
  if (preference === 'flatter') {
    score = Math.max(0, Math.min(100, Math.round(100 - (gain / rollingMaxGainPerMile) * 100)));
  } else if (preference === 'climbing') {
    score = Math.max(0, Math.min(100, Math.round((gain / (rollingMaxGainPerMile * 1.5)) * 100)));
  } else {
    // Prefer rolling band.
    if (gain < flattestMaxGainPerMile) {
      score = Math.round(60 + (gain / flattestMaxGainPerMile) * 20);
    } else if (gain <= rollingMaxGainPerMile) {
      score = 100;
    } else {
      score = Math.max(20, Math.round(100 - (gain - rollingMaxGainPerMile) * 2));
    }
  }
  return {
    score,
    applicable: true,
    raw: { preference, gainPerMile: gain, status: elevation.status },
  };
}

export function scoreWeatherSuitability(
  weather: WeatherSummary | null,
): { score: number | null; applicable: boolean; raw: Record<string, unknown> } {
  if (!weather || weather.status === 'unavailable' || weather.status === 'unknown') {
    return {
      score: null,
      applicable: true,
      raw: { status: weather?.status ?? 'unknown', missing: true },
    };
  }
  const cfg = POC_SCORING_CONFIG.weather;
  let score = 100;
  if ((weather.precipitationMm ?? 0) >= cfg.heavyPrecipitationMm) {
    score -= 30;
  }
  if ((weather.precipitationProbabilityMax ?? 0) >= cfg.highPrecipProbability) {
    score -= 20;
  }
  if ((weather.windSpeedMaxKmh ?? 0) >= cfg.strongWindKmh) {
    score -= 15;
  }
  if ((weather.windGustMaxKmh ?? 0) >= cfg.strongGustKmh) {
    score -= 10;
  }
  const minTemp = weather.temperatureMinC;
  const maxTemp = weather.temperatureMaxC;
  if (
    (minTemp !== null && minTemp <= cfg.extremeTempLowC) ||
    (maxTemp !== null && maxTemp >= cfg.extremeTempHighC)
  ) {
    score -= 20;
  }
  if (weather.status === 'partial' || weather.status === 'stale') {
    score -= 10;
  }
  return {
    score: Math.max(0, Math.min(100, score)),
    applicable: true,
    raw: {
      status: weather.status,
      precipitationMm: weather.precipitationMm,
      precipitationProbabilityMax: weather.precipitationProbabilityMax,
      windSpeedMaxKmh: weather.windSpeedMaxKmh,
      windGustMaxKmh: weather.windGustMaxKmh,
    },
  };
}

/**
 * Traffic preference fit. Lower baselineExposure is better when preferring lower traffic.
 * Congestion adds a penalty but never reduces baseline exposure (does not look "quiet").
 * Missing data uses a conservative mid-low score rather than favorable.
 */
export function scoreTrafficPreference(
  preference: PocTrafficPreference,
  traffic: TrafficRouteSummary | null,
  rankingEnabled: boolean,
): { score: number | null; applicable: boolean; raw: Record<string, unknown> } {
  if (preference === 'none' || !rankingEnabled) {
    return {
      score: null,
      applicable: false,
      raw: { preference, rankingEnabled },
    };
  }
  if (!traffic || traffic.baselineExposure === null || (traffic.coverage ?? 0) < 0.6) {
    return {
      score: 40,
      applicable: true,
      raw: {
        preference,
        missing: true,
        conservativeMissingData: true,
        coverage: traffic?.coverage ?? 0,
      },
    };
  }

  const exposure = traffic.baselineExposure;
  let score =
    preference === 'strongly_avoid_heavy'
      ? Math.max(0, Math.min(100, Math.round(100 - exposure * 1.1)))
      : Math.max(0, Math.min(100, Math.round(100 - exposure)));

  if (traffic.currentCongestionDetected) {
    score = Math.max(0, score - 10);
  }

  return {
    score,
    applicable: true,
    raw: {
      preference,
      baselineExposure: exposure,
      congestion: traffic.currentCongestionDetected,
      coverage: traffic.coverage,
    },
  };
}
