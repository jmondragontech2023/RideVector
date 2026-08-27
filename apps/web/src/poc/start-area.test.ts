import { describe, expect, it, vi } from 'vitest';
import {
  buildNominatimReverseUrl,
  pickStartAreaLabel,
  resolveStartAreaLabel,
  START_AREA_FALLBACK_LABEL,
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
});
