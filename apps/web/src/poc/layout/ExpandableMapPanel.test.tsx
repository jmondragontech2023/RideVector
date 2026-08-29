import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExpandableMapPanel } from './ExpandableMapPanel';

const layoutDir = dirname(fileURLToPath(import.meta.url));
const panelSource = readFileSync(join(layoutDir, 'ExpandableMapPanel.tsx'), 'utf8');
const appSource = readFileSync(join(layoutDir, '..', '..', 'App.tsx'), 'utf8');
const stylesSource = readFileSync(join(layoutDir, '..', '..', 'styles.css'), 'utf8');
const routeMapSource = readFileSync(join(layoutDir, '..', 'RouteMap.tsx'), 'utf8');

type MatchMediaListener = (event: MediaQueryListEvent) => void;

function installMatchMedia(matches: boolean) {
  const listeners = new Set<MatchMediaListener>();
  const media = {
    matches,
    media: '(max-width: 859px)',
    onchange: null as ((event: MediaQueryListEvent) => void) | null,
    addEventListener: (_type: string, listener: MatchMediaListener) => {
      listeners.add(listener);
    },
    removeEventListener: (_type: string, listener: MatchMediaListener) => {
      listeners.delete(listener);
    },
    addListener: (listener: MatchMediaListener) => {
      listeners.add(listener);
    },
    removeListener: (listener: MatchMediaListener) => {
      listeners.delete(listener);
    },
    dispatchEvent: () => false,
    setMatches(next: boolean) {
      media.matches = next;
      const event = { matches: next } as MediaQueryListEvent;
      listeners.forEach((listener) => listener(event));
    },
  };
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: () => media,
  });
  return media;
}

function renderPanel(ui: ReactElement) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root: Root | null = createRoot(container);
  act(() => {
    root?.render(ui);
  });
  return {
    container,
    rerender(next: ReactElement) {
      act(() => {
        root?.render(next);
      });
    },
    unmount() {
      act(() => {
        root?.unmount();
        root = null;
      });
      container.remove();
    },
  };
}

