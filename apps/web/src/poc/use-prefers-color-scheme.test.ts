import { describe, expect, it } from 'vitest';
import { getPrefersColorScheme } from './use-prefers-color-scheme';

describe('usePrefersColorScheme', () => {
  it('returns light when matchMedia is unavailable', () => {
    expect(getPrefersColorScheme()).toBe('light');
  });
});
