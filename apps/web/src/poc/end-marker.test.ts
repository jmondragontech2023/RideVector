import { describe, expect, it } from 'vitest';
import {
  END_MARKER_ICON_ANCHOR,
  END_MARKER_ICON_SIZE,
  createEndMarkerIcon,
  endMarkerHtml,
} from './end-marker';

describe('end marker', () => {
  it('renders a custom div icon with a letter E and compact END label', () => {
    const html = endMarkerHtml();
    expect(html).toContain('route-end-marker__pin');
    expect(html).toContain('route-end-marker__letter">E</span>');
    expect(html).toContain('route-end-marker__label">END</span>');
    expect(html).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
  });

  it('creates a Leaflet DivIcon anchored at the pin tip', () => {
    const icon = createEndMarkerIcon();
    expect(icon.options.className).toBe('route-end-marker-wrap');
    expect(icon.options.iconSize).toEqual(END_MARKER_ICON_SIZE);
    expect(icon.options.iconAnchor).toEqual(END_MARKER_ICON_ANCHOR);
    expect(String(icon.options.html)).toContain('END');
  });
});
