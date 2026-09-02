import type { PocCoordinate } from '../types';

export type TrafficSampleRequest = {
  coordinate: PocCoordinate;
  signal?: AbortSignal;
};

export type TrafficSample = {
  status: 'ok' | 'unavailable' | 'timeout' | 'error';
  /** Safe HTTP status when the upstream responded with a non-OK code. */
  httpStatus?: number | null;
  currentSpeedKmh: number | null;
  freeFlowSpeedKmh: number | null;
  currentFreeFlowRatio: number | null;
  functionalRoadClass: string | null;
  confidence: number | null;
  roadClosure: boolean | null;
  observedAtIso: string | null;
};

export type TrafficRouteSummary = {
  status: 'ok' | 'unknown' | 'unavailable' | 'partial';
  baselineExposure: number | null;
  exposureLabel:
    | 'lower_estimated_motor_traffic_exposure'
    | 'moderate_estimated_motor_traffic_exposure'
    | 'higher_estimated_motor_traffic_exposure'
    | 'insufficient_traffic_coverage'
    | null;
  currentCongestionDetected: boolean;
  coverage: number | null;
  confidence: 'high' | 'medium' | 'low' | 'unknown';
  sampleCount: number;
  usableSampleCount: number;
  closuresDetected: boolean;
  provider: 'tomtom_flow';
  warnings: string[];
};

export interface TrafficProvider {
  sample(request: TrafficSampleRequest): Promise<TrafficSample>;
}

/** Map TomTom FRC + free-flow speed to a baseline exposure proxy 0–100 (higher = more exposure). */
export function baselineExposureFromSample(sample: TrafficSample): number | null {
  if (sample.status !== 'ok' || sample.functionalRoadClass === null) {
    return null;
  }
  const frcMatch = /^FRC(\d+)$/i.exec(sample.functionalRoadClass);
  const frc = frcMatch ? Number(frcMatch[1]) : 3;
  // FRC0 motorway → high exposure; FRC6 local → lower exposure.
  const classComponent = ((6 - Math.min(6, Math.max(0, frc))) / 6) * 70;
  const freeFlow = sample.freeFlowSpeedKmh ?? 40;
  const speedComponent = Math.min(30, (freeFlow / 100) * 30);
  return Math.max(0, Math.min(100, Math.round(classComponent + speedComponent)));
}

export function summarizeTrafficSamples(samples: TrafficSample[]): TrafficRouteSummary {
  const usable = samples.filter((sample) => sample.status === 'ok');
  const coverage = samples.length === 0 ? 0 : usable.length / samples.length;
  if (usable.length === 0) {
    return {
      status: 'unavailable',
      baselineExposure: null,
      exposureLabel: 'insufficient_traffic_coverage',
      currentCongestionDetected: false,
      coverage: 0,
      confidence: 'unknown',
      sampleCount: samples.length,
      usableSampleCount: 0,
      closuresDetected: false,
      provider: 'tomtom_flow',
      warnings: ['Insufficient traffic coverage'],
    };
  }

  const exposures = usable
    .map((sample) => baselineExposureFromSample(sample))
    .filter((value): value is number => value !== null);
  const baselineExposure =
    exposures.length === 0
      ? null
      : Math.round(exposures.reduce((sum, value) => sum + value, 0) / exposures.length);

  let congestion = false;
  for (const sample of usable) {
    if (
      sample.currentFreeFlowRatio !== null &&
      sample.currentFreeFlowRatio < 0.65 &&
      (sample.freeFlowSpeedKmh ?? 0) >= 40
    ) {
      congestion = true;
    }
  }

  const closuresDetected = usable.some((sample) => sample.roadClosure === true);
  const warnings: string[] = [];
  if (congestion) {
    warnings.push('Current congestion detected');
  }
  if (closuresDetected) {
    warnings.push('Road closure indicated on sampled segment');
  }
  if (coverage < 0.6) {
    warnings.push('Insufficient traffic coverage');
  }

  let exposureLabel: TrafficRouteSummary['exposureLabel'] = 'insufficient_traffic_coverage';
  if (baselineExposure !== null && coverage >= 0.6) {
    if (baselineExposure < 35) {
      exposureLabel = 'lower_estimated_motor_traffic_exposure';
    } else if (baselineExposure < 65) {
      exposureLabel = 'moderate_estimated_motor_traffic_exposure';
    } else {
      exposureLabel = 'higher_estimated_motor_traffic_exposure';
    }
  }

  return {
    status: coverage < 0.8 ? 'partial' : 'ok',
    baselineExposure,
    exposureLabel,
    currentCongestionDetected: congestion,
    coverage: Math.round(coverage * 1000) / 1000,
    confidence: coverage >= 0.9 ? 'high' : coverage >= 0.6 ? 'medium' : 'low',
    sampleCount: samples.length,
    usableSampleCount: usable.length,
    closuresDetected,
    provider: 'tomtom_flow',
    warnings,
  };
}

export function trafficExposureLabelText(
  label: TrafficRouteSummary['exposureLabel'],
): string | null {
  switch (label) {
    case 'lower_estimated_motor_traffic_exposure':
      return 'Lower estimated motor-traffic exposure';
    case 'moderate_estimated_motor_traffic_exposure':
      return 'Moderate estimated motor-traffic exposure';
    case 'higher_estimated_motor_traffic_exposure':
      return 'Higher estimated motor-traffic exposure';
    case 'insufficient_traffic_coverage':
      return 'Insufficient traffic coverage';
    default:
      return null;
  }
}