describe('ExpandableMapPanel', () => {
  let media: ReturnType<typeof installMatchMedia>;

  beforeEach(() => {
    media = installMatchMedia(true);
    document.body.innerHTML = '';
    document.body.style.cssText = '';
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
  });

  afterEach(() => {
    document.body.innerHTML = '';
    document.body.style.cssText = '';
  });

  it('renders Expand map with aria-expanded and aria-controls', () => {
    const view = renderPanel(
      <ExpandableMapPanel mapTheme="light" onMapThemeToggle={() => undefined}>
        <div data-testid="map-child">map</div>
      </ExpandableMapPanel>,
    );

    const open = view.container.querySelector('[data-testid="map-expand-open"]');
    expect(open).not.toBeNull();
    expect(open?.getAttribute('aria-expanded')).toBe('false');
    expect(open?.getAttribute('aria-controls')).toBeTruthy();
    expect(open?.textContent).toContain('Expand map');
    view.unmount();
  });

  it('opens as an expanded dialog with close control and Escape support', () => {
    const onExpandedChange = vi.fn();
    const view = renderPanel(
      <ExpandableMapPanel
        mapTheme="dark"
        onMapThemeToggle={() => undefined}
        selectedSummary="Route B · 20.0 mi · 1 h"
        onExpandedChange={onExpandedChange}
      >
        <div data-testid="map-child">map</div>
      </ExpandableMapPanel>,
    );

    const open = view.container.querySelector(
      '[data-testid="map-expand-open"]',
    ) as HTMLButtonElement;
    act(() => {
      open.click();
    });

    const panel = view.container.querySelector('[data-testid="map-panel"]');
    expect(panel?.getAttribute('role')).toBe('dialog');
    expect(panel?.getAttribute('aria-modal')).toBe('true');
    expect(panel?.getAttribute('aria-label')).toBe('Expanded route map');
    expect(panel?.className).toContain('map-panel--expanded');
    expect(onExpandedChange).toHaveBeenCalledWith(true);

    const close = view.container.querySelector(
      '[data-testid="map-expand-close"]',
    ) as HTMLButtonElement;
    expect(close).not.toBeNull();
    expect(close.getAttribute('aria-expanded')).toBe('true');
    expect(
      view.container.querySelector('[data-testid="map-expand-summary"]')?.textContent,
    ).toContain('Route B');
    expect(view.container.querySelector('[data-testid="map-expand-open"]')).toBeNull();

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(view.container.querySelector('[data-testid="map-panel"]')?.className).not.toContain(
      'map-panel--expanded',
    );
    expect(onExpandedChange).toHaveBeenCalledWith(false);
    view.unmount();
  });

  it('moves focus to Close on open and returns to Expand on close', async () => {
    const view = renderPanel(
      <ExpandableMapPanel mapTheme="light" onMapThemeToggle={() => undefined}>
        <div>map</div>
      </ExpandableMapPanel>,
    );

    const open = view.container.querySelector(
      '[data-testid="map-expand-open"]',
    ) as HTMLButtonElement;
    act(() => {
      open.focus();
      open.click();
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(document.activeElement?.getAttribute('data-testid')).toBe('map-expand-close');

    act(() => {
      (document.activeElement as HTMLButtonElement).click();
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(document.activeElement?.getAttribute('data-testid')).toBe('map-expand-open');
    view.unmount();
  });

  it('collapses when collapseToken changes or viewport leaves mobile', () => {
    const onExpandedChange = vi.fn();
    const view = renderPanel(
      <ExpandableMapPanel
        mapTheme="light"
        onMapThemeToggle={() => undefined}
        collapseToken={0}
        onExpandedChange={onExpandedChange}
      >
        <div>map</div>
      </ExpandableMapPanel>,
    );

    act(() => {
      (
        view.container.querySelector('[data-testid="map-expand-open"]') as HTMLButtonElement
      ).click();
    });
    expect(view.container.querySelector('.map-panel--expanded')).not.toBeNull();

    view.rerender(
      <ExpandableMapPanel
        mapTheme="light"
        onMapThemeToggle={() => undefined}
        collapseToken={1}
        onExpandedChange={onExpandedChange}
      >
        <div>map</div>
      </ExpandableMapPanel>,
    );

    expect(view.container.querySelector('.map-panel--expanded')).toBeNull();

    act(() => {
      (
        view.container.querySelector('[data-testid="map-expand-open"]') as HTMLButtonElement
      ).click();
    });
    act(() => {
      media.setMatches(false);
    });
    expect(view.container.querySelector('.map-panel--expanded')).toBeNull();
    view.unmount();
  });

  it('locks and restores body scroll position while expanded', () => {
    window.scrollTo(0, 120);
    const view = renderPanel(
      <ExpandableMapPanel mapTheme="light" onMapThemeToggle={() => undefined}>
        <div>map</div>
      </ExpandableMapPanel>,
    );

    act(() => {
      (
        view.container.querySelector('[data-testid="map-expand-open"]') as HTMLButtonElement
      ).click();
    });
    expect(document.body.style.overflow).toBe('hidden');
    expect(document.body.style.position).toBe('fixed');

    act(() => {
      (
        view.container.querySelector('[data-testid="map-expand-close"]') as HTMLButtonElement
      ).click();
    });
    expect(document.body.style.overflow).toBe('');
    expect(document.body.style.position).toBe('');
    view.unmount();
  });

  it('keeps a single RouteMap child mounted across expand and collapse', () => {
    const view = renderPanel(
      <ExpandableMapPanel mapTheme="light" onMapThemeToggle={() => undefined}>
        <div data-testid="stable-map">stable</div>
      </ExpandableMapPanel>,
    );

    const before = view.container.querySelector('[data-testid="stable-map"]');
    act(() => {
      (
        view.container.querySelector('[data-testid="map-expand-open"]') as HTMLButtonElement
      ).click();
    });
    const during = view.container.querySelector('[data-testid="stable-map"]');
    act(() => {
      (
        view.container.querySelector('[data-testid="map-expand-close"]') as HTMLButtonElement
      ).click();
    });
    const after = view.container.querySelector('[data-testid="stable-map"]');

    expect(before).toBe(during);
    expect(during).toBe(after);
    expect(view.container.querySelectorAll('[data-testid="stable-map"]')).toHaveLength(1);
    view.unmount();
  });
});

describe('mobile expandable map wiring', () => {
  it('wires ExpandableMapPanel once with expansion in layoutKey', () => {
    expect(appSource).toContain('ExpandableMapPanel');
    expect(appSource).toContain("mapExpanded ? 'expanded' : 'inline'");
    expect(appSource).toMatch(/ExpandableMapPanel[\s\S]*<RouteMap/);
    expect(appSource.match(/<RouteMap/g)?.length).toBe(1);
    expect(appSource).not.toContain('localStorage');
  });

  it('passes the same map props through the shared RouteMap instance', () => {
    const mapBlock = appSource.slice(
      appSource.indexOf('<ExpandableMapPanel'),
      appSource.indexOf('</ExpandableMapPanel>'),
    );
    expect(mapBlock).toContain('start={start}');
    expect(mapBlock).toContain('alternatives={alternatives}');
    expect(mapBlock).toContain('selectedId={selected?.id ?? null}');
    expect(mapBlock).toContain('rejectedPreview={rejectedPreview}');
    expect(mapBlock).toContain('mapTheme={mapTheme}');
    expect(mapBlock).toContain('layoutKey=');
  });

  it('closes expansion from edit plan and when clearing generated results', () => {
    expect(appSource).toContain('forceCollapseExpandedMap');
    const editPlan = appSource.slice(
      appSource.indexOf('function handleEditPlan'),
      appSource.indexOf('function applyExperimentalSettings'),
    );
    expect(editPlan).toContain('forceCollapseExpandedMap()');
    const clearBlock = appSource.slice(
      appSource.indexOf('function clearGenerationResults'),
      appSource.indexOf('function handleEditPlan'),
    );
    expect(clearBlock).toContain('if (result !== null)');
    expect(clearBlock).toContain('forceCollapseExpandedMap()');
  });

  it('styles expanded overlay with safe areas and hides desktop expand control', () => {
    expect(stylesSource).toContain('.map-panel--expanded');
    expect(stylesSource).toContain('100dvh');
    expect(stylesSource).toContain('env(safe-area-inset-top)');
    expect(stylesSource).toContain('env(safe-area-inset-right)');
    expect(stylesSource).toContain('env(safe-area-inset-bottom)');
    expect(stylesSource).toContain('env(safe-area-inset-left)');
    expect(stylesSource).toContain('z-index: 80');
    expect(stylesSource).toMatch(
      /@media \(min-width: 860px\)\s*\{\s*\.map-expand-toggle--open\s*\{[^}]*display:\s*none/s,
    );
  });

  it('keeps InvalidateMapSize driven by layoutKey including expansion', () => {
    expect(routeMapSource).toContain('InvalidateMapSize');
    expect(routeMapSource).toContain('layoutKey');
    expect(panelSource).toContain('aria-expanded');
    expect(panelSource).toContain('aria-controls');
    expect(panelSource).toContain("role={expanded ? 'dialog'");
  });

  it('obscures background rails while the map is expanded', () => {
    expect(appSource).toContain('contentObscured={mapExpanded}');
    expect(appSource.match(/contentObscured=\{mapExpanded\}/g)?.length).toBeGreaterThanOrEqual(3);
  });
});
