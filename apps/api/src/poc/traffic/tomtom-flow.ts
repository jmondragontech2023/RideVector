import { POC_SCORING_CONFIG } from '../scoring/config';
import type { TrafficProvider, TrafficSample, TrafficSampleRequest } from './provider';

type TomTomFlowResponse = {
  flowSegmentData?: {
    frc?: string;
    currentSpeed?: number;
    freeFlowSpeed?: number;
    confidence?: number;
    roadClosure?: boolean;
  };
};

export type TomTomTrafficProviderOptions = {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

function failureSample(
  status: TrafficSample['status'],
  httpStatus: number | null = null,
): TrafficSample {
  return {
    status,
    httpStatus,
    currentSpeedKmh: null,
    freeFlowSpeedKmh: null,
    currentFreeFlowRatio: null,
    functionalRoadClass: null,
    confidence: null,
    roadClosure: null,
    observedAtIso: null,
  };
}

export class TomTomTrafficProvider implements TrafficProvider {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: TomTomTrafficProviderOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? 'https://api.tomtom.com').replace(/\/+$/, '');
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
    this.timeoutMs = options.timeoutMs ?? POC_SCORING_CONFIG.traffic.timeoutMs;
  }

  async sample(request: TrafficSampleRequest): Promise<TrafficSample> {
    const { zoom, style } = POC_SCORING_CONFIG.traffic;
    const point = `${request.coordinate.latitude},${request.coordinate.longitude}`;
    const url = new URL(`${this.baseUrl}/traffic/services/4/flowSegmentData/${style}/${zoom}/json`);
    url.searchParams.set('key', this.apiKey);
    url.searchParams.set('point', point);
    // Official TomTom parameter values are lowercase (`kmph` / `mph`).
    url.searchParams.set('unit', 'kmph');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const onAbort = () => controller.abort();
    request.signal?.addEventListener('abort', onAbort);

    try {
      const response = await this.fetchImpl(url.toString(), {
        method: 'GET',
        headers: { accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) {
        return failureSample('error', response.status);
      }
      const payload = (await response.json()) as TomTomFlowResponse;
      const data = payload.flowSegmentData;
      if (!data) {
        return failureSample('unavailable', response.status);
      }
      const current = data.currentSpeed ?? null;
      const free = data.freeFlowSpeed ?? null;
      return {
        status: 'ok',
        httpStatus: response.status,
        currentSpeedKmh: current,
        freeFlowSpeedKmh: free,
        currentFreeFlowRatio: current !== null && free !== null && free > 0 ? current / free : null,
        functionalRoadClass: data.frc ?? null,
        confidence: data.confidence ?? null,
        roadClosure: data.roadClosure ?? null,
        observedAtIso: new Date().toISOString(),
      };
    } catch (error) {
      const timedOut =
        error instanceof Error && (error.name === 'AbortError' || /abort/i.test(error.message));
      return failureSample(timedOut ? 'timeout' : 'error');
    } finally {
      clearTimeout(timer);
      request.signal?.removeEventListener('abort', onAbort);
    }
  }
}
