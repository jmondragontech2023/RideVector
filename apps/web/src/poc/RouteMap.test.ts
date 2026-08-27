import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { readFileSync as readApp } from 'node:fs';
import {
  directionBadgeHtml,
  directionMarkerAccessibleLabel,
  sampleDirectionMarkers,
} from './route-direction';

const routeMapSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'RouteMap.tsx'),
  'utf8',
);

const appSource = readApp(join(dirname(fileURLToPath(import.meta.url)), '..', 'App.tsx'), 'utf8');

/** Hairpin geometry long enough for direction markers. */
const hairpinCoordinates: Array<[number, number]> = [
  [0, 0],
  [0, 0.004],
  [0, 0.003],
  [0, 0],
];

describe('RouteMap rejected preview', () => {
  it('renders rejected candidates as a dashed orange polyline beneath accepted routes', () => {
    expect(routeMapSource).toContain('mapTheme');
    expect(routeMapSource).toContain('--rv-route-rejected');
    expect(routeMapSource).toContain('route-rejected-preview');
    expect(routeMapSource).toContain('dashArray');
    expect(routeMapSource).toContain('rejectedPreview');
  });

  it('labels rejected preview clearly in the map legend', () => {
    expect(routeMapSource).toContain('dashed orange');
    expect(routeMapSource).toContain('rejectedPreview.label');
  });
});

describe('RouteMap direction markers', () => {
  it('documents paired ambiguity markers in the legend copy', () => {
    expect(routeMapSource).toContain('follow numbered arrows in order');
    expect(routeMapSource).toContain('Paired outlined arrows show where the route doubles back');
  });

  it('wires accessible titles and ambiguity badge classes into marker rendering', () => {
    expect(routeMapSource).toContain('directionMarkerAccessibleLabel');
    expect(routeMapSource).toContain('title={directionMarkerAccessibleLabel(marker)}');
    expect(routeMapSource).toContain(
      'directionBadgeHtml(marker.sequence, marker.bearing, marker.kind)',
    );
  });

  it('renders ambiguity marker html with outline modifiers for hairpin geometry', () => {
    const markers = sampleDirectionMarkers(hairpinCoordinates);
    const ambiguityMarkers = markers.filter((marker) => marker.kind !== 'regular');
    expect(ambiguityMarkers.length).toBeGreaterThan(0);

    for (const marker of ambiguityMarkers) {
      const html = directionBadgeHtml(marker.sequence, marker.bearing, marker.kind);
      expect(html).toContain(`route-direction-badge--${marker.kind}`);
      expect(directionMarkerAccessibleLabel(marker)).toContain('route reversal');
    }
  });
});

describe('App save guardrails', () => {
  it('only saves selected accepted alternatives, not rejected diagnostics', () => {
    const saveBlock = appSource.slice(
      appSource.indexOf('function handleSaveSelected'),
      appSource.indexOf('function handleOpenSaved'),
    );
    expect(saveBlock).toContain('if (!start || !selected || !result)');
    expect(saveBlock).toContain('alternative: selected');
    expect(saveBlock).not.toContain('candidateDiagnostics');
    expect(saveBlock).not.toContain('previewAttemptNumber');
  });
});
