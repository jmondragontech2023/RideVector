import { describe, expect, it } from 'vitest';
import { smokeContractTitle } from './smokeContract';

describe('web smoke', () => {
  it('wires the OpenAPI smoke contract title', () => {
    expect(smokeContractTitle).toBe('RideVector API (Milestone 0 smoke)');
  });
});
