import { describe, expect, it } from 'vitest';
import { DEFAULT_POC_FEATURES } from '../src/poc/features';
import { combineComponentScores } from '../src/poc/scoring/combine';

describe('combineComponentScores', () => {
  it('normalizes geometry-only weights to 100', () => {
    const result = combineComponentScores({
      features: { ...DEFAULT_POC_FEATURES },
      distanceFit: { score: 90, raw: { insideRange: true } },
      loopQuality: { score: 80, raw: {} },
      diversity: { score: 70, raw: {} },
      elevation: null,
      motorTraffic: null,
      weather: null,
    });
    const weights = Object.values(result.components).map((component) => component?.weight ?? 0);
    expect(weights.reduce((sum, value) => sum + value, 0)).toBeCloseTo(100, 0);
    expect(result.overallScore).toBeGreaterThan(70);
    expect(result.version).toBe('poc-scoring-v2');
  });

  it('excludes disabled components from normalization', () => {
    const result = combineComponentScores({
      features: {
        ...DEFAULT_POC_FEATURES,
        loopQualityScoring: false,
        routeDiversityScoring: false,
      },
      distanceFit: { score: 88, raw: { insideRange: true } },
      loopQuality: { score: 10, raw: {} },
      diversity: { score: 10, raw: {} },
      elevation: null,
      motorTraffic: null,
      weather: null,
    });
    expect(result.components.distanceFit?.weight).toBe(100);
    expect(result.components.loopQuality).toBeUndefined();
    expect(result.overallScore).toBe(88);
  });

  it('uses path-quality language for point-to-point routes', () => {
    const result = combineComponentScores({
      features: { ...DEFAULT_POC_FEATURES },
      routeMode: 'point_to_point',
      distanceFit: { score: 90, raw: { insideRange: true } },
      loopQuality: { score: 80, raw: {} },
      diversity: { score: 70, raw: {} },
      elevation: null,
      motorTraffic: null,
      weather: null,
    });
    expect(result.explanations).toContain('clean path shape');
    expect(result.explanationCodes).toContain('path_quality_clean');
    expect(result.explanations).not.toContain('clean loop shape');
  });
});
