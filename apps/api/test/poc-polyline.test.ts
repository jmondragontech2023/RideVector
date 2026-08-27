import { describe, expect, it } from 'vitest';
import { decodePolyline } from '../src/poc/routing/polyline';

function encodePolyline6(coordinates: Array<[number, number]>): string {
  let lastLat = 0;
  let lastLon = 0;
  let result = '';
  const factor = 1e6;

  const encodeSigned = (value: number): void => {
    let v = value < 0 ? ~(value << 1) : value << 1;
    while (v >= 0x20) {
      result += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
      v >>= 5;
    }
    result += String.fromCharCode(v + 63);
  };

  for (const [lon, lat] of coordinates) {
    const ilat = Math.round(lat * factor);
    const ilon = Math.round(lon * factor);
    encodeSigned(ilat - lastLat);
    encodeSigned(ilon - lastLon);
    lastLat = ilat;
    lastLon = ilon;
  }
  return result;
}

describe('decodePolyline', () => {
  it('round-trips longitude/latitude pairs at precision 6', () => {
    const original: Array<[number, number]> = [
      [-122.4194, 37.7749],
      [-122.41, 37.78],
      [-122.4, 37.77],
    ];
    const decoded = decodePolyline(encodePolyline6(original), 6);
    expect(decoded).toHaveLength(3);
    for (let i = 0; i < original.length; i += 1) {
      expect(decoded[i]![0]).toBeCloseTo(original[i]![0], 5);
      expect(decoded[i]![1]).toBeCloseTo(original[i]![1], 5);
    }
  });
});
