import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildNominatimReverseUrl,
  NOMINATIM_MIN_INTERVAL_MS,
  pickStartAreaLabel,
  resolveStartAreaLabel,
  START_AREA_FALLBACK_LABEL,
  START_AREA_RESOLVE_DEBOUNCE_MS,
  StartAreaResolver,
  startAreaCacheKey,
} from './start-area';

describe('start area label', () => {
  it('prefers city/town over coarser address fields and never returns coordinates', () => {
    expect(
      pickStartAreaLabel({
        neighbourhood: 'Leucadia',
        city: 'Encinitas',
        county: 'San Diego County',
        state: 'California',
      }),
    ).toBe('Encinitas');

    expect(
      pickStartAreaLabel({
        town: 'Boulder',
        state: 'Colorado',
      }),
    ).toBe('Boulder');

    expect(pickStartAreaLabel({ state: 'California' })).toBe('California');
    expect(pickStartAreaLabel(undefined, 'Golden Gate Park')).toBe('Golden Gate Park');
    expect(pickStartAreaLabel(undefined)).toBe(START_AREA_FALLBACK_LABEL);
    expect(pickStartAreaLabel({ city: '  Austin  ' })).toBe('Austin');
  });

  it('builds a same-origin Nominatim reverse URL for the Vite proxy', () => {
    const url = buildNominatimReverseUrl({ latitude: 37.7694, longitude: -122.4862 });
    expect(url.startsWith('/nominatim/reverse?')).toBe(true);
    expect(url).toContain('lat=37.7694');
    expect(url).toContain('lon=-122.4862');
    expect(url).toContain('addressdetails=1');
  });

  it('resolves a start-area label from Nominatim JSON and falls back safely', async () => {
    const fetchOk = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        address: { city: 'San Francisco', state: 'California' },
      }),
    })) as unknown as typeof fetch;

    await expect(
      resolveStartAreaLabel({ latitude: 37.77, longitude: -122.42 }, { fetch: fetchOk }),
    ).resolves.toBe('San Francisco');

    const fetchFail = vi.fn(async () => {
      throw new Error('network');
    }) as unknown as typeof fetch;

    await expect(
      resolveStartAreaLabel({ latitude: 37.77, longitude: -122.42 }, { fetch: fetchFail }),
    ).resolves.toBe(START_AREA_FALLBACK_LABEL);

    const fetchBad = vi.fn(async () => ({
      ok: false,
      json: async () => ({}),
    })) as unknown as typeof fetch;

    await expect(
      resolveStartAreaLabel({ latitude: 37.77, longitude: -122.42 }, { fetch: fetchBad }),
    ).resolves.toBe(START_AREA_FALLBACK_LABEL);
  });

  it('rethrows abort errors instead of degrading to Local', async () => {
    const fetchAbort = vi.fn(async (_url: string, init?: RequestInit) => {
      const error = new DOMException('Aborted', 'AbortError');
      if (init?.signal) {
        Object.defineProperty(init.signal, 'aborted', { value: true });
      }
      throw error;
    }) as unknown as typeof fetch;

    const controller = new AbortController();
    controller.abort();
    await expect(
      resolveStartAreaLabel(
        { latitude: 37.77, longitude: -122.42 },
        { fetch: fetchAbort, signal: controller.signal },
      ),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('StartAreaResolver', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function createFetch(city: string) {
    return vi.fn(async () => ({
      ok: true,
      json: async () => ({ address: { city } }),
    })) as unknown as typeof fetch;
  }

  it('serves cache hits immediately without fetching', () => {
    const fetchImpl = createFetch('Encinitas');
    const resolver = new StartAreaResolver({ fetch: fetchImpl, debounceMs: 0, minIntervalMs: 0 });
    const coordinate = { latitude: 33.037, longitude: -117.292 };
    resolver.remember(coordinate, 'Encinitas');

    const onResolved = vi.fn();
    resolver.request(coordinate, onResolved);

    expect(onResolved).toHaveBeenCalledWith('Encinitas');
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(startAreaCacheKey(coordinate)).toBe('33.037,-117.292');
  });

  it('debounces rapid requests and only fetches the latest coordinate', async () => {
    vi.useFakeTimers();
    const fetchImpl = createFetch('Austin');
    const now = 0;
    const resolver = new StartAreaResolver({
      fetch: fetchImpl,
      now: () => now,
      debounceMs: START_AREA_RESOLVE_DEBOUNCE_MS,
      minIntervalMs: 0,
    });

    const first = vi.fn();
    const second = vi.fn();
    resolver.request({ latitude: 30.0, longitude: -97.0 }, first);
    resolver.request({ latitude: 30.2672, longitude: -97.7431 }, second);

    expect(fetchImpl).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(START_AREA_RESOLVE_DEBOUNCE_MS);
    await Promise.resolve();

    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith('Austin');
  });

  it('aborts an in-flight lookup when a newer request is scheduled', async () => {
    vi.useFakeTimers();
    let now = 0;
    let callCount = 0;
    let releaseFirst: ((value: unknown) => void) | undefined;
    const fetchImpl = vi.fn((_url: string, init?: RequestInit) => {
      callCount += 1;
      if (callCount === 1) {
        return new Promise((resolve, reject) => {
          releaseFirst = resolve;
          init?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          });
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ address: { city: 'Boulder' } }),
      });
    }) as unknown as typeof fetch;

    const resolver = new StartAreaResolver({
      fetch: fetchImpl,
      now: () => now,
      debounceMs: 0,
      minIntervalMs: 0,
    });

    const first = vi.fn();
    const second = vi.fn();
    resolver.request({ latitude: 40.0, longitude: -105.0 }, first);
    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();

    resolver.request({ latitude: 40.015, longitude: -105.271 }, second);
    await vi.advanceTimersByTimeAsync(0);
    now += NOMINATIM_MIN_INTERVAL_MS;
    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();
    await Promise.resolve();

    releaseFirst?.({
      ok: true,
      json: async () => ({ address: { city: 'Stale' } }),
    });
    await Promise.resolve();

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith('Boulder');
  });

  it('serializes lookups with at least the Nominatim minimum interval', async () => {
    vi.useFakeTimers();
    let now = 1_000;
    const fetchImpl = createFetch('San Diego');
    const resolver = new StartAreaResolver({
      fetch: fetchImpl,
      now: () => now,
      debounceMs: 0,
      minIntervalMs: NOMINATIM_MIN_INTERVAL_MS,
    });

    const first = vi.fn();
    const second = vi.fn();
    resolver.request({ latitude: 32.7, longitude: -117.1 }, first);
    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(first).toHaveBeenCalledWith('San Diego');

    resolver.request({ latitude: 32.8, longitude: -117.2 }, second);
    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();
    expect(fetchImpl).toHaveBeenCalledOnce();

    now += NOMINATIM_MIN_INTERVAL_MS;
    await vi.advanceTimersByTimeAsync(NOMINATIM_MIN_INTERVAL_MS);
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(second).toHaveBeenCalledWith('San Diego');
  });

  it('resolveForExport uses cache and avoids an extra network call', async () => {
    const fetchImpl = createFetch('Encinitas');
    const resolver = new StartAreaResolver({ fetch: fetchImpl, debounceMs: 0, minIntervalMs: 0 });
    const coordinate = { latitude: 33.037, longitude: -117.292 };
    resolver.remember(coordinate, 'Encinitas');

    await expect(resolver.resolveForExport(coordinate)).resolves.toBe('Encinitas');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
