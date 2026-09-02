import {
  coerceFeatureDependencies,
  DEFAULT_POC_FEATURES,
  type PocElevationPreference,
  type PocExperimentalFeatures,
  type PocTrafficPreference,
} from './types';

export const POC_FEATURE_SETTINGS_KEY = 'ridevector.poc.features.v1';

export type PocFeatureSettingsV1 = {
  version: 1;
  features: PocExperimentalFeatures;
  elevationPreference: PocElevationPreference;
  trafficPreference: PocTrafficPreference;
  departureMode: 'now' | 'custom';
  customLocalDateTime: string;
};

export function defaultFeatureSettings(): PocFeatureSettingsV1 {
  return {
    version: 1,
    features: { ...DEFAULT_POC_FEATURES },
    elevationPreference: 'none',
    trafficPreference: 'none',
    departureMode: 'now',
    customLocalDateTime: '',
  };
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function parseFeatures(value: unknown): PocExperimentalFeatures {
  const base = { ...DEFAULT_POC_FEATURES };
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return base;
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(base) as Array<keyof PocExperimentalFeatures>) {
    if (isBoolean(record[key])) {
      base[key] = record[key];
    }
  }
  return coerceFeatureDependencies(base);
}

export function parseFeatureSettings(raw: string | null): PocFeatureSettingsV1 {
  if (raw === null || raw.trim() === '') {
    return defaultFeatureSettings();
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return defaultFeatureSettings();
    }
    const record = parsed as Record<string, unknown>;
    if (record.version !== 1) {
      return defaultFeatureSettings();
    }
    const elevationPreference =
      record.elevationPreference === 'flatter' ||
      record.elevationPreference === 'rolling' ||
      record.elevationPreference === 'climbing'
        ? record.elevationPreference
        : 'none';
    const trafficPreference =
      record.trafficPreference === 'prefer_lower' ||
      record.trafficPreference === 'strongly_avoid_heavy'
        ? record.trafficPreference
        : 'none';
    return {
      version: 1,
      features: parseFeatures(record.features),
      elevationPreference,
      trafficPreference,
      departureMode: record.departureMode === 'custom' ? 'custom' : 'now',
      customLocalDateTime:
        typeof record.customLocalDateTime === 'string' ? record.customLocalDateTime : '',
    };
  } catch {
    return defaultFeatureSettings();
  }
}

export function loadFeatureSettings(
  storage: Pick<Storage, 'getItem'> = localStorage,
): PocFeatureSettingsV1 {
  return parseFeatureSettings(storage.getItem(POC_FEATURE_SETTINGS_KEY));
}

export function saveFeatureSettings(
  settings: PocFeatureSettingsV1,
  storage: Pick<Storage, 'setItem'> = localStorage,
): void {
  storage.setItem(POC_FEATURE_SETTINGS_KEY, JSON.stringify(settings));
}
