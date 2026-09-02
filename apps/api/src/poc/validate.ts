import { METERS_PER_MILE, POC_CONFIG, type PocCostingMode } from './config';
import {
  adjacentLocationsCollapse,
  coordinatesAreCoincident,
  isFiniteNumber,
  parseCoordinate,
} from './coordinates';
import { defaultDistanceFlexibilityMeters } from './distance-range';
import { isElevationPreference, isTrafficPreference, normalizePocFeatures } from './features';
import type {
  PocCoordinate,
  PocElevationPreference,
  PocNormalizedDeparture,
  PocRouteMode,
  PocTrafficPreference,
  PocValidationIssue,
} from './types';

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

export type ValidatedPocGenerateRequest = {
  start: PocCoordinate;
  end?: PocCoordinate;
  routeMode: PocRouteMode;
  targetDistanceMeters: number;
  distanceFlexibilityMeters: number;
  costing: PocCostingMode;
  seed: number;
  features: ReturnType<typeof normalizePocFeatures>;
  elevationPreference: PocElevationPreference;
  trafficPreference: PocTrafficPreference;
  departure: PocNormalizedDeparture;
};

export function isPointToPointRequest(
  request: ValidatedPocGenerateRequest,
): request is ValidatedPocGenerateRequest & { routeMode: 'point_to_point'; end: PocCoordinate } {
  return request.routeMode === 'point_to_point' && request.end !== undefined;
}

const FORBIDDEN_CLIENT_FIELDS = [
  'score',
  'scores',
  'overallScore',
  'scoring',
  'providerOptions',
  'costingOptions',
] as const;

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

  for (const field of FORBIDDEN_CLIENT_FIELDS) {
    if (record[field] !== undefined) {
      details.push({
        field,
        reason: 'client-computed scores and provider options are not accepted',
      });
    }
  }

  const startResult = parseCoordinate(record.start, 'start');
  if (!startResult.ok) {
    details.push(...startResult.details);
  }

  let routeMode: PocRouteMode = 'loop';
  if (record.routeMode !== undefined) {
    if (record.routeMode !== 'loop' && record.routeMode !== 'point_to_point') {
      details.push({
        field: 'routeMode',
        reason: 'must be "loop" or "point_to_point" when provided',
      });
    } else {
      routeMode = record.routeMode;
    }
  }

  if (record.waypoints !== undefined) {
    if (!Array.isArray(record.waypoints)) {
      details.push({ field: 'waypoints', reason: 'must be an array when provided' });
    } else if (record.waypoints.length > 0) {
      details.push({
        field: 'waypoints',
        reason: 'ordered stops are not supported in this POC phase',
      });
    }
  }

  if (record.returnMode !== undefined && record.returnMode !== 'none') {
    details.push({
      field: 'returnMode',
      reason:
        record.returnMode === 'same_path' || record.returnMode === 'shortest'
          ? 'return routing is not supported in this POC phase'
          : 'must be "none" when provided',
    });
  }

  let end: PocCoordinate | undefined;
  if (routeMode === 'loop') {
    if (record.end !== undefined) {
      details.push({
        field: 'end',
        reason: 'loop requests cannot include an end point; omit end or switch to point_to_point',
      });
    }
  } else if (routeMode === 'point_to_point') {
    const endResult = parseCoordinate(record.end, 'end');
    if (!endResult.ok) {
      details.push(...endResult.details);
    } else {
      end = endResult.coordinate;
      if (startResult.ok && coordinatesAreCoincident(startResult.coordinate, end)) {
        details.push({
          field: 'end',
          reason:
            'Start and End are the same location. Use loop mode for a ride that returns to the start.',
        });
      } else if (startResult.ok && adjacentLocationsCollapse(startResult.coordinate, end)) {
        details.push({
          field: 'end',
          reason: 'Start and End are too close and would collapse into a zero-length leg',
        });
      }
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

  if (details.length > 0 || !startResult.ok) {
    return { ok: false, details };
  }

  const seed = record.seed === undefined ? 0 : (record.seed as number);

  return {
    ok: true,
    request: {
      start: startResult.coordinate,
      routeMode,
      ...(routeMode === 'point_to_point' && end ? { end } : {}),
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
