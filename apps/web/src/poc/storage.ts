import { DEFAULT_DISTANCE_FLEXIBILITY_MILES, METERS_PER_MILE } from './types';

export type WouldRide = 'yes' | 'maybe' | 'no';

export type SavedPocRoute = {
  id: string;
  savedAt: string;
  label: string;
  start: { latitude: number; longitude: number };
  targetDistanceMeters: number;
  distanceFlexibilityMeters: number;
  costing: 'road' | 'gravel';
  seed: number;
  alternative: {
    id: string;
    name: string;
    geometry: { type: 'LineString'; coordinates: Array<[number, number]> };
    distanceMeters: number;
    durationSeconds: number;
    distanceFromTargetMeters: number;
    bearingFamily: string;
    warnings: string[];
    distanceClassification: 'within_range' | 'near_match';
    requestedRangeMeters: { min: number; max: number };
    rangeDeviationMeters?: number;
    targetDifferencePercent?: number;
  };
  feedback?: {
    wouldRide: WouldRide;
    reason?: string;
    deviationAcceptable?: boolean;
  };
};

export type PocLocalStoreV1 = {
  version: 1;
  routes: SavedPocRoute[];
};

export const POC_STORAGE_KEY = 'ridevector.poc.routes.v1';

/** Historical POC tolerance (±20% of target) used before explicit flexibility fields. */
const LEGACY_TOLERANCE_FRACTION = 0.2;

export function emptyStore(): PocLocalStoreV1 {
  return { version: 1, routes: [] };
}

export function defaultFlexibilityMeters(): number {
  return DEFAULT_DISTANCE_FLEXIBILITY_MILES * METERS_PER_MILE;
}

export function parsePocStore(raw: string | null): PocLocalStoreV1 {
  if (raw === null || raw.trim() === '') {
    return emptyStore();
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed === null ||
      typeof parsed !== 'object' ||
      Array.isArray(parsed) ||
      (parsed as { version?: unknown }).version !== 1 ||
      !Array.isArray((parsed as { routes?: unknown }).routes)
    ) {
      return emptyStore();
    }
    const routes = (parsed as { routes: unknown[] }).routes
      .map((route) => migrateSavedRoute(route))
      .filter((route): route is SavedPocRoute => route !== null);
    return {
      version: 1,
      routes,
    };
  } catch {
    return emptyStore();
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isCoordinate(value: unknown): value is { latitude: number; longitude: number } {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    isFiniteNumber(record.latitude) &&
    record.latitude >= -90 &&
    record.latitude <= 90 &&
    isFiniteNumber(record.longitude) &&
    record.longitude >= -180 &&
    record.longitude <= 180
  );
}

function isLineStringGeometry(
  value: unknown,
): value is { type: 'LineString'; coordinates: Array<[number, number]> } {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (record.type !== 'LineString' || !Array.isArray(record.coordinates)) {
    return false;
  }
  return record.coordinates.every(
    (point) =>
      Array.isArray(point) &&
      point.length === 2 &&
      isFiniteNumber(point[0]) &&
      isFiniteNumber(point[1]),
  );
}

function isRequestedRange(value: unknown): value is { min: number; max: number } {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return isFiniteNumber(record.min) && isFiniteNumber(record.max) && record.max >= record.min;
}

function isCoreAlternativeFields(record: Record<string, unknown>): boolean {
  return (
    typeof record.id === 'string' &&
    typeof record.name === 'string' &&
    isLineStringGeometry(record.geometry) &&
    isFiniteNumber(record.distanceMeters) &&
    isFiniteNumber(record.durationSeconds) &&
    isFiniteNumber(record.distanceFromTargetMeters) &&
    typeof record.bearingFamily === 'string' &&
    Array.isArray(record.warnings) &&
    record.warnings.every((item) => typeof item === 'string')
  );
}

function isAlternative(value: unknown): value is SavedPocRoute['alternative'] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  const classification = record.distanceClassification;
  return (
    isCoreAlternativeFields(record) &&
    (classification === 'within_range' || classification === 'near_match') &&
    isRequestedRange(record.requestedRangeMeters) &&
    (record.rangeDeviationMeters === undefined || isFiniteNumber(record.rangeDeviationMeters)) &&
    (record.targetDifferencePercent === undefined || isFiniteNumber(record.targetDifferencePercent))
  );
}

function isLegacyAlternative(
  value: unknown,
): value is Omit<
  SavedPocRoute['alternative'],
  | 'distanceClassification'
  | 'requestedRangeMeters'
  | 'rangeDeviationMeters'
  | 'targetDifferencePercent'
> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  return isCoreAlternativeFields(value as Record<string, unknown>);
}

function isFeedback(value: unknown): value is NonNullable<SavedPocRoute['feedback']> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (record.wouldRide !== 'yes' && record.wouldRide !== 'maybe' && record.wouldRide !== 'no') {
    return false;
  }
  if (record.reason === undefined) {
    return (
      record.deviationAcceptable === undefined || typeof record.deviationAcceptable === 'boolean'
    );
  }
  return (
    typeof record.reason === 'string' &&
    (record.deviationAcceptable === undefined || typeof record.deviationAcceptable === 'boolean')
  );
}

