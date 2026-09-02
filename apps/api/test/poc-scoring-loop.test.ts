import { describe, expect, it } from 'vitest';
import {
  analyzeLoopQuality,
  scoreGeometryQuality,
  scoreLoopQuality,
} from '../src/poc/scoring/geometry-quality';

function loop(size = 0.02): Array<[number, number]> {
  return [
    [-122.42, 37.77],
    [-122.42 + size, 37.77],
    [-122.42 + size, 37.77 + size],
    [-122.42, 37.77 + size],
    [-122.42, 37.77],
  ];
}

describe('loop quality scoring', () => {
  it('scores a clean closed loop highly', () => {
    const metrics = analyzeLoopQuality({ type: 'LineString', coordinates: loop() });
    expect(metrics.closureDistanceMeters).toBeLessThan(5);
    expect(scoreLoopQuality(metrics)).toBeGreaterThan(70);
  });

  it('does not penalize open endpoints on point-to-point routes', () => {
    const open = loop();
    open[open.length - 1] = [-122.4, 37.8];
    const metrics = analyzeLoopQuality({ type: 'LineString', coordinates: open });
    const closedScore = scoreLoopQuality(analyzeLoopQuality({ type: 'LineString', coordinates: loop() }));
    const openLoopScore = scoreLoopQuality(metrics);
    const openPathScore = scoreGeometryQuality(metrics, 'point_to_point');
    expect(openLoopScore).toBeLessThan(closedScore);
    expect(openPathScore).toBeGreaterThan(openLoopScore);
  });

  it('penalizes open endpoints', () => {
    const open = loop();
    open[open.length - 1] = [-122.4, 37.8];
    const metrics = analyzeLoopQuality({ type: 'LineString', coordinates: open });
    expect(metrics.closureDistanceMeters).toBeGreaterThan(100);
    expect(scoreLoopQuality(metrics)).toBeLessThan(
      scoreLoopQuality(analyzeLoopQuality({ type: 'LineString', coordinates: loop() })),
    );
  });

  it('flags empty geometry as malformed', () => {
    const metrics = analyzeLoopQuality({ type: 'LineString', coordinates: [] });
    expect(metrics.malformedGeometryWarning).toBe(true);
    expect(scoreLoopQuality(metrics)).toBe(0);
  });
});
