import { DEFAULT_DISTANCE_FLEXIBILITY_MILES } from './types';

/**
 * Five non-sensitive geographic fixtures for the route-generation POC.
 * Uses public landmarks / synthetic downtown points — never a contributor home.
 *
 * Tests assert request invariants (bounds, units, costing) rather than exact
 * third-party polylines.
 */

export type PocScenarioFixture = {
  id: string;
  label: string;
  description: string;
  /** Public landmark or synthetic downtown point. */
  start: { latitude: number; longitude: number };
  targetDistanceMiles: number;
  distanceFlexibilityMiles?: number;
  costing: 'road' | 'gravel';
  seed: number;
};

export const POC_SCENARIO_FIXTURES: readonly PocScenarioFixture[] = [
  {
    id: 'golden-gate-park',
    label: 'Golden Gate Park loop',
    description: 'Urban park-adjacent start in San Francisco.',
    start: { latitude: 37.7694, longitude: -122.4862 },
    targetDistanceMiles: 10,
    costing: 'road',
    seed: 1,
  },
  {
    id: 'central-park',
    label: 'Central Park loop',
    description: 'Dense urban start near Central Park, New York.',
    start: { latitude: 40.7829, longitude: -73.9654 },
    targetDistanceMiles: 12,
    costing: 'road',
    seed: 2,
  },
  {
    id: 'prospect-park',
    label: 'Prospect Park gravel preference',
    description: 'Brooklyn park start with gravel costing preference.',
    start: { latitude: 40.6602, longitude: -73.969 },
    targetDistanceMiles: 15,
    costing: 'gravel',
    seed: 3,
  },
  {
    id: 'boulder-downtown',
    label: 'Boulder foothills loop',
    description: 'Synthetic downtown Boulder start for mixed terrain.',
    start: { latitude: 40.015, longitude: -105.2705 },
    targetDistanceMiles: 20,
    costing: 'gravel',
    seed: 4,
  },
  {
    id: 'austin-zilker',
    label: 'Zilker Park loop',
    description: 'Public park start in Austin, Texas.',
    start: { latitude: 30.2672, longitude: -97.7731 },
    targetDistanceMiles: 18,
    distanceFlexibilityMiles: 4,
    costing: 'road',
    seed: 5,
  },
] as const;

export function fixtureFlexibilityMiles(fixture: PocScenarioFixture): number {
  return fixture.distanceFlexibilityMiles ?? DEFAULT_DISTANCE_FLEXIBILITY_MILES;
}
