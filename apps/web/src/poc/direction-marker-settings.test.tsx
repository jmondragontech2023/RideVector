import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DirectionMarkerControls } from './DirectionMarkerControls';
import {
  defaultDirectionMarkerSettings,
  parseDirectionMarkerSettings,
  toSampleDirectionMarkerOptions,
} from './direction-marker-settings';

describe('direction-marker-settings', () => {
  it('returns defaults for empty or corrupt storage', () => {
    expect(parseDirectionMarkerSettings(null)).toEqual(defaultDirectionMarkerSettings());
    expect(parseDirectionMarkerSettings('{')).toEqual(defaultDirectionMarkerSettings());
    expect(parseDirectionMarkerSettings('{"version":2}')).toEqual(defaultDirectionMarkerSettings());
  });

  it('clamps out-of-range values when parsing', () => {
    const parsed = parseDirectionMarkerSettings(
      JSON.stringify({
        version: 1,
        maxMarkers: 999,
        targetSpacingMeters: 10,
        maxGapMeters: 50,
        minMarkerSeparationMeters: 5,
        turnBearingThreshold: 5,
      }),
    );
    expect(parsed.maxMarkers).toBe(60);
    expect(parsed.targetSpacingMeters).toBe(200);
    expect(parsed.maxGapMeters).toBe(300);
    expect(parsed.minMarkerSeparationMeters).toBe(30);
    expect(parsed.turnBearingThreshold).toBe(35);
  });

  it('maps settings into sampler options', () => {
    const options = toSampleDirectionMarkerOptions({
      ...defaultDirectionMarkerSettings(),
      maxMarkers: 20,
      targetSpacingMeters: 350,
    });
    expect(options.maxMarkers).toBe(20);
    expect(options.minMarkers).toBe(12);
    expect(options.targetSpacingMeters).toBe(350);
  });
});

describe('DirectionMarkerControls', () => {
  it('renders labeled sliders, help tips, and the live marker count', () => {
    const markup = renderToStaticMarkup(
      <DirectionMarkerControls
        settings={defaultDirectionMarkerSettings()}
        markerCount={14}
        onChange={() => undefined}
        onReset={() => undefined}
      />,
    );
    expect(markup).toContain('Direction markers');
    expect(markup).toContain('14 on map');
    expect(markup).toContain('aria-label="Max markers"');
    expect(markup).toContain('aria-label="Target spacing"');
    expect(markup).toContain('aria-label="Max markers information"');
    expect(markup).toContain('aria-label="Turn angle information"');
    expect(markup).toContain('feature-help-tip__trigger');
    expect(markup).toContain('Reset marker defaults');
  });
});
