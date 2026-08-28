import { formatMiles, metersToMiles } from './units';
import type { PocCostingMode, PocLineString } from './types';
import { START_AREA_FALLBACK_LABEL } from './start-area';

/** Decimal places for lat/lon attributes — ~1 cm fidelity, deterministic. */
export const GPX_COORDINATE_DECIMALS = 7;

export type GpxExportInput = {
  geometry: PocLineString;
  /** Factual alternative name such as `Route A`. */
  routeName: string;
  costing: PocCostingMode;
  seed: number;
  distanceMeters: number;
  /**
   * Coarse start-area place label for filenames (city/neighborhood).
   * Must not contain coordinates.
   */
  startAreaLabel?: string;
};

export type GpxExportResult = {
  xml: string;
  filename: string;
  trackName: string;
  description: string;
  pointCount: number;
};

export class GpxExportError extends Error {
  readonly code: 'invalid_geometry' | 'insufficient_points' | 'invalid_coordinate';

  constructor(code: GpxExportError['code'], message: string) {
    super(message);
    this.name = 'GpxExportError';
    this.code = code;
  }
}

export function escapeXmlText(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

export function formatGpxCoordinate(value: number): string {
  return value.toFixed(GPX_COORDINATE_DECIMALS);
}

/**
 * Filesystem-safe fragment for GPX filenames.
 * Collapses unsafe characters; never introduces path separators.
 */
export function sanitizeGpxFilenameComponent(value: string): string {
  const sanitized = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '');
  return sanitized.length > 0 ? sanitized.slice(0, 80) : 'route';
}

export function formatGpxDistanceFilename(distanceMeters: number): string {
  const miles = metersToMiles(distanceMeters);
  const rounded = Number.isFinite(miles) ? miles.toFixed(1) : '0.0';
  return `${rounded}mi`;
}

export function buildGpxFilename(input: {
  startAreaLabel?: string;
  distanceMeters: number;
  seed: number;
}): string {
  const area = sanitizeGpxFilenameComponent(
    input.startAreaLabel?.trim() || START_AREA_FALLBACK_LABEL,
  );
  const distance = sanitizeGpxFilenameComponent(formatGpxDistanceFilename(input.distanceMeters));
  const seedPart = sanitizeGpxFilenameComponent(String(input.seed));
  return `RideVector-${area}-${distance}-seed-${seedPart}.gpx`;
}

export function buildGpxTrackName(input: {
  startAreaLabel?: string;
  routeName: string;
  distanceMeters: number;
}): string {
  const area = input.startAreaLabel?.trim() || START_AREA_FALLBACK_LABEL;
  const route = input.routeName.trim() || 'Route';
  return `RideVector ${area} ${route} (${formatMiles(input.distanceMeters)})`;
}

export function buildGpxDescription(input: {
  routeName: string;
  startAreaLabel?: string;
  distanceMeters: number;
  costing: PocCostingMode;
  seed: number;
}): string {
  return [
    input.routeName.trim() || 'Route',
    input.startAreaLabel?.trim() || START_AREA_FALLBACK_LABEL,
    formatMiles(input.distanceMeters),
    input.costing,
    `seed ${input.seed}`,
  ].join(' · ');
}

function assertValidCoordinate(longitude: number, latitude: number, index: number): void {
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    throw new GpxExportError(
      'invalid_coordinate',
      `Route point ${index + 1} has a non-finite coordinate. Download GPX cannot continue.`,
    );
  }
  if (latitude < -90 || latitude > 90) {
    throw new GpxExportError(
      'invalid_coordinate',
      `Route point ${index + 1} has latitude ${latitude} outside [-90, 90]. Download GPX cannot continue.`,
    );
  }
  if (longitude < -180 || longitude > 180) {
    throw new GpxExportError(
      'invalid_coordinate',
      `Route point ${index + 1} has longitude ${longitude} outside [-180, 180]. Download GPX cannot continue.`,
    );
  }
}

/**
 * Builds a standards-oriented GPX 1.1 track document from provider-neutral GeoJSON.
 * GeoJSON coordinates are `[longitude, latitude]`; GPX attributes are `lat` / `lon`.
 */
export function buildGpxDocument(input: GpxExportInput): GpxExportResult {
  if (input.geometry?.type !== 'LineString' || !Array.isArray(input.geometry.coordinates)) {
    throw new GpxExportError(
      'invalid_geometry',
      'Selected route geometry is missing or not a LineString. Download GPX cannot continue.',
    );
  }

  const coordinates = input.geometry.coordinates;
  if (coordinates.length < 2) {
    throw new GpxExportError(
      'insufficient_points',
      'Selected route needs at least two points to export as GPX.',
    );
  }

  const trackPoints: string[] = [];
  for (let index = 0; index < coordinates.length; index += 1) {
    const pair = coordinates[index];
    if (!Array.isArray(pair) || pair.length < 2) {
      throw new GpxExportError(
        'invalid_coordinate',
        `Route point ${index + 1} is malformed. Download GPX cannot continue.`,
      );
    }
    const longitude = pair[0];
    const latitude = pair[1];
    assertValidCoordinate(longitude, latitude, index);
    trackPoints.push(
      `      <trkpt lat="${formatGpxCoordinate(latitude)}" lon="${formatGpxCoordinate(longitude)}"></trkpt>`,
    );
  }

  const startAreaLabel = input.startAreaLabel?.trim() || START_AREA_FALLBACK_LABEL;
  const trackName = buildGpxTrackName({
    startAreaLabel,
    routeName: input.routeName,
    distanceMeters: input.distanceMeters,
  });
  const description = buildGpxDescription({
    routeName: input.routeName,
    startAreaLabel,
    distanceMeters: input.distanceMeters,
    costing: input.costing,
    seed: input.seed,
  });
  const filename = buildGpxFilename({
    startAreaLabel,
    distanceMeters: input.distanceMeters,
    seed: input.seed,
  });

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="RideVector" xmlns="http://www.topografix.com/GPX/1/1">',
    '  <trk>',
    `    <name>${escapeXmlText(trackName)}</name>`,
    `    <desc>${escapeXmlText(description)}</desc>`,
    '    <trkseg>',
    ...trackPoints,
    '    </trkseg>',
    '  </trk>',
    '</gpx>',
    '',
  ].join('\n');

  return {
    xml,
    filename,
    trackName,
    description,
    pointCount: coordinates.length,
  };
}
