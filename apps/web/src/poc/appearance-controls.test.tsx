import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppearanceControls } from './layout/AppearanceControls';
import { MapThemeToggle } from './layout/MapThemeToggle';

describe('appearance controls', () => {
  it('renders theme preference select with accessible label', () => {
    const markup = renderToStaticMarkup(
      <AppearanceControls themePreference="system" onThemePreferenceChange={() => undefined} />,
    );
    expect(markup).toContain('aria-label="Theme preference"');
    expect(markup).toContain('System');
    expect(markup).toContain('Light');
    expect(markup).toContain('Dark');
  });

  it('renders map toggle with pressed state and action label', () => {
    const dark = renderToStaticMarkup(
      <MapThemeToggle mapTheme="dark" onToggle={() => undefined} />,
    );
    expect(dark).toContain('aria-pressed="true"');
    expect(dark).toContain('Light map');

    const light = renderToStaticMarkup(
      <MapThemeToggle mapTheme="light" onToggle={() => undefined} />,
    );
    expect(light).toContain('aria-pressed="false"');
    expect(light).toContain('Dark map');
  });
});
