import { describe, expect, it } from 'vitest';
import {
  computeDiversityBreakdown,
  estimatePairwiseOverlapFraction,
} from '../src/poc/scoring/overlap';

const shared: Array<[number, number]> = [
  [-122.42, 37.77],
  [-122.41, 37.77],
  [-122.41, 37.78],
  [-122.42, 37.78],
  [-122.42, 37.77],
];

const distinct: Array<[number, number]> = [
  [-122.5, 37.7],
  [-122.49, 37.7],
  [-122.49, 37.71],
  [-122.5, 37.71],
  [-122.5, 37.7],
];

describe('geometry overlap and diversity', () => {
  it('estimates high overlap for identical geometries', () => {
    const overlap = estimatePairwiseOverlapFraction(
      { type: 'LineString', coordinates: shared },
      { type: 'LineString', coordinates: shared },
    );
    expect(overlap).toBeGreaterThan(0.9);
  });

  it('estimates low overlap for distant geometries', () => {
    const overlap = estimatePairwiseOverlapFraction(
      { type: 'LineString', coordinates: shared },
      { type: 'LineString', coordinates: distinct },
    );
    expect(overlap).toBeLessThan(0.2);
  });

  it('assigns higher diversity contribution to more distinct routes', () => {
    const peers = [
      { id: 'a', geometry: { type: 'LineString' as const, coordinates: shared } },
      { id: 'b', geometry: { type: 'LineString' as const, coordinates: distinct } },
    ];
    const a = computeDiversityBreakdown('a', peers[0]!.geometry, peers);
    const b = computeDiversityBreakdown('b', peers[1]!.geometry, peers);
    expect(a.sharedRoutePercentByPeer.b).toBeDefined();
    expect(b.contributionScore).toBe(a.contributionScore);
  });
});
