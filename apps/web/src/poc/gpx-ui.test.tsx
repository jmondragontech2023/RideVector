import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildGpxDocument } from './gpx';
import { SelectedRoutePanel } from './layout/SelectedRoutePanel';
import type { SavedPocRoute } from './storage';
import { DEFAULT_POC_FEATURES, type PocAlternative, type PocGenerateResponse } from './types';

const root = dirname(fileURLToPath(import.meta.url));
const appSource = readFileSync(join(root, '..', 'App.tsx'), 'utf8');
const selectedPanelSource = readFileSync(join(root, 'layout', 'SelectedRoutePanel.tsx'), 'utf8');
const resultsPanelSource = readFileSync(join(root, 'layout', 'ResultsPanel.tsx'), 'utf8');

function makeAlternative(overrides: Partial<PocAlternative> = {}): PocAlternative {
  return {
    id: 'alt-a',
    name: 'Route A',
    geometry: {
      type: 'LineString',
      coordinates: [
        [-122.4, 37.7],
        [-122.39, 37.71],
        [-122.4, 37.7],
      ],
    },
    distanceMeters: 12_000,
    durationSeconds: 2_400,
    distanceFromTargetMeters: 100,
    bearingFamily: 'N',
    warnings: [],
    distanceClassification: 'within_range',
    requestedRangeMeters: { min: 10_000, max: 14_000 },
    ...overrides,
  };
}

function makeResult(alternative: PocAlternative): PocGenerateResponse {
  return {
    seed: 99,
    durationMs: 10,
    attemptedCount: 6,
    acceptedCount: 1,
    alternatives: [alternative],
    rejections: {
      upstream_failure: 0,
      malformed_geometry: 0,
      outside_tolerance: 0,
      duplicate_candidate: 0,
      selection_limit: 0,
    },
    warnings: [],
    candidateDiagnostics: [],
    diagnosticSummary: {
      attemptedCount: 0,
      acceptedCount: 0,
      rejectionCounts: {
        upstream_failure: 0,
        malformed_geometry: 0,
        outside_tolerance: 0,
        duplicate_candidate: 0,
        selection_limit: 0,
      },
    },
    distanceFlexibilityMeters: 4828.032,
    requestedRangeMeters: alternative.requestedRangeMeters,
  };
}

describe('Download GPX UI wiring', () => {
  it('exposes Download GPX only through selected accepted-route actions', () => {
    expect(selectedPanelSource).toContain('Download GPX');
    expect(selectedPanelSource).toContain('onDownloadGpx');
    expect(selectedPanelSource).toContain('Garmin Connect');
    expect(resultsPanelSource).toContain('onDownloadGpx={onDownloadGpx}');
    expect(appSource).toContain('handleDownloadGpx');
    expect(appSource).toContain('onDownloadGpx={() => void handleDownloadGpx()}');
    expect(appSource).toContain('buildGpxDocument({');
    expect(appSource).toContain('geometry: selected.geometry');
    expect(appSource).toContain('startAreaLabel: areaLabel');
    expect(appSource).toContain('downloadGpxFile(exported.xml, exported.filename)');
    expect(appSource).toContain('StartAreaResolver');
    expect(appSource).toContain('resolveForExport');
    expect(appSource).toContain('START_AREA_FALLBACK_LABEL');
    expect(appSource).toContain('startAreaLabel && startAreaLabel !== START_AREA_FALLBACK_LABEL');
    expect(appSource).toContain('gpxExportSessionRef');
    expect(appSource).toContain('AbortError');
  });

  it('exports the currently selected alternative geometry, including after a saved reopen path', () => {
    const selected = makeAlternative({
      id: 'alt-b',
      name: 'Route B',
      geometry: {
        type: 'LineString',
        coordinates: [
          [-73.97, 40.78],
          [-73.96, 40.79],
          [-73.97, 40.78],
        ],
      },
    });
    const saved: SavedPocRoute = {
      id: 'saved-1',
      savedAt: '2026-08-27T00:00:00.000Z',
      label: 'Route B · 7.5 mi',
      start: { latitude: 40.78, longitude: -73.97 },
      targetDistanceMeters: 12_000,
      distanceFlexibilityMeters: 4_828,
      costing: 'road',
      seed: 55,
      alternative: selected,
    };

    // Same geometry source App uses after handleOpenSaved sets alternatives to [route.alternative].
    const reopenedSelected = saved.alternative;
    const exported = buildGpxDocument({
      geometry: reopenedSelected.geometry,
      routeName: reopenedSelected.name,
      costing: saved.costing,
      seed: saved.seed,
      distanceMeters: reopenedSelected.distanceMeters,
      startAreaLabel: 'Central Park',
    });

    expect(exported.filename).toBe('RideVector-Central-Park-7.5mi-seed-55.gpx');
    expect(exported.pointCount).toBe(3);
    expect(exported.xml).toContain('lat="40.7800000"');
    expect(exported.xml).toContain('lon="-73.9700000"');
  });

  it('renders an accessible Download GPX control beside Save without nesting interactive elements', () => {
    const selected = makeAlternative();
    const html = renderToStaticMarkup(
      <SelectedRoutePanel
        result={makeResult(selected)}
        selected={selected}
        features={DEFAULT_POC_FEATURES}
        wouldRide="maybe"
        feedbackReason=""
        deviationAcceptable={null}
        saveMessage={null}
        savedRoutes={[]}
        onWouldRideChange={() => undefined}
        onFeedbackReasonChange={() => undefined}
        onDeviationAcceptableChange={() => undefined}
        onSaveSelected={() => undefined}
        onDownloadGpx={() => undefined}
        onOpenSaved={() => undefined}
        onDeleteSaved={() => undefined}
      />,
    );

    expect(html).toContain('Download GPX');
    expect(html).toContain('Save selected locally');
    expect(html).toContain('type="button"');
    expect(html).not.toContain('<button><button');
    expect(html).toContain('Garmin Connect');
  });

  it('keeps GPX export out of rejected-preview wiring', () => {
    const downloadHandler = appSource.match(
      /function handleDownloadGpx\(\) \{[\s\S]*?\n {2}\}\n\n {2}function handleSaveSelected/,
    )?.[0];
    expect(downloadHandler).toBeTruthy();
    expect(downloadHandler).toContain('geometry: selected.geometry');
    expect(downloadHandler).not.toContain('previewAttempt');
    expect(downloadHandler).not.toContain('rejected');
    expect(downloadHandler).not.toContain('candidateDiagnostics');
  });

  it('surfaces export failures without clearing the selected route contract', () => {
    const downloadHandler = appSource.match(
      /function handleDownloadGpx\(\) \{[\s\S]*?\n {2}\}\n\n {2}function handleSaveSelected/,
    )?.[0];
    expect(downloadHandler).toBeTruthy();
    expect(downloadHandler).toContain('GpxExportError');
    expect(downloadHandler).toContain('setSaveMessage(message)');
    expect(downloadHandler).not.toContain('clearGenerationResults');
    expect(downloadHandler).not.toContain('setSelectedId(null)');
    expect(downloadHandler).not.toContain('setResult(null)');
  });
});

describe('Download GPX handler contract', () => {
  it('documents that changing selectedId changes the exported geometry source', () => {
    expect(appSource).toContain('alternatives.find((alt) => alt.id === selectedId)');
    expect(appSource).toContain('geometry: selected.geometry');
    expect(appSource).toContain('routeName: selected.name');
    expect(appSource).toContain('seed: result.seed');
  });
});
