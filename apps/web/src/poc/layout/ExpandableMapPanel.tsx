import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { MapThemeToggle } from './MapThemeToggle';
import type { ColorScheme } from '../use-prefers-color-scheme';

const MOBILE_MAX_WIDTH_QUERY = '(max-width: 859px)';

export type ExpandableMapPanelProps = {
  mapTheme: ColorScheme;
  onMapThemeToggle: () => void;
  selectedSummary?: string | null;
  /** Increment to force-collapse (edit plan, clear generation, etc.). */
  collapseToken?: number;
  onExpandedChange?: (expanded: boolean) => void;
  children: ReactNode;
};

function getFocusable(container: HTMLElement): HTMLElement[] {
  const nodes = container.querySelectorAll<HTMLElement>(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  );
  return Array.from(nodes).filter((el) => {
    if (el.closest('[aria-hidden="true"]')) return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
  });
}

export function ExpandableMapPanel({
  mapTheme,
  onMapThemeToggle,
  selectedSummary = null,
  collapseToken = 0,
  onExpandedChange,
  children,
}: ExpandableMapPanelProps) {
  const panelId = useId();
  const [expanded, setExpanded] = useState(false);
  const panelRef = useRef<HTMLElement | null>(null);
  const expandButtonRef = useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const scrollLockRef = useRef<{ x: number; y: number } | null>(null);
  const previousCollapseToken = useRef(collapseToken);
  const restoreFocusRef = useRef(false);

  const setExpandedSafe = useCallback(
    (next: boolean, options?: { restoreFocus?: boolean }) => {
      setExpanded((prev) => {
        if (prev === next) return prev;
        restoreFocusRef.current = Boolean(options?.restoreFocus);
        onExpandedChange?.(next);
        return next;
      });
    },
    [onExpandedChange],
  );

  useEffect(() => {
    if (collapseToken !== previousCollapseToken.current) {
      previousCollapseToken.current = collapseToken;
      if (expanded) {
        setExpandedSafe(false);
      }
    }
  }, [collapseToken, expanded, setExpandedSafe]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const media = window.matchMedia(MOBILE_MAX_WIDTH_QUERY);
    const onChange = () => {
      if (!media.matches && expanded) {
        setExpandedSafe(false);
      }
    };
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [expanded, setExpandedSafe]);

  useEffect(() => {
    if (!expanded) {
      if (scrollLockRef.current) {
        const { x, y } = scrollLockRef.current;
        scrollLockRef.current = null;
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.width = '';
        window.scrollTo(x, y);
      }
      if (restoreFocusRef.current) {
        restoreFocusRef.current = false;
        queueMicrotask(() => expandButtonRef.current?.focus());
      }
      return;
    }

    scrollLockRef.current = { x: window.scrollX, y: window.scrollY };
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollLockRef.current.y}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';

    queueMicrotask(() => closeButtonRef.current?.focus());

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setExpandedSafe(false, { restoreFocus: true });
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = getFocusable(panelRef.current);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey) {
        if (active === first || !panelRef.current.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else if (active === last || !panelRef.current.contains(active)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (scrollLockRef.current) {
        const { x, y } = scrollLockRef.current;
        scrollLockRef.current = null;
        document.body.style.overflow = '';
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.width = '';
        window.scrollTo(x, y);
      }
    };
  }, [expanded, setExpandedSafe]);

  return (
    <section
      ref={panelRef}
      id={panelId}
      className={`map-panel${expanded ? ' map-panel--expanded' : ''}`}
      aria-label={expanded ? 'Expanded route map' : 'Route map'}
      role={expanded ? 'dialog' : undefined}
      aria-modal={expanded ? true : undefined}
      data-testid="map-panel"
      data-map-expanded={expanded ? 'true' : 'false'}
    >
      <div className="map-toolbar">
        <div className="map-toolbar-start">
          {!expanded ? (
            <button
              ref={expandButtonRef}
              type="button"
              className="secondary map-expand-toggle map-expand-toggle--open"
              aria-expanded={false}
              aria-controls={panelId}
              data-testid="map-expand-open"
              onClick={() => setExpandedSafe(true)}
            >
              Expand map
            </button>
          ) : (
            <button
              ref={closeButtonRef}
              type="button"
              className="secondary map-expand-toggle map-expand-toggle--close"
              aria-expanded={true}
              aria-controls={panelId}
              data-testid="map-expand-close"
              onClick={() => setExpandedSafe(false, { restoreFocus: true })}
            >
              Close expanded map
            </button>
          )}
          {expanded && selectedSummary ? (
            <p className="map-expand-summary" data-testid="map-expand-summary">
              {selectedSummary}
            </p>
          ) : null}
        </div>
        <MapThemeToggle mapTheme={mapTheme} onToggle={onMapThemeToggle} />
      </div>
      <div className="map-panel-body">{children}</div>
    </section>
  );
}
