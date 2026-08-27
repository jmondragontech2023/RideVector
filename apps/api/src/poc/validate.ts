import { METERS_PER_MILE, POC_CONFIG, type PocCostingMode } from './config';
import { defaultDistanceFlexibilityMeters } from './distance-range';
import { isElevationPreference, isTrafficPreference, normalizePocFeatures } from './features';
import type { PocGenerateRequest, PocNormalizedDeparture, PocValidationIssue } from './types';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isInteger(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value);
}

function isCostingMode(value: unknown): value is PocCostingMode {
  return value === 'road' || value === 'gravel';
}

function normalizeDeparture(
  value: unknown,
  now: () => Date,
): { ok: true; departure: PocNormalizedDeparture } | { ok: false; details: PocValidationIssue[] } {
  if (value === undefined) {
    const instant = now();
    return {
      ok: true,
      departure: {
        mode: 'now',
        departureInstantIso: instant.toISOString(),
        timeZone: 'UTC',
      },
    };
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, details: [{ field: 'departure', reason: 'must be an object' }] };
  }
  const record = value as Record<string, unknown>;
  if (record.mode === 'now') {
    const instant = now();
    return {
      ok: true,
      departure: {
        mode: 'now',
        departureInstantIso: instant.toISOString(),
        timeZone: typeof record.timeZone === 'string' ? record.timeZone : 'UTC',
      },
    };
  }
  if (record.mode === 'custom') {
    if (typeof record.localDateTime !== 'string' || record.localDateTime.trim() === '') {
      return {
        ok: false,
        details: [
          { field: 'departure.localDateTime', reason: 'must be a non-empty ISO-like string' },
        ],
      };
    }
    if (typeof record.timeZone !== 'string' || record.timeZone.trim() === '') {
      return {
        ok: false,
        details: [{ field: 'departure.timeZone', reason: 'must be a non-empty IANA timezone' }],
      };
    }
    const parsed = Date.parse(record.localDateTime);
    if (!Number.isFinite(parsed)) {
      return {
        ok: false,
        details: [
          {
            field: 'departure.localDateTime',
            reason: 'must parse as a valid date/time',
          },
        ],
      };
    }
    return {
      ok: true,
      departure: {
        mode: 'custom',
        departureInstantIso: new Date(parsed).toISOString(),
        timeZone: record.timeZone,
      },
    };
  }
  return {
    ok: false,
    details: [{ field: 'departure.mode', reason: 'must be "now" or "custom"' }],
  };
}

export type ValidatedPocGenerateRequest = Required<
  Omit<PocGenerateRequest, 'features' | 'departure'>
> & {
  features: ReturnType<typeof normalizePocFeatures>;
  departure: PocNormalizedDeparture;
};

/**
 * Validates and normalizes a POC generate request.
 * Returns canonical meters and a concrete integer seed.
 */
