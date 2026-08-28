import type { PocCoordinate } from './types';

export const START_AREA_FALLBACK_LABEL = 'Local';

/** Nominatim usage policy is 1 request/second; leave a small buffer. */
export const NOMINATIM_MIN_INTERVAL_MS = 1_100;

/** Wait for map-click bursts to settle before geocoding. */
export const START_AREA_RESOLVE_DEBOUNCE_MS = 450;

/** ~110 m grid — enough to reuse labels across nearby clicks. */
export const START_AREA_CACHE_PRECISION = 3;

export type NominatimAddress = {
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  city_district?: string;
  suburb?: string;
  neighbourhood?: string;
  county?: string;
  state?: string;
};

export type NominatimReverseResponse = {
  address?: NominatimAddress;
  name?: string;
  error?: string;
};

const PLACE_FIELD_PRIORITY: Array<keyof NominatimAddress> = [
  'city',
  'town',
  'village',
  'municipality',
  'city_district',
  'suburb',
  'neighbourhood',
  'county',
];

/**
 * Picks a human start-area label from a Nominatim address.
 * Never returns coordinates.
 */
export function pickStartAreaLabel(
  address: NominatimAddress | undefined,
  fallbackName?: string,
): string {
  if (address) {
    for (const field of PLACE_FIELD_PRIORITY) {
      const value = address[field]?.trim();
      if (value) {
        return value;
      }
    }
    const state = address.state?.trim();
    if (state) {
      return state;
    }
  }

  const named = fallbackName?.trim();
  if (named) {
    return named;
  }

  return START_AREA_FALLBACK_LABEL;
}

export function startAreaCacheKey(
  coordinate: PocCoordinate,
  precision = START_AREA_CACHE_PRECISION,
): string {
  return `${coordinate.latitude.toFixed(precision)},${coordinate.longitude.toFixed(precision)}`;
}

export function buildNominatimReverseUrl(coordinate: PocCoordinate): string {
  const params = new URLSearchParams({
    format: 'jsonv2',
    lat: String(coordinate.latitude),
    lon: String(coordinate.longitude),
    zoom: '12',
    addressdetails: '1',
  });
  // Same-origin path; Vite proxies to Nominatim in local/mobile dev to avoid CORS.
  return `/nominatim/reverse?${params.toString()}`;
}

function isAbortError(error: unknown): boolean {
  return (
    (typeof DOMException !== 'undefined' &&
      error instanceof DOMException &&
      error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  );
}

/**
 * Resolves a coarse start-area place name for GPX filenames.
 * Never embeds coordinates. AbortError is rethrown so callers can ignore superseded requests.
 *
 * `resolved` means Nominatim returned a usable HTTP/JSON response (label may still be Local
 * when the place truly has no city-like field). `unavailable` covers transient failures such as
 * network errors and HTTP 429 — those must not be cached.
 */
export type StartAreaLookupResult =
  | { status: 'resolved'; label: string }
  | { status: 'unavailable'; label: typeof START_AREA_FALLBACK_LABEL };

export async function resolveStartAreaLabel(
  coordinate: PocCoordinate,
  deps: {
    fetch?: typeof fetch;
    signal?: AbortSignal;
  } = {},
): Promise<StartAreaLookupResult> {
  const fetchImpl = deps.fetch ?? fetch;
  try {
    const response = await fetchImpl(buildNominatimReverseUrl(coordinate), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: deps.signal,
    });
    if (!response.ok) {
      return { status: 'unavailable', label: START_AREA_FALLBACK_LABEL };
    }
    const payload = (await response.json()) as NominatimReverseResponse;
    if (payload.error) {
      return { status: 'unavailable', label: START_AREA_FALLBACK_LABEL };
    }
    return {
      status: 'resolved',
      label: pickStartAreaLabel(payload.address, payload.name),
    };
  } catch (error) {
    if (deps.signal?.aborted || isAbortError(error)) {
      throw error instanceof Error ? error : new DOMException('Aborted', 'AbortError');
    }
    return { status: 'unavailable', label: START_AREA_FALLBACK_LABEL };
  }
}

export type StartAreaResolverDependencies = {
  fetch?: typeof fetch;
  now?: () => number;
  setTimeoutFn?: typeof setTimeout;
  clearTimeoutFn?: typeof clearTimeout;
  debounceMs?: number;
  minIntervalMs?: number;
};

/**
 * Debounces, rate-limits, aborts, and caches Nominatim reverse lookups.
 */
export class StartAreaResolver {
  private readonly cache = new Map<string, string>();
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;
  private readonly setTimeoutFn: typeof setTimeout;
  private readonly clearTimeoutFn: typeof clearTimeout;
  private readonly debounceMs: number;
  private readonly minIntervalMs: number;

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private abortController: AbortController | null = null;
  private exportAbortController: AbortController | null = null;
  private generation = 0;
  private lastRequestStartedAt = Number.NEGATIVE_INFINITY;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(deps: StartAreaResolverDependencies = {}) {
    this.fetchImpl = deps.fetch ?? fetch;
    this.now = deps.now ?? (() => Date.now());
    this.setTimeoutFn = deps.setTimeoutFn ?? setTimeout;
    this.clearTimeoutFn = deps.clearTimeoutFn ?? clearTimeout;
    this.debounceMs = deps.debounceMs ?? START_AREA_RESOLVE_DEBOUNCE_MS;
    this.minIntervalMs = deps.minIntervalMs ?? NOMINATIM_MIN_INTERVAL_MS;
  }

