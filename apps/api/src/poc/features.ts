import type {
  PocElevationPreference,
  PocExperimentalFeatures,
  PocFeaturePreset,
  PocTrafficPreference,
} from './types';

/** Default experimental feature flags for new planner sessions and requests. */
export const DEFAULT_POC_FEATURES: PocExperimentalFeatures = {
  distanceFitScoring: true,
  loopQualityScoring: true,
  routeDiversityScoring: true,
  elevationEnrichment: false,
  elevationScoring: false,
  motorTrafficEnrichment: false,
  motorTrafficScoring: false,
  weatherForecast: false,
  weatherScoring: false,
};

export const FEATURE_PRESETS: Record<PocFeaturePreset, PocExperimentalFeatures> = {
  basic: {
    ...DEFAULT_POC_FEATURES,
    distanceFitScoring: true,
    loopQualityScoring: false,
    routeDiversityScoring: false,
  },
  geometry: {
    ...DEFAULT_POC_FEATURES,
    distanceFitScoring: true,
    loopQualityScoring: true,
    routeDiversityScoring: true,
  },
  traffic: {
    ...DEFAULT_POC_FEATURES,
    distanceFitScoring: true,
    loopQualityScoring: true,
    routeDiversityScoring: true,
    motorTrafficEnrichment: true,
    motorTrafficScoring: true,
  },
  weather: {
    ...DEFAULT_POC_FEATURES,
    distanceFitScoring: true,
    loopQualityScoring: true,
    routeDiversityScoring: true,
    weatherForecast: true,
    weatherScoring: false,
  },
  full: {
    distanceFitScoring: true,
    loopQualityScoring: true,
    routeDiversityScoring: true,
    elevationEnrichment: true,
    elevationScoring: true,
    motorTrafficEnrichment: true,
    motorTrafficScoring: true,
    weatherForecast: true,
    weatherScoring: true,
  },
};

const FEATURE_KEYS = Object.keys(DEFAULT_POC_FEATURES) as Array<keyof PocExperimentalFeatures>;

function isBooleanRecord(
  value: unknown,
): value is Partial<Record<keyof PocExperimentalFeatures, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Merges partial client features onto defaults.
 * Scoring toggles that require enrichment are forced off when enrichment is off.
 */
export function normalizePocFeatures(input: unknown): PocExperimentalFeatures {
  const base: PocExperimentalFeatures = { ...DEFAULT_POC_FEATURES };
  if (!isBooleanRecord(input)) {
    return coerceFeatureDependencies(base);
  }
  for (const key of FEATURE_KEYS) {
    if (typeof input[key] === 'boolean') {
      base[key] = input[key] as boolean;
    }
  }
  return coerceFeatureDependencies(base);
}

export function coerceFeatureDependencies(
  features: PocExperimentalFeatures,
): PocExperimentalFeatures {
  return {
    ...features,
    elevationScoring: features.elevationEnrichment && features.elevationScoring,
    motorTrafficScoring: features.motorTrafficEnrichment && features.motorTrafficScoring,
    weatherScoring: features.weatherForecast && features.weatherScoring,
  };
}

export function isElevationPreference(value: unknown): value is PocElevationPreference {
  return value === 'none' || value === 'flatter' || value === 'rolling' || value === 'climbing';
}

export function isTrafficPreference(value: unknown): value is PocTrafficPreference {
  return value === 'none' || value === 'prefer_lower' || value === 'strongly_avoid_heavy';
}

export function featuresRequireElevation(features: PocExperimentalFeatures): boolean {
  return features.elevationEnrichment;
}

export function featuresRequireWeather(features: PocExperimentalFeatures): boolean {
  return features.weatherForecast;
}

export function featuresRequireTraffic(features: PocExperimentalFeatures): boolean {
  return features.motorTrafficEnrichment;
}
