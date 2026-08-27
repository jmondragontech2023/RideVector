import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  START_MARKER_ICON_ANCHOR,
  START_MARKER_ICON_SIZE,
  createStartMarkerIcon,
  startMarkerHtml,
} from './start-marker';

const routeMapSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'RouteMap.tsx'),
  'utf8',
);

describe('start marker', () => {
  it('renders a custom div icon with a white S and compact START label', () => {
    const html = startMarkerHtml();
    expect(html).toContain('route-start-marker__pin');
    expect(html).toContain('route-start-marker__letter">S</span>');
    expect(html).toContain('route-start-marker__label">START</span>');
    expect(html).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
  });

  it('creates a Leaflet DivIcon anchored at the pin tip', () => {
    const icon = createStartMarkerIcon();
    expect(icon.options.className).toBe('route-start-marker-wrap');
    expect(icon.options.iconSize).toEqual(START_MARKER_ICON_SIZE);
    expect(icon.options.iconAnchor).toEqual(START_MARKER_ICON_ANCHOR);
    expect(String(icon.options.html)).toContain('START');
  });

  it('does not depend on default Leaflet marker assets in RouteMap', () => {
    expect(routeMapSource).not.toContain('marker-icon');
    expect(routeMapSource).not.toContain('marker-shadow');
    expect(routeMapSource).not.toContain('Icon.Default');
  });
});