  getCached(coordinate: PocCoordinate): string | undefined {
    return this.cache.get(startAreaCacheKey(coordinate));
  }

  /** Seeds the cache (fixture labels / known places) without calling Nominatim. */
  remember(coordinate: PocCoordinate, label: string): void {
    const trimmed = label.trim();
    // Never persist the unavailable fallback — that would block later retries.
    if (!trimmed || trimmed === START_AREA_FALLBACK_LABEL) {
      return;
    }
    this.cache.set(startAreaCacheKey(coordinate), trimmed);
  }

  cancelPending(): void {
    this.generation += 1;
    if (this.debounceTimer !== null) {
      this.clearTimeoutFn(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.abortController?.abort();
    this.abortController = null;
  }

  /**
   * Schedules a debounced reverse lookup. Cache hits resolve immediately.
   * Superseded callbacks are not invoked.
   */
  request(coordinate: PocCoordinate, onResolved: (label: string) => void): void {
    const cached = this.getCached(coordinate);
    if (cached) {
      this.cancelPending();
      onResolved(cached);
      return;
    }

    this.generation += 1;
    const generation = this.generation;
    if (this.debounceTimer !== null) {
      this.clearTimeoutFn(this.debounceTimer);
    }
    this.abortController?.abort();
    this.abortController = null;

    this.debounceTimer = this.setTimeoutFn(() => {
      this.debounceTimer = null;
      if (generation !== this.generation) {
        return;
      }
      void this.runSerialized(coordinate, generation, onResolved);
    }, this.debounceMs);
  }

  /** Used by Download GPX — prefers cache, then a rate-limited live lookup. */
  async resolveForExport(coordinate: PocCoordinate): Promise<string> {
    const cached = this.getCached(coordinate);
    if (cached) {
      return cached;
    }

    // Stop pending UI lookups so they do not race the export fetch, but do not
    // tie export success to the UI generation counter (map clicks must not force Local).
    if (this.debounceTimer !== null) {
      this.clearTimeoutFn(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.generation += 1;
    this.abortController?.abort();
    this.abortController = null;

    this.exportAbortController?.abort();
    const exportController = new AbortController();
    this.exportAbortController = exportController;

    const label = await this.enqueueLookup(async () => {
      if (exportController.signal.aborted) {
        return undefined;
      }

      const cachedAgain = this.getCached(coordinate);
      if (cachedAgain) {
        return cachedAgain;
      }

      const waitMs = Math.max(0, this.minIntervalMs - (this.now() - this.lastRequestStartedAt));
      if (waitMs > 0) {
        await new Promise<void>((resolve) => {
          this.setTimeoutFn(resolve, waitMs);
        });
      }
      if (exportController.signal.aborted) {
        return undefined;
      }

      this.lastRequestStartedAt = this.now();
      try {
        const result = await resolveStartAreaLabel(coordinate, {
          fetch: this.fetchImpl,
          signal: exportController.signal,
        });
        if (exportController.signal.aborted) {
          return undefined;
        }
        if (result.status === 'resolved' && result.label !== START_AREA_FALLBACK_LABEL) {
          this.remember(coordinate, result.label);
        }
        return result.label;
      } catch (error) {
        if (isAbortError(error) || exportController.signal.aborted) {
          return undefined;
        }
        return START_AREA_FALLBACK_LABEL;
      }
    });

    if (this.exportAbortController === exportController) {
      this.exportAbortController = null;
    }
    return label ?? START_AREA_FALLBACK_LABEL;
  }

  private async runSerialized(
    coordinate: PocCoordinate,
    generation: number,
    onResolved: (label: string) => void,
  ): Promise<string | undefined> {
    return this.enqueueLookup(async () => {
      if (generation !== this.generation) {
        return undefined;
      }

      const cached = this.getCached(coordinate);
      if (cached) {
        onResolved(cached);
        return cached;
      }

      const waitMs = Math.max(0, this.minIntervalMs - (this.now() - this.lastRequestStartedAt));
      if (waitMs > 0) {
        await new Promise<void>((resolve) => {
          this.setTimeoutFn(resolve, waitMs);
        });
      }
      if (generation !== this.generation) {
        return undefined;
      }

      const controller = new AbortController();
      this.abortController = controller;
      this.lastRequestStartedAt = this.now();

      try {
        const result = await resolveStartAreaLabel(coordinate, {
          fetch: this.fetchImpl,
          signal: controller.signal,
        });
        if (generation !== this.generation || controller.signal.aborted) {
          return undefined;
        }
        if (result.status === 'resolved' && result.label !== START_AREA_FALLBACK_LABEL) {
          this.remember(coordinate, result.label);
        }
        onResolved(result.label);
        return result.label;
      } catch (error) {
        if (isAbortError(error) || generation !== this.generation) {
          return undefined;
        }
        onResolved(START_AREA_FALLBACK_LABEL);
        return START_AREA_FALLBACK_LABEL;
      } finally {
        if (this.abortController === controller) {
          this.abortController = null;
        }
      }
    });
  }

  private enqueueLookup<T>(run: () => Promise<T>): Promise<T> {
    const next = this.queue.then(run, run);
    this.queue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }
}
