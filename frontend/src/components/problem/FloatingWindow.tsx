import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import {
  centeredPosition,
  clampPosition,
  clampSizeAt,
  type Size,
  type Vec,
} from './floatingWindowGeometry';

type FloatingWindowProps = {
  title: string;
  onClose: () => void;
  initialWidth?: number;
  initialHeight?: number;
  children: ReactNode;
};

function viewport() {
  return { w: window.innerWidth, h: window.innerHeight };
}

/**
 * A movable, resizable, non modal floating window. It opens pixel centered, is
 * dragged by its header and resized from its bottom right grip, and is clamped
 * so it can never leave the viewport (including when the viewport itself
 * shrinks). All the math lives in floatingWindow.ts so it stays testable.
 */
export function FloatingWindow({
  title,
  onClose,
  initialWidth = 460,
  initialHeight = 640,
  children,
}: FloatingWindowProps) {
  const [size, setSize] = useState<Size>(() =>
    clampSizeAt({ x: 0, y: 0 }, { w: initialWidth, h: initialHeight }, viewport()),
  );
  const [pos, setPos] = useState<Vec>(() => centeredPosition(size, viewport()));
  // While a drag or resize is in flight the body iframe is made click through, so
  // moving the pointer over the PDF cannot swallow the gesture (pointer capture
  // is not reliable across iframe boundaries).
  const [interacting, setInteracting] = useState(false);

  const dragRef = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);
  const resizeRef = useRef<{ px: number; py: number; ow: number; oh: number } | null>(null);

  // Mirror the live geometry into refs so the window resize listener (bound
  // once) always reads current values without restarting.
  const posRef = useRef(pos);
  const sizeRef = useRef(size);
  posRef.current = pos;
  sizeRef.current = size;

  useEffect(() => {
    function onViewportResize() {
      const v = viewport();
      const nextSize = clampSizeAt(posRef.current, sizeRef.current, v);
      const nextPos = clampPosition(posRef.current, nextSize, v);
      setSize(nextSize);
      setPos(nextPos);
    }
    window.addEventListener('resize', onViewportResize);
    return () => window.removeEventListener('resize', onViewportResize);
  }, []);

  function onHeaderPointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (event.button !== 0) return;
    // Let controls inside the header (the close button) work normally.
    if ((event.target as HTMLElement).closest('button')) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { px: event.clientX, py: event.clientY, ox: pos.x, oy: pos.y };
    setInteracting(true);
  }

  function onHeaderPointerMove(event: ReactPointerEvent<HTMLElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const next = {
      x: drag.ox + (event.clientX - drag.px),
      y: drag.oy + (event.clientY - drag.py),
    };
    setPos(clampPosition(next, size, viewport()));
  }

  function endHeaderDrag(event: ReactPointerEvent<HTMLElement>) {
    if (!dragRef.current) return;
    dragRef.current = null;
    setInteracting(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function onResizePointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeRef.current = { px: event.clientX, py: event.clientY, ow: size.w, oh: size.h };
    setInteracting(true);
  }

  function onResizePointerMove(event: ReactPointerEvent<HTMLElement>) {
    const start = resizeRef.current;
    if (!start) return;
    const next = {
      w: start.ow + (event.clientX - start.px),
      h: start.oh + (event.clientY - start.py),
    };
    setSize(clampSizeAt(pos, next, viewport()));
  }

  function endResize(event: ReactPointerEvent<HTMLElement>) {
    if (!resizeRef.current) return;
    resizeRef.current = null;
    setInteracting(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  }

  // Rendered into document.body so the fixed window escapes the lesson/problem
  // player's stacking context (a transformed ancestor would otherwise trap it
  // below the floating rail). At the document root its z-index wins, so the sheet
  // floats above the rail, toolbar, and phase content.
  return createPortal(
    <section
      // theme-handdrawn travels with the portaled window: rendered into document.body
      // it is no longer inside the lesson shell, so without it the close button (which
      // gets its sketch look from .theme-handdrawn .session-close, plus the --hd-* vars)
      // would fall back to the plain base style.
      className={`floating-window theme-handdrawn${interacting ? ' floating-window--interacting' : ''}`}
      role="dialog"
      aria-label={title}
      style={{ left: pos.x, top: pos.y, width: size.w, height: size.h }}
    >
      <header
        className="floating-window-header"
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={endHeaderDrag}
        onPointerCancel={endHeaderDrag}
      >
        <span className="floating-window-title">{title}</span>
        <button
          type="button"
          className="session-close floating-window-close"
          onClick={onClose}
          aria-label="Close"
        >
          <X size={18} strokeWidth={2.4} aria-hidden="true" />
        </button>
      </header>

      <div className="floating-window-body">{children}</div>

      <span
        className="floating-window-resize"
        aria-hidden="true"
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={endResize}
        onPointerCancel={endResize}
      />
    </section>,
    document.body,
  );
}
