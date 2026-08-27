import { describe, expect, it } from 'vitest';
import {
  defaultFeatureSettings,
  parseFeatureSettings,
  POC_FEATURE_SETTINGS_KEY,
  saveFeatureSettings,
  loadFeatureSettings,
} from './feature-settings';
import { DEFAULT_POC_FEATURES } from './types';

describe('feature settings persistence', () => {
  it('returns defaults for corrupt or empty storage', () => {
    expect(parseFeatureSettings(null).features).toEqual(DEFAULT_POC_FEATURES);
    expect(parseFeatureSettings('{').features).toEqual(DEFAULT_POC_FEATURES);
    expect(parseFeatureSettings(JSON.stringify({ version: 99 })).features).toEqual(
      DEFAULT_POC_FEATURES,
    );
  });

  it('coerces scoring toggles that lack enrichment', () => {
    const parsed = parseFeatureSettings(
      JSON.stringify({
        version: 1,
        features: {
          ...DEFAULT_POC_FEATURES,
          elevationScoring: true,
          elevationEnrichment: false,
        },
      }),
    );
    expect(parsed.features.elevationScoring).toBe(false);
  });

  it('round-trips settings through storage', () => {
    const memory = new Map<string, string>();
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
    };
    const settings = {
      ...defaultFeatureSettings(),
      features: {
        ...DEFAULT_POC_FEATURES,
        weatherForecast: true,
      },
      trafficPreference: 'prefer_lower' as const,
    };
    saveFeatureSettings(settings, storage);
    expect(memory.get(POC_FEATURE_SETTINGS_KEY)).toContain('weatherForecast');
    expect(loadFeatureSettings(storage).trafficPreference).toBe('prefer_lower');
  });
});
