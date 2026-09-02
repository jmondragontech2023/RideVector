import { describe, expect, it } from 'vitest';
import {
  baselineExposureFromSample,
  summarizeTrafficSamples,
  type TrafficSample,
} from '../src/poc/traffic/provider';
import { scoreTrafficPreference } from '../src/poc/scoring/preferences';

function okSample(overrides: Partial<TrafficSample> = {}): TrafficSample {
  return {
    status: 'ok',
    currentSpeedKmh: 40,
    freeFlowSpeedKmh: 70,
    currentFreeFlowRatio: 40 / 70,
    functionalRoadClass: 'FRC2',
    confidence: 0.8,
    roadClosure: false,
    observedAtIso: '2026-08-26T18:00:00.000Z',
    ...overrides,
  };
}

describe('traffic normalization', () => {
  it('does not treat congestion as quiet traffic', () => {
    const congestedMajor = okSample({
      currentSpeedKmh: 15,
      freeFlowSpeedKmh: 90,
      currentFreeFlowRatio: 15 / 90,
      functionalRoadClass: 'FRC0',
    });
    const freeLocal = okSample({
      currentSpeedKmh: 30,
      freeFlowSpeedKmh: 30,
      currentFreeFlowRatio: 1,
      functionalRoadClass: 'FRC6',
    });
    expect(baselineExposureFromSample(congestedMajor)!).toBeGreaterThan(
      baselineExposureFromSample(freeLocal)!,
    );
    const summary = summarizeTrafficSamples([congestedMajor]);
    expect(summary.currentCongestionDetected).toBe(true);
    expect(summary.baselineExposure).toBeGreaterThan(50);
  });

  it('disables ranking applicability when coverage is insufficient', () => {
    const summary = summarizeTrafficSamples([
      okSample(),
      { ...okSample(), status: 'timeout' },
      { ...okSample(), status: 'error' },
    ]);
    expect(summary.coverage).toBeLessThan(0.6);
    expect(summary.exposureLabel).toBe('insufficient_traffic_coverage');
    const scored = scoreTrafficPreference('prefer_lower', summary, false);
    expect(scored.applicable).toBe(false);
  });

  it('applies conservative missing-data treatment when ranking is enabled', () => {
    const scored = scoreTrafficPreference('prefer_lower', null, true);
    expect(scored.applicable).toBe(true);
    expect(scored.score).toBe(40);
    expect(scored.raw.conservativeMissingData).toBe(true);
  });
});
