import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildGpxDescription,
  buildGpxDocument,
  buildGpxFilename,
  buildGpxTrackName,
  escapeXmlText,
  formatGpxCoordinate,
  formatGpxDistanceFilename,
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
      startAreaLabel: 'San Francisco',
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

  it('exports an open start-to-end track without closing it', () => {
    const openGeometry: PocLineString = {
      type: 'LineString',
      coordinates: [
        [-122.4862, 37.7694],
        [-122.48, 37.78],
        [-122.4662, 37.8039],
      ],
    };
    const result = buildGpxDocument({
      geometry: openGeometry,
      routeName: 'Route A',
      costing: 'road',
      seed: 6,
      distanceMeters: 12_000,
      startAreaLabel: 'San Francisco',
    });
    const points = [...result.xml.matchAll(/<trkpt lat="([^"]+)" lon="([^"]+)"><\/trkpt>/g)];
    expect(points).toHaveLength(3);
    expect(points[0]?.[1]).toBe(formatGpxCoordinate(37.7694));
    expect(points[0]?.[2]).toBe(formatGpxCoordinate(-122.4862));
    expect(points[2]?.[1]).toBe(formatGpxCoordinate(37.8039));
    expect(points[2]?.[2]).toBe(formatGpxCoordinate(-122.4662));
    expect(points[0]?.[1]).not.toBe(points[2]?.[1]);
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
      startAreaLabel: 'Austin',
    });

    expect(result.xml).toContain(
      `<name>${escapeXmlText(
        buildGpxTrackName({
          startAreaLabel: 'Austin',
          routeName: 'Route <A> & "B"',
          distanceMeters: 12_000,
        }),
      )}</name>`,
    );
    expect(result.xml).toContain('&lt;');
    expect(result.xml).toContain('&amp;');
    expect(result.xml).toContain('&quot;');
    expect(result.description).toContain('Route <A> & "B"');
    expect(result.description).toContain('Austin');
    expect(result.description).toContain('road');
    expect(result.description).toContain('seed 3');
    expect(result.description).not.toMatch(/-?\d+\.\d+,\s*-?\d+\.\d+/);
    expect(result.xml).not.toContain('Route <A>');
  });

  it('names files as start-area + distance + seed for uniqueness', () => {
    const input = {
      geometry: sampleGeometry,
      routeName: 'Route A',
      costing: 'road' as const,
      seed: 123,
      distanceMeters: 19_312.128,
      startAreaLabel: 'Encinitas',
    };
    const first = buildGpxDocument(input);
    const second = buildGpxDocument(input);
    expect(first.xml).toBe(second.xml);
    expect(first.filename).toBe(second.filename);
    expect(first.filename).toBe('RideVector-Encinitas-12.0mi-seed-123.gpx');
    expect(
      buildGpxFilename({
        startAreaLabel: 'Encinitas',
        distanceMeters: 19_312.128,
        seed: 123,
      }),
    ).toBe('RideVector-Encinitas-12.0mi-seed-123.gpx');
    expect(formatGpxDistanceFilename(19_312.128)).toBe('12.0mi');
    expect(buildGpxDescription(input)).toBe(first.description);
    expect(formatGpxCoordinate(37.7694)).toHaveLength(2 + 1 + GPX_COORDINATE_DECIMALS);
  });

  it('falls back to Local when start area is missing and still includes distance + seed', () => {
    expect(
      buildGpxFilename({
        distanceMeters: 16_093.44,
        seed: 0,
      }),
    ).toBe('RideVector-Local-10.0mi-seed-0.gpx');
  });

  it('sanitizes filenames to remove path separators and unsafe characters', () => {
    expect(sanitizeGpxFilenameComponent('../evil/Route A')).toBe('evil-Route-A');
    expect(sanitizeGpxFilenameComponent('Route\\A')).toBe('Route-A');
    expect(sanitizeGpxFilenameComponent('Route/A')).toBe('Route-A');
    expect(
      buildGpxFilename({
        startAreaLabel: 'San Francisco!!',
        distanceMeters: 8_046.72,
        seed: 9,
      }),
    ).toBe('RideVector-San-Francisco-5.0mi-seed-9.gpx');
    expect(
      buildGpxFilename({
        startAreaLabel: '@@@',
        distanceMeters: 1_609.344,
        seed: 1,
      }),
    ).toBe('RideVector-route-1.0mi-seed-1.gpx');
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

  it('downloads with the expected filename and revokes the object URL after a delay', async () => {
    const { downloadGpxFile, GPX_MIME_TYPE, GPX_OBJECT_URL_REVOKE_DELAY_MS } = await import(
      './gpx-download'
    );
    const click = vi.fn();
    const remove = vi.fn();
    const appendChild = vi.fn();
    const createObjectURL = vi.fn(() => 'blob:ridevector-gpx');
    const revokeObjectURL = vi.fn();
    const setTimeoutFn = vi.fn((handler: TimerHandler) => {
      if (typeof handler === 'function') {
        handler();
      }
      return 0 as unknown as ReturnType<typeof setTimeout>;
    }) as unknown as typeof setTimeout;
    const anchor = {
      href: '',
      download: '',
      rel: '',
      style: { display: '' },
      click,
      remove,
    };

    downloadGpxFile('<?xml version="1.0"?><gpx></gpx>', 'RideVector-Encinitas-12.0mi-seed-1.gpx', {
      document: {
        createElement: vi.fn(() => anchor) as unknown as Document['createElement'],
        body: { appendChild } as unknown as HTMLElement,
      },
      URL: { createObjectURL, revokeObjectURL },
      Blob,
      setTimeoutFn,
    });

    expect(createObjectURL).toHaveBeenCalledOnce();
    const calls = createObjectURL.mock.calls as unknown as Array<[Blob]>;
    expect(calls[0]?.[0]).toBeInstanceOf(Blob);
    expect(calls[0]?.[0].type).toContain(GPX_MIME_TYPE);
    expect(anchor.download).toBe('RideVector-Encinitas-12.0mi-seed-1.gpx');
    expect(appendChild).toHaveBeenCalledWith(anchor);
    expect(click).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledOnce();
    expect(setTimeoutFn).toHaveBeenCalledWith(expect.any(Function), GPX_OBJECT_URL_REVOKE_DELAY_MS);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:ridevector-gpx');
  });
});
