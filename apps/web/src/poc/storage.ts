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

function isSavedRoute(value: unknown): value is SavedPocRoute {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.savedAt === 'string' &&
    typeof record.label === 'string' &&
    typeof record.alternative === 'object' &&
    record.alternative !== null
  );
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
