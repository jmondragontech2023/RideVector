import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { readFileSync as readApp } from 'node:fs';

const routeMapSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'RouteMap.tsx'),
  'utf8',
);

const appSource = readApp(join(dirname(fileURLToPath(import.meta.url)), '..', 'App.tsx'), 'utf8');

describe('RouteMap rejected preview', () => {
  it('renders rejected candidates as a dashed orange polyline beneath accepted routes', () => {
    expect(routeMapSource).toContain('REJECTED_PREVIEW_COLOR');
    expect(routeMapSource).toContain('route-rejected-preview');
    expect(routeMapSource).toContain('dashArray');
    expect(routeMapSource).toContain('rejectedPreview');
  });

  it('labels rejected preview clearly in the map legend', () => {
    expect(routeMapSource).toContain('dashed orange');
    expect(routeMapSource).toContain('rejectedPreview.label');
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
