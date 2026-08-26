import { POC_CONFIG, type PocCostingMode } from './config';
import type { PocGenerateRequest, PocValidationIssue } from './types';

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isInteger(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value);
}

function isCostingMode(value: unknown): value is PocCostingMode {
  return value === 'road' || value === 'gravel';
}

/**
 * Validates and normalizes a POC generate request.
 * Returns canonical meters and a concrete integer seed.
 */
export function validatePocGenerateRequest(
  body: unknown,
):
  | { ok: true; request: Required<PocGenerateRequest> }
  | { ok: false; details: PocValidationIssue[] } {
  const details: PocValidationIssue[] = [];

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

  if (record.seed !== undefined && !isInteger(record.seed)) {
    details.push({ field: 'seed', reason: 'must be an integer when provided' });
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
      costing: record.costing as PocCostingMode,
      seed,
    },
  };
}
