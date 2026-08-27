import { POC_CONFIG } from '../config';
import { POC_SCORING_CONFIG } from '../scoring/config';
import { valhallaUpstreamHeaders } from '../routing/valhalla-mapping';
import {
  sampleRouteForElevation,
  summarizeHeights,
  type ElevationProvider,
  type ElevationRequest,
  type ElevationSummary,
} from './provider';

type HeightResponse = {
  height?: Array<number | null>;
  range_height?: Array<[number, number | null]>;
};

export type ValhallaHeightProviderOptions = {
  baseUrl: string;
  clientId?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export class ValhallaHeightProvider implements ElevationProvider {
  private readonly baseUrl: string;
  private readonly clientId: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: ValhallaHeightProviderOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.clientId = options.clientId ?? POC_CONFIG.valhallaClientId;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? POC_SCORING_CONFIG.elevation.timeoutMs;
  }

  async profile(request: ElevationRequest): Promise<ElevationSummary> {
    const samples = sampleRouteForElevation(
      request.geometry,
      POC_SCORING_CONFIG.elevation.maxSamplePoints,
    );
    if (samples.length < 2) {
      return {
        status: 'unknown',
        gainMeters: null,
        lossMeters: null,
        minMeters: null,
        maxMeters: null,
        gainPerMile: null,
        coverage: 0,
        confidence: 'unknown',
        provider: 'valhalla_height',
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const onAbort = () => controller.abort();
    request.signal?.addEventListener('abort', onAbort);

    try {
      const response = await this.fetchImpl(`${this.baseUrl}/height`, {
        method: 'POST',
        headers: valhallaUpstreamHeaders(this.clientId),
        body: JSON.stringify({
          range: true,
          shape: samples.map((point) => ({ lat: point.latitude, lon: point.longitude })),
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        return unavailable();
      }
      const payload = (await response.json()) as HeightResponse;
      const heights =
        payload.range_height?.map((pair) => (pair[1] === null ? null : pair[1])) ??
        payload.height ??
        [];
      return {
        ...summarizeHeights(heights, request.distanceMeters, POC_SCORING_CONFIG.metersPerMile),
        provider: 'valhalla_height',
      };
    } catch {
      return unavailable();
    } finally {
      clearTimeout(timer);
      request.signal?.removeEventListener('abort', onAbort);
    }
  }
}

function unavailable(): ElevationSummary {
  return {
    status: 'unavailable',
    gainMeters: null,
    lossMeters: null,
    minMeters: null,
    maxMeters: null,
    gainPerMile: null,
    coverage: null,
    confidence: 'unknown',
    provider: 'valhalla_height',
  };
}
