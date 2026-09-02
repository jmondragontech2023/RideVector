import { describe, expect, it } from 'vitest';
import { POC_SCENARIO_FIXTURES } from './fixtures';
import { milesToMeters } from './units';

describe('POC scenario fixtures', () => {
  it('provides public loop and start-to-end scenarios', () => {
    expect(POC_SCENARIO_FIXTURES.length).toBeGreaterThanOrEqual(5);
    expect(
      POC_SCENARIO_FIXTURES.filter((fixture) => fixture.routeMode === 'point_to_point'),
    ).toHaveLength(2);
  });

  it('keeps coordinates in WGS84 bounds and uses canonical mile conversion', () => {
    for (const fixture of POC_SCENARIO_FIXTURES) {
      expect(fixture.start.latitude).toBeGreaterThanOrEqual(-90);
      expect(fixture.start.latitude).toBeLessThanOrEqual(90);
      expect(fixture.start.longitude).toBeGreaterThanOrEqual(-180);
      expect(fixture.start.longitude).toBeLessThanOrEqual(180);
      expect(fixture.targetDistanceMiles).toBeGreaterThan(0);
      expect(milesToMeters(fixture.targetDistanceMiles)).toBe(
        fixture.targetDistanceMiles * 1609.344,
      );
      expect(['road', 'gravel']).toContain(fixture.costing);
      expect(Number.isInteger(fixture.seed)).toBe(true);
      if (fixture.routeMode === 'point_to_point') {
        expect(fixture.end).toBeDefined();
        expect(fixture.end?.latitude).toBeGreaterThanOrEqual(-90);
        expect(fixture.end?.latitude).toBeLessThanOrEqual(90);
        expect(fixture.end?.longitude).toBeGreaterThanOrEqual(-180);
        expect(fixture.end?.longitude).toBeLessThanOrEqual(180);
      }
    }
  });
});
