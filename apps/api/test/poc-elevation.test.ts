import { describe, expect, it } from 'vitest';
import { summarizeHeights } from '../src/poc/elevation/provider';
import { scoreElevationPreference } from '../src/poc/scoring/preferences';
import type { ElevationSummary } from '../src/poc/elevation/provider';

describe('elevation enrichment and scoring', () => {
  it('treats missing heights as unknown rather than zero', () => {
    const summary = summarizeHeights([null, null], 10_000, 1609.344);
    expect(summary.status).toBe('unknown');
    expect(summary.gainMeters).toBeNull();
    expect(summary.gainPerMile).toBeNull();
  });

  it('does not score when preference is none', () => {
    const elevation: ElevationSummary = {
      status: 'ok',
      gainMeters: 200,
      lossMeters: 200,
      minMeters: 10,
      maxMeters: 100,
      gainPerMile: 20,
      coverage: 1,
      confidence: 'high',
      provider: 'valhalla_height',
    };
    const scored = scoreElevationPreference('none', elevation);
    expect(scored.applicable).toBe(false);
    expect(scored.score).toBeNull();
  });

  it('prefers flatter routes when requested', () => {
    const flat: ElevationSummary = {
      status: 'ok',
      gainMeters: 50,
      lossMeters: 50,
      minMeters: 10,
      maxMeters: 30,
      gainPerMile: 8,
      coverage: 1,
      confidence: 'high',
      provider: 'valhalla_height',
    };
    const hilly: ElevationSummary = {
      ...flat,
      gainPerMile: 60,
    };
    expect(scoreElevationPreference('flatter', flat).score!).toBeGreaterThan(
      scoreElevationPreference('flatter', hilly).score!,
    );
  });
});