function isSavedRoute(value: unknown): value is SavedPocRoute {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== 'string' ||
    typeof record.savedAt !== 'string' ||
    typeof record.label !== 'string' ||
    !isCoordinate(record.start) ||
    !isFiniteNumber(record.targetDistanceMeters) ||
    record.targetDistanceMeters <= 0 ||
    !isFiniteNumber(record.distanceFlexibilityMeters) ||
    record.distanceFlexibilityMeters <= 0 ||
    (record.costing !== 'road' && record.costing !== 'gravel') ||
    !isFiniteNumber(record.seed) ||
    !isAlternative(record.alternative)
  ) {
    return false;
  }
  if (record.feedback !== undefined && !isFeedback(record.feedback)) {
    return false;
  }
  return true;
}

function isLegacySavedRoute(value: unknown): boolean {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== 'string' ||
    typeof record.savedAt !== 'string' ||
    typeof record.label !== 'string' ||
    !isCoordinate(record.start) ||
    !isFiniteNumber(record.targetDistanceMeters) ||
    record.targetDistanceMeters <= 0 ||
    (record.costing !== 'road' && record.costing !== 'gravel') ||
    !isFiniteNumber(record.seed) ||
    !isLegacyAlternative(record.alternative)
  ) {
    return false;
  }
  if (record.feedback !== undefined && !isFeedback(record.feedback)) {
    return false;
  }
  return true;
}

/** Upgrades earlier POC saves missing flexibility/classification fields. */
export function migrateSavedRoute(value: unknown): SavedPocRoute | null {
  if (isSavedRoute(value)) {
    return value;
  }
  if (!isLegacySavedRoute(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;
  const targetDistanceMeters = record.targetDistanceMeters as number;
  const flexibilityMeters =
    isFiniteNumber(record.distanceFlexibilityMeters) && record.distanceFlexibilityMeters > 0
      ? record.distanceFlexibilityMeters
      : targetDistanceMeters * LEGACY_TOLERANCE_FRACTION;
  const alternativeRecord = record.alternative as Record<string, unknown>;
  const classification =
    alternativeRecord.distanceClassification === 'near_match' ? 'near_match' : 'within_range';
  const requestedRangeMeters = isRequestedRange(alternativeRecord.requestedRangeMeters)
    ? alternativeRecord.requestedRangeMeters
    : {
        min: Math.max(0, targetDistanceMeters - flexibilityMeters),
        max: targetDistanceMeters + flexibilityMeters,
      };

  return {
    id: record.id as string,
    savedAt: record.savedAt as string,
    label: record.label as string,
    start: record.start as SavedPocRoute['start'],
    targetDistanceMeters,
    distanceFlexibilityMeters: flexibilityMeters,
    costing: record.costing as 'road' | 'gravel',
    seed: record.seed as number,
    alternative: {
      id: alternativeRecord.id as string,
      name: alternativeRecord.name as string,
      geometry: alternativeRecord.geometry as SavedPocRoute['alternative']['geometry'],
      distanceMeters: alternativeRecord.distanceMeters as number,
      durationSeconds: alternativeRecord.durationSeconds as number,
      distanceFromTargetMeters: alternativeRecord.distanceFromTargetMeters as number,
      bearingFamily: alternativeRecord.bearingFamily as string,
      warnings: alternativeRecord.warnings as string[],
      distanceClassification: classification,
      requestedRangeMeters,
      ...(isFiniteNumber(alternativeRecord.rangeDeviationMeters)
        ? { rangeDeviationMeters: alternativeRecord.rangeDeviationMeters }
        : {}),
      ...(isFiniteNumber(alternativeRecord.targetDifferencePercent)
        ? { targetDifferencePercent: alternativeRecord.targetDifferencePercent }
        : {}),
    },
    ...(record.feedback !== undefined
      ? { feedback: record.feedback as NonNullable<SavedPocRoute['feedback']> }
      : {}),
  };
}

export function loadPocStore(
  storage: Pick<Storage, 'getItem'> & Partial<Pick<Storage, 'setItem'>> = localStorage,
): PocLocalStoreV1 {
  const raw = storage.getItem(POC_STORAGE_KEY);
  const store = parsePocStore(raw);
  // Persist migrated legacy records so subsequent loads keep the upgraded shape.
  if (
    raw !== null &&
    raw.trim() !== '' &&
    store.routes.length > 0 &&
    typeof storage.setItem === 'function'
  ) {
    try {
      const parsed = JSON.parse(raw) as { routes?: unknown[] };
      const needsRewrite =
        Array.isArray(parsed.routes) &&
        parsed.routes.some((route) => isLegacySavedRoute(route) && !isSavedRoute(route));
      if (needsRewrite) {
        storage.setItem(POC_STORAGE_KEY, JSON.stringify(store));
      }
    } catch {
      // Ignore rewrite failures; in-memory migrated store is still usable.
    }
  }
  return store;
}

export function savePocStore(
  store: PocLocalStoreV1,
  storage: Pick<Storage, 'setItem'> = localStorage,
): void {
  storage.setItem(POC_STORAGE_KEY, JSON.stringify(store));
}

export function upsertSavedRoute(store: PocLocalStoreV1, route: SavedPocRoute): PocLocalStoreV1 {
  const without = store.routes.filter((item) => item.id !== route.id);
  return { version: 1, routes: [route, ...without] };
}

export function deleteSavedRoute(store: PocLocalStoreV1, id: string): PocLocalStoreV1 {
  return { version: 1, routes: store.routes.filter((item) => item.id !== id) };
}
