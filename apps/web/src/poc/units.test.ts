import { describe, expect, it } from 'vitest';
import { formatDuration, formatMiles, metersToMiles, milesToMeters, METERS_PER_MILE } from './units';

describe('poc units', () => {
  it('converts miles and meters with the exact statute mile', () => {
    expect(METERS_PER_MILE).toBe(1609.344);
    expect(milesToMeters(1)).toBe(1609.344);
    expect(metersToMiles(1609.344)).toBe(1);
    expect(formatMiles(8046.72)).toBe('5.0 mi');
  });

  it('formats durations in minutes and hours', () => {
    expect(formatDuration(540)).toBe('9 min');
    expect(formatDuration(3600)).toBe('1 h');
    expect(formatDuration(5400)).toBe('1 h 30 min');
  });
});
