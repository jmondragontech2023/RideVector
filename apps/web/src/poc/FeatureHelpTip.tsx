import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const TOOLTIP_WIDTH_PX = 256;
const VIEWPORT_MARGIN_PX = 8;

type Props = {
  id: string;
  text: string;
  label?: string;
};

type TooltipCoords = {
  top: number;
  left: number;
};

function clampHorizontal(left: number): number {
  const maxLeft = window.innerWidth - TOOLTIP_WIDTH_PX - VIEWPORT_MARGIN_PX;
  return Math.max(VIEWPORT_MARGIN_PX, Math.min(left, maxLeft));
}

export function FeatureHelpTip({ id, text, label = 'Feature information' }: Props) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<TooltipCoords>({ top: 0, left: 0 });

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) {
      return;
    }
    const rect = trigger.getBoundingClientRect();
    setCoords({
      top: rect.top - VIEWPORT_MARGIN_PX,
      left: clampHorizontal(rect.left + rect.width / 2 - TOOLTIP_WIDTH_PX / 2),
    });
  }, []);

  const show = useCallback(() => {
    updatePosition();
    setOpen(true);
  }, [updatePosition]);

  const hide = useCallback(() => {
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onLayoutChange = () => updatePosition();
    window.addEventListener('scroll', onLayoutChange, true);
    window.addEventListener('resize', onLayoutChange);
    return () => {
      window.removeEventListener('scroll', onLayoutChange, true);
      window.removeEventListener('resize', onLayoutChange);
    };
  }, [open, updatePosition]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className="feature-help-tip__trigger"
        aria-describedby={open ? id : undefined}
        aria-label={label}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        i
      </button>
      {open
        ? createPortal(
            <span
              role="tooltip"
              id={id}
              className="feature-help-tip__content feature-help-tip__content--floating"
              style={{ top: coords.top, left: coords.left, width: TOOLTIP_WIDTH_PX }}
            >
              {text}
            </span>,
            document.body,
          )
        : null}
    </>
  );
}