export function validatePocGenerateRequest(
  body: unknown,
  options?: { now?: () => Date },
):
  | { ok: true; request: ValidatedPocGenerateRequest }
  | { ok: false; details: PocValidationIssue[] } {
  const details: PocValidationIssue[] = [];
  const now = options?.now ?? (() => new Date());

  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    return {
      ok: false,
      details: [{ field: 'body', reason: 'must be a JSON object' }],
    };
  }

  const record = body as Record<string, unknown>;
  const start = record.start;

  if (start === null || typeof start !== 'object' || Array.isArray(start)) {
    details.push({ field: 'start', reason: 'must be an object with latitude and longitude' });
  } else {
    const startRecord = start as Record<string, unknown>;
    if (
      !isFiniteNumber(startRecord.latitude) ||
      startRecord.latitude < -90 ||
      startRecord.latitude > 90
    ) {
      details.push({
        field: 'start.latitude',
        reason: 'must be a finite number between -90 and 90',
      });
    }
    if (
      !isFiniteNumber(startRecord.longitude) ||
      startRecord.longitude < -180 ||
      startRecord.longitude > 180
    ) {
      details.push({
        field: 'start.longitude',
        reason: 'must be a finite number between -180 and 180',
      });
    }
  }

  if (!isFiniteNumber(record.targetDistanceMeters)) {
    details.push({ field: 'targetDistanceMeters', reason: 'must be a finite number' });
  } else if (record.targetDistanceMeters < POC_CONFIG.minTargetDistanceMeters) {
    details.push({
      field: 'targetDistanceMeters',
      reason: `must be at least ${POC_CONFIG.minTargetDistanceMeters} meters`,
    });
  } else if (record.targetDistanceMeters > POC_CONFIG.maxTargetDistanceMeters) {
    details.push({
      field: 'targetDistanceMeters',
      reason: `must be at most ${POC_CONFIG.maxTargetDistanceMeters} meters`,
    });
  }

  if (!isCostingMode(record.costing)) {
    details.push({ field: 'costing', reason: 'must be "road" or "gravel"' });
  }

  let flexMeters = defaultDistanceFlexibilityMeters();
  if (record.distanceFlexibilityMeters !== undefined) {
    if (!isFiniteNumber(record.distanceFlexibilityMeters)) {
      details.push({ field: 'distanceFlexibilityMeters', reason: 'must be a finite number' });
    } else {
      flexMeters = record.distanceFlexibilityMeters;
      if (flexMeters <= 0) {
        details.push({
          field: 'distanceFlexibilityMeters',
          reason: 'must be greater than zero',
        });
      } else if (flexMeters > POC_CONFIG.maxDistanceFlexibilityMiles * METERS_PER_MILE) {
        details.push({
          field: 'distanceFlexibilityMeters',
          reason: `must be at most ${POC_CONFIG.maxDistanceFlexibilityMiles} miles`,
        });
      }
    }
  }

  if (record.seed !== undefined && !isInteger(record.seed)) {
    details.push({ field: 'seed', reason: 'must be an integer when provided' });
  }

  const features = normalizePocFeatures(record.features);
  if (record.features !== undefined && record.features !== null) {
    if (typeof record.features !== 'object' || Array.isArray(record.features)) {
      details.push({ field: 'features', reason: 'must be an object when provided' });
    } else {
      const raw = record.features as Record<string, unknown>;
      if (raw.elevationScoring === true && raw.elevationEnrichment !== true) {
        details.push({
          field: 'features.elevationScoring',
          reason: 'requires elevationEnrichment',
        });
      }
      if (raw.motorTrafficScoring === true && raw.motorTrafficEnrichment !== true) {
        details.push({
          field: 'features.motorTrafficScoring',
          reason: 'requires motorTrafficEnrichment',
        });
      }
      if (raw.weatherScoring === true && raw.weatherForecast !== true) {
        details.push({
          field: 'features.weatherScoring',
          reason: 'requires weatherForecast',
        });
      }
    }
  }

  let elevationPreference: ValidatedPocGenerateRequest['elevationPreference'] = 'none';
  if (record.elevationPreference !== undefined) {
    if (!isElevationPreference(record.elevationPreference)) {
      details.push({
        field: 'elevationPreference',
        reason: 'must be none, flatter, rolling, or climbing',
      });
    } else {
      elevationPreference = record.elevationPreference;
    }
  }

  let trafficPreference: ValidatedPocGenerateRequest['trafficPreference'] = 'none';
  if (record.trafficPreference !== undefined) {
    if (!isTrafficPreference(record.trafficPreference)) {
      details.push({
        field: 'trafficPreference',
        reason: 'must be none, prefer_lower, or strongly_avoid_heavy',
      });
    } else {
      trafficPreference = record.trafficPreference;
    }
  }

  const departureResult = normalizeDeparture(record.departure, now);
  if (!departureResult.ok) {
    details.push(...departureResult.details);
  }

  if (details.length > 0) {
    return { ok: false, details };
  }

  const startRecord = record.start as { latitude: number; longitude: number };
  const seed = record.seed === undefined ? 0 : (record.seed as number);

  return {
    ok: true,
    request: {
      start: {
        latitude: startRecord.latitude,
        longitude: startRecord.longitude,
      },
      targetDistanceMeters: record.targetDistanceMeters as number,
      distanceFlexibilityMeters: flexMeters,
      costing: record.costing as PocCostingMode,
      seed,
      features,
      elevationPreference,
      trafficPreference,
      departure: departureResult.ok
        ? departureResult.departure
        : {
            mode: 'now',
            departureInstantIso: now().toISOString(),
            timeZone: 'UTC',
          },
    },
  };
}
