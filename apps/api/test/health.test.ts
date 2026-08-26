import { describe, expect, it } from 'vitest';
import { healthResponse } from '../src/health';

describe('health smoke', () => {
  it('returns the OpenAPI smoke health payload', () => {
    expect(healthResponse()).toEqual({
      status: 'ok',
      service: 'ridevector-api',
    });
  });
});
