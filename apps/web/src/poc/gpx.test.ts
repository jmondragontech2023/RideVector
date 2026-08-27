import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildGpxDescription,
  buildGpxDocument,
  buildGpxFilename,
  buildGpxTrackName,
  escapeXmlText,
  formatGpxCoordinate,
  GPX_COORDINATE_DECIMALS,
  GpxExportError,
  sanitizeGpxFilenameComponent,
} from './gpx';
import type { PocLineString } from './types';

const sampleGeometry: PocLineString = {
  type: 'LineString',
  coordinates: [
    [-122.4862, 37.7694],
    [-122.485, 37.77],
    [-122.484, 37.771],
    [-122.4862, 37.7694],
  ],
};

describe('gpx export', () => {
  it('builds a GPX 1.1 document with the official namespace and RideVector creator', () => {
    const result = buildGpxDocument({
      geometry: sampleGeometry,
      routeName: 'Route A',
      costing: 'road',
      seed: 42,
      distanceMeters: 16_093.44,
    });

    expect(result.xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(result.xml).toContain(
      '<gpx version="1.1" creator="RideVector" xmlns="http://www.topografix.com/GPX/1/1">',
    );
    expect(result.xml).toContain('<trk>');
    expect(result.xml).toContain('<trkseg>');
    expect(result.xml).toContain('</trkseg>');
    expect(result.xml).toContain('</trk>');
    expect(result.xml).toContain('</gpx>');
    expect(result.xml).not.toContain('<time>');
    expect(result.xml).not.toContain('<ele>');
    expect(result.xml).not.toContain('<rte>');
    expect(result.xml).not.toContain('<wpt');
  });

  it('maps GeoJSON [longitude, latitude] to GPX lat/lon without reordering points', () => {
    const result = buildGpxDocument({
      geometry: sampleGeometry,
      routeName: 'Route B',
      costing: 'gravel',
      seed: 7,
      distanceMeters: 20_000,
    });

    const points = [...result.xml.matchAll(/<trkpt lat="([^"]+)" lon="([^"]+)"><\/trkpt>/g)];
    expect(points).toHaveLength(sampleGeometry.coordinates.length);
    expect(result.pointCount).toBe(sampleGeometry.coordinates.length);

    sampleGeometry.coordinates.forEach(([longitude, latitude], index) => {
      expect(points[index]?.[1]).toBe(formatGpxCoordinate(latitude));
      expect(points[index]?.[2]).toBe(formatGpxCoordinate(longitude));
    });
  });

  it('escapes dynamic XML text and keeps metadata coordinate-free', () => {
    const result = buildGpxDocument({
      geometry: sampleGeometry,
      routeName: 'Route <A> & "B"',
      costing: 'road',
      seed: 3,
      distanceMeters: 12_000,
    });

    expect(result.xml).toContain(
      `<name>${escapeXmlText(buildGpxTrackName('Route <A> & "B"'))}</name>`,
    );
    expect(result.xml).toContain('&lt;');
    expect(result.xml).toContain('&amp;');
    expect(result.xml).toContain('&quot;');
    expect(result.description).toContain('Route <A> & "B"');
    expect(result.description).toContain('road');
    expect(result.description).toContain('seed 3');
    expect(result.description).not.toMatch(/-?\d+\.\d+,\s*-?\d+\.\d+/);
    expect(result.xml).not.toContain('Route <A>');
  });

  it('produces deterministic XML and filenames for identical input', () => {
    const input = {
      geometry: sampleGeometry,
      routeName: 'Route A',
      costing: 'road' as const,
      seed: 123,
      distanceMeters: 19_312.128,
    };
    const first = buildGpxDocument(input);
    const second = buildGpxDocument(input);
    expect(first.xml).toBe(second.xml);
    expect(first.filename).toBe(second.filename);
    expect(first.filename).toBe('RideVector-Route-A-seed-123.gpx');
    expect(buildGpxFilename('Route A', 123)).toBe('RideVector-Route-A-seed-123.gpx');
    expect(buildGpxDescription(input)).toBe(first.description);
    expect(formatGpxCoordinate(37.7694)).toHaveLength(2 + 1 + GPX_COORDINATE_DECIMALS);
  });

  it('sanitizes filenames to remove path separators and unsafe characters', () => {
    expect(sanitizeGpxFilenameComponent('../evil/Route A')).toBe('evil-Route-A');
    expect(sanitizeGpxFilenameComponent('Route\\A')).toBe('Route-A');
    expect(sanitizeGpxFilenameComponent('Route/A')).toBe('Route-A');
    expect(buildGpxFilename('Route A!!', 9)).toBe('RideVector-Route-A-seed-9.gpx');
    expect(buildGpxFilename('@@@', 1)).toBe('RideVector-route-seed-1.gpx');
  });

  it('fails clearly for invalid geometry instead of dropping points', () => {
    expect(() =>
      buildGpxDocument({
        geometry: { type: 'LineString', coordinates: [[-122, 37]] },
        routeName: 'Route A',
        costing: 'road',
        seed: 1,
        distanceMeters: 1000,
      }),
    ).toThrow(GpxExportError);

    expect(() =>
      buildGpxDocument({
        geometry: {
          type: 'LineString',
          coordinates: [
            [-122, 37],
            [Number.NaN, 37.1],
          ],
        },
        routeName: 'Route A',
        costing: 'road',
        seed: 1,
        distanceMeters: 1000,
      }),
    ).toThrow(/non-finite/);

    expect(() =>
      buildGpxDocument({
        geometry: {
          type: 'LineString',
          coordinates: [
            [-122, 37],
            [-122, 91],
          ],
        },
        routeName: 'Route A',
        costing: 'road',
        seed: 1,
        distanceMeters: 1000,
      }),
    ).toThrow(/latitude/);

    expect(() =>
      buildGpxDocument({
        geometry: {
          type: 'LineString',
          coordinates: [
            [-122, 37],
            [-181, 37.1],
          ],
        },
        routeName: 'Route A',
        costing: 'road',
        seed: 1,
        distanceMeters: 1000,
      }),
    ).toThrow(/longitude/);

    expect(() =>
      buildGpxDocument({
        geometry: { type: 'LineString', coordinates: null as unknown as Array<[number, number]> },
        routeName: 'Route A',
        costing: 'road',
        seed: 1,
        distanceMeters: 1000,
      }),
    ).toThrow(/LineString/);
  });

  it('does not invent timestamps or elevation in descriptions or XML', () => {
    const result = buildGpxDocument({
      geometry: sampleGeometry,
      routeName: 'Route C',
      costing: 'gravel',
      seed: 5,
      distanceMeters: 8_000,
    });
    expect(result.xml.toLowerCase()).not.toContain('<time');
    expect(result.xml.toLowerCase()).not.toContain('<ele');
    expect(result.description.toLowerCase()).not.toContain('elev');
    expect(result.description.toLowerCase()).not.toContain('timestamp');
  });
});

describe('gpx download boundary', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('downloads with the expected filename and revokes the object URL', async () => {
    const { downloadGpxFile, GPX_MIME_TYPE } = await import('./gpx-download');
    const click = vi.fn();
    const remove = vi.fn();
    const appendChild = vi.fn();
    const createObjectURL = vi.fn(() => 'blob:ridevector-gpx');
    const revokeObjectURL = vi.fn();
    const anchor = {
      href: '',
      download: '',
      rel: '',
      style: { display: '' },
      click,
      remove,
    };

    downloadGpxFile('<?xml version="1.0"?><gpx></gpx>', 'RideVector-Route-A-seed-1.gpx', {
      document: {
        createElement: vi.fn(() => anchor) as unknown as Document['createElement'],
        body: { appendChild } as unknown as HTMLElement,
      },
      URL: { createObjectURL, revokeObjectURL },
      Blob,
    });

    expect(createObjectURL).toHaveBeenCalledOnce();
    const calls = createObjectURL.mock.calls as unknown as Array<[Blob]>;
    expect(calls[0]?.[0]).toBeInstanceOf(Blob);
    expect(calls[0]?.[0].type).toContain(GPX_MIME_TYPE);
    expect(anchor.download).toBe('RideVector-Route-A-seed-1.gpx');
    expect(appendChild).toHaveBeenCalledWith(anchor);
    expect(click).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:ridevector-gpx');
  });
});
