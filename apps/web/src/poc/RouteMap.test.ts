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

const stylesSource = readApp(
  join(dirname(fileURLToPath(import.meta.url)), '..', 'styles.css'),
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

const rectangularLoop: Array<[number, number]> = [
  [0, 0],
  [0, 0.005],
  [0.005, 0.005],
  [0.005, 0],
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
    expect(routeMapSource).toContain('paired outlined arrows mark reversals or crossings');
  });

  it('wires accessible titles, noninteractive markers, and kind-aware badge html', () => {
    expect(routeMapSource).toContain('directionMarkerAccessibleLabel');
    expect(routeMapSource).toContain('title={directionMarkerAccessibleLabel(marker)}');
    expect(routeMapSource).toContain('kind: marker.kind');
    expect(routeMapSource).toContain('progress: marker.progress');
    expect(routeMapSource).toContain('interactive={false}');
    expect(routeMapSource).toContain('keyboard={false}');
    expect(routeMapSource).toContain('sampleDirectionMarkers(');
    expect(routeMapSource).toContain('directionMarkerOptions');
    expect(routeMapSource).toContain('DirectionMarkerControls');
  });

  it('documents progress coloring and turn guidance in the legend copy', () => {
    expect(routeMapSource).toContain('green → yellow → red');
    expect(routeMapSource).toContain('Markers tighten at turns');
  });

  it('styles ambiguity pairs with a double-ring accent without enlarging regular discs', () => {
    expect(stylesSource).toContain('route-direction-badge--ambiguity-before');
    expect(stylesSource).toContain('route-direction-badge--ambiguity-after');
    expect(stylesSource).toContain('route-direction-badge--turn-before');
    expect(stylesSource).toContain('--rv-direction-fill');
    expect(stylesSource).toContain('0 0 0 4px var(--rv-direction-fill, var(--rv-accent-strong))');
    expect(stylesSource).toMatch(/\.route-direction-badge__arrow\s*\{[^}]*font-size:\s*0\.84rem/s);
  });

  it('renders ambiguity marker html with outline modifiers for hairpin geometry', () => {
    const markers = sampleDirectionMarkers(hairpinCoordinates);
    const ambiguityMarkers = markers.filter((marker) => marker.kind !== 'regular');
    expect(ambiguityMarkers.length).toBeGreaterThan(0);

    for (const marker of ambiguityMarkers.filter((item) => item.kind.startsWith('ambiguity'))) {
      const html = directionBadgeHtml(marker.sequence, marker.bearing, {
        kind: marker.kind,
        progress: marker.progress,
      });
      expect(html).toContain(`route-direction-badge--${marker.kind}`);
      expect(html).toContain('route-direction-badge__arrow');
      expect(html).toContain(`route-direction-badge__number">${marker.sequence}</span>`);
      expect(html).toContain('--rv-direction-fill:');
      expect(directionMarkerAccessibleLabel(marker)).toMatch(/route reversal/);
    }
  });

  it('keeps ordinary loop markers free of ambiguity kinds with consecutive numbering', () => {
    const markers = sampleDirectionMarkers(rectangularLoop);
    expect(markers.every((marker) => !marker.kind.startsWith('ambiguity'))).toBe(true);
    expect(markers.map((marker) => marker.sequence)).toEqual(
      Array.from({ length: markers.length }, (_, index) => index + 1),
    );
    expect(markers.some((marker) => marker.kind.startsWith('turn'))).toBe(true);

    for (const marker of markers) {
      const html = directionBadgeHtml(marker.sequence, marker.bearing, {
        kind: marker.kind,
        progress: marker.progress,
      });
      expect(html).not.toContain('ambiguity-before');
      expect(html).not.toContain('ambiguity-after');
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
