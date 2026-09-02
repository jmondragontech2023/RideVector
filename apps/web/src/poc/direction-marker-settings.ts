import { ROUTE_DIRECTION_DEFAULTS, type SampleDirectionMarkersOptions } from './route-direction';

export const POC_DIRECTION_MARKER_SETTINGS_KEY = 'ridevector.poc.direction-markers.v1';

export type DirectionMarkerSettingsV1 = {
  version: 1;
  maxMarkers: number;
  targetSpacingMeters: number;
  maxGapMeters: number;
  minMarkerSeparationMeters: number;
  turnBearingThreshold: number;
};

export const DIRECTION_MARKER_SETTING_BOUNDS = {
  maxMarkers: { min: 8, max: 60, step: 1 },
  targetSpacingMeters: { min: 200, max: 1200, step: 25 },
  maxGapMeters: { min: 300, max: 1500, step: 25 },
  minMarkerSeparationMeters: { min: 30, max: 150, step: 5 },
  turnBearingThreshold: { min: 35, max: 100, step: 1 },
} as const;

export function defaultDirectionMarkerSettings(): DirectionMarkerSettingsV1 {
  return {
    version: 1,
    maxMarkers: ROUTE_DIRECTION_DEFAULTS.maxMarkers,
    targetSpacingMeters: ROUTE_DIRECTION_DEFAULTS.targetSpacingMeters,
    maxGapMeters: ROUTE_DIRECTION_DEFAULTS.maxGapMeters,
    minMarkerSeparationMeters: ROUTE_DIRECTION_DEFAULTS.minMarkerSeparationMeters,
    turnBearingThreshold: ROUTE_DIRECTION_DEFAULTS.turnBearingThreshold,
  };
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
}

export function parseDirectionMarkerSettings(raw: string | null): DirectionMarkerSettingsV1 {
  const defaults = defaultDirectionMarkerSettings();
  if (raw === null || raw.trim() === '') {
    return defaults;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return defaults;
    }
    const record = parsed as Record<string, unknown>;
    if (record.version !== 1) {
      return defaults;
    }

    return {
      version: 1,
      maxMarkers: Math.round(
        clampNumber(
          record.maxMarkers,
          DIRECTION_MARKER_SETTING_BOUNDS.maxMarkers.min,
          DIRECTION_MARKER_SETTING_BOUNDS.maxMarkers.max,
          defaults.maxMarkers,
        ),
      ),
      targetSpacingMeters: Math.round(
        clampNumber(
          record.targetSpacingMeters,
          DIRECTION_MARKER_SETTING_BOUNDS.targetSpacingMeters.min,
          DIRECTION_MARKER_SETTING_BOUNDS.targetSpacingMeters.max,
          defaults.targetSpacingMeters,
        ),
      ),
      maxGapMeters: Math.round(
        clampNumber(
          record.maxGapMeters,
          DIRECTION_MARKER_SETTING_BOUNDS.maxGapMeters.min,
          DIRECTION_MARKER_SETTING_BOUNDS.maxGapMeters.max,
          defaults.maxGapMeters,
        ),
      ),
      minMarkerSeparationMeters: Math.round(
        clampNumber(
          record.minMarkerSeparationMeters,
          DIRECTION_MARKER_SETTING_BOUNDS.minMarkerSeparationMeters.min,
          DIRECTION_MARKER_SETTING_BOUNDS.minMarkerSeparationMeters.max,
          defaults.minMarkerSeparationMeters,
        ),
      ),
      turnBearingThreshold: Math.round(
        clampNumber(
          record.turnBearingThreshold,
          DIRECTION_MARKER_SETTING_BOUNDS.turnBearingThreshold.min,
          DIRECTION_MARKER_SETTING_BOUNDS.turnBearingThreshold.max,
          defaults.turnBearingThreshold,
        ),
      ),
    };
  } catch {
    return defaults;
  }
}

export function loadDirectionMarkerSettings(
  storage: Pick<Storage, 'getItem'> = localStorage,
): DirectionMarkerSettingsV1 {
  return parseDirectionMarkerSettings(storage.getItem(POC_DIRECTION_MARKER_SETTINGS_KEY));
}

export function saveDirectionMarkerSettings(
  settings: DirectionMarkerSettingsV1,
  storage: Pick<Storage, 'setItem'> = localStorage,
): void {
  storage.setItem(POC_DIRECTION_MARKER_SETTINGS_KEY, JSON.stringify(settings));
}

/** Maps UI settings into sampler options (minMarkers tracks maxMarkers). */
export function toSampleDirectionMarkerOptions(
  settings: DirectionMarkerSettingsV1,
): SampleDirectionMarkersOptions {
  return {
    maxMarkers: settings.maxMarkers,
    minMarkers: Math.min(12, settings.maxMarkers),
    targetSpacingMeters: settings.targetSpacingMeters,
    maxGapMeters: settings.maxGapMeters,
    minMarkerSeparationMeters: settings.minMarkerSeparationMeters,
    turnBearingThreshold: settings.turnBearingThreshold,
  };
}
