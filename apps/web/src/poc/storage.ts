export type WouldRide = 'yes' | 'maybe' | 'no';

export type SavedPocRoute = {
  id: string;
  savedAt: string;
  label: string;
  start: { latitude: number; longitude: number };
  targetDistanceMeters: number;
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
  };
  feedback?: {
    wouldRide: WouldRide;
    reason?: string;
  };
};

export type PocLocalStoreV1 = {
  version: 1;
  routes: SavedPocRoute[];
};

export const POC_STORAGE_KEY = 'ridevector.poc.routes.v1';

export function emptyStore(): PocLocalStoreV1 {
  return { version: 1, routes: [] };
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
    return {
      version: 1,
      routes: (parsed as PocLocalStoreV1).routes.filter(isSavedRoute),
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

function isAlternative(value: unknown): value is SavedPocRoute['alternative'] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
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

function isFeedback(value: unknown): value is NonNullable<SavedPocRoute['feedback']> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  if (record.wouldRide !== 'yes' && record.wouldRide !== 'maybe' && record.wouldRide !== 'no') {
    return false;
  }
  if (record.reason === undefined) {
    return true;
  }
  return typeof record.reason === 'string';
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

export function loadPocStore(storage: Pick<Storage, 'getItem'> = localStorage): PocLocalStoreV1 {
  return parsePocStore(storage.getItem(POC_STORAGE_KEY));
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
