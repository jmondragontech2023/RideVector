import type { PocCoordinate } from './types';

export const START_AREA_FALLBACK_LABEL = 'Local';

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

/**
 * Resolves a coarse start-area place name for GPX filenames.
 * Falls back to Local on network/parse failures; never embeds coordinates.
 */
export async function resolveStartAreaLabel(
  coordinate: PocCoordinate,
  deps: {
    fetch?: typeof fetch;
    signal?: AbortSignal;
  } = {},
): Promise<string> {
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
      return START_AREA_FALLBACK_LABEL;
    }
    const payload = (await response.json()) as NominatimReverseResponse;
    if (payload.error) {
      return START_AREA_FALLBACK_LABEL;
    }
    return pickStartAreaLabel(payload.address, payload.name);
  } catch {
    return START_AREA_FALLBACK_LABEL;
  }
}
