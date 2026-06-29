import {
  useRef,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { preventClickFocus } from '../shared/preventClickFocus';

export const VIEW = { h: 220, w: 360 };
export const CHARGE_R = 18;

export function Charge({
  x,
  y,
  sign,
  count = 1,
  r = CHARGE_R,
  muted = false,
}: {
  x: number;
  y: number;
  sign: '+' | '-' | 'neutral';
  count?: number;
  r?: number;
  muted?: boolean;
}) {
  const tone = sign === '+' ? 'positive' : sign === '-' ? 'negative' : 'neutral';
  const glyphCount = Math.max(1, Math.min(3, Math.round(count)));
  const label = sign === 'neutral' ? '0' : sign.repeat(glyphCount);
  // Keep the circle a fixed size; shrink the type a little when several glyphs share it.
  const fontSize = label.length > 1 ? Math.max(11, Math.round(r * 0.6)) : Math.max(14, Math.round(r * 0.9));
  // Per-glyph optical centering: dominant-baseline centers the font line box, but
  // each glyph's ink sits high in this hand font by a different amount, so nudge
  // each down to its visual center (tuned against rendered pixels). '0' sits the
  // highest and needs the most.
  const dy = sign === 'neutral' ? '0.12em' : sign === '+' ? '0.08em' : '0.05em';
  return (
    <g opacity={muted ? 0.45 : 1}>
      <circle className={`charge-circle charge-circle-${tone}`} cx={x} cy={y} r={r} />
      <text
        className="charge-sign cl1-charge-sign"
        dy={dy}
        style={{ fontSize: `${fontSize}px` }}
        textAnchor="middle"
        x={x}
        y={y}
      >
        {label}
      </text>
    </g>
  );
}

export function Arrow({
  x1,
  x2,
  y1,
  y2,
  tone,
  headScale = 1,
  dashed = false,
}: {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
  tone?: 'net' | 'ghost';
  headScale?: number;
  // A dashed shaft for a predicted ("ghost") arrow. The geometry, head, and gap
  // are identical to a solid force arrow; only the stroke differs.
  dashed?: boolean;
}) {
  const totalLength = Math.hypot(x2 - x1, y2 - y1);
  if (totalLength < 1) return null;

  const angle = Math.atan2(y2 - y1, x2 - x1);
  const nominalHeadLength = Math.min(12 * headScale, Math.max(9 * headScale, totalLength * 0.62));
  const headLength = Math.min(nominalHeadLength, Math.max(totalLength - 0.2, 0.2));
  const headWidth = Math.min(9.2 * headScale, Math.max(6.8 * headScale, headLength * 0.95));
  const shaftInset = Math.min(headLength - 1, Math.max(totalLength - 1, 0));
  const shaftEnd = {
    x: x2 - Math.cos(angle) * shaftInset,
    y: y2 - Math.sin(angle) * shaftInset,
  };
  const left = {
    x: x2 - Math.cos(angle) * headLength + Math.cos(angle + Math.PI / 2) * (headWidth / 2),
    y: y2 - Math.sin(angle) * headLength + Math.sin(angle + Math.PI / 2) * (headWidth / 2),
  };
  const right = {
    x: x2 - Math.cos(angle) * headLength - Math.cos(angle + Math.PI / 2) * (headWidth / 2),
    y: y2 - Math.sin(angle) * headLength - Math.sin(angle + Math.PI / 2) * (headWidth / 2),
  };
  const toneClass = tone === 'net' ? ' force-arrow-net' : tone === 'ghost' ? ' force-arrow-ghost' : '';
  const className = `force-arrow${toneClass}`;
  const shaftClassName = `${className}${dashed ? ' force-arrow-dashed' : ''}`;

  return (
    <g>
      {Math.hypot(shaftEnd.x - x1, shaftEnd.y - y1) > 0.5 ? (
        <line className={shaftClassName} x1={x1} x2={shaftEnd.x} y1={y1} y2={shaftEnd.y} />
      ) : null}
      <polygon
        className={`inline-arrow-head ${className}`}
        points={`${x2},${y2} ${left.x},${left.y} ${right.x},${right.y}`}
      />
    </g>
  );
}

export function DragHandle({
  children,
  drag,
  label,
  max,
  min,
  onKeyDown,
  tone,
  value,
  valueText,
  x,
  y,
  testId,
}: {
  children: ReactNode;
  drag: ReturnType<typeof usePointerDrag>;
  label: string;
  max: number;
  min: number;
  onKeyDown: (event: KeyboardEvent<SVGGElement>) => void;
  tone?: 'neutral' | 'positive' | 'negative';
  value: number;
  valueText?: string;
  x: number;
  y: number;
  testId?: string;
}) {
  const toneClass = tone ? ` drag-charge-handle drag-charge-handle--${tone}` : '';
  const hitTargetClass = tone ? 'pot-hit-target pot-hit-target--drag' : 'pot-hit-target';

  return (
    <g
      className={`field-probe-handle${toneClass}`}
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemax={max}
      aria-valuemin={min}
      aria-valuenow={value}
      aria-valuetext={valueText}
      data-testid={testId}
      onKeyDown={onKeyDown}
      onMouseDown={preventClickFocus}
      onPointerDown={drag.onPointerDown}
      onPointerMove={drag.onPointerMove}
      onPointerUp={drag.onPointerUp}
      onPointerCancel={drag.onPointerCancel}
      onLostPointerCapture={drag.onLostPointerCapture}
    >
      <circle className={hitTargetClass} cx={x} cy={y} r={24} />
      {children}
    </g>
  );
}

export function Legend({ text }: { text: string }) {
  return <p className="cl1-legend">{text}</p>;
}

export function ReadoutRow({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <dl className="lesson-visual-readouts">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function usePointerDrag(
  onMove: (point: { x: number; y: number }) => void,
  getAnchor: () => { x: number; y: number },
  onEnd?: () => void,
) {
  const dragState = useRef<{
    pointerId: number;
    startAnchor: { x: number; y: number };
    startClient: { x: number; y: number };
    startRect: { h: number; w: number };
    viewW: number;
    viewH: number;
  } | null>(null);
  const hasMoved = useRef(false);

  function finishDrag() {
    if (!dragState.current) return;
    dragState.current = null;
    hasMoved.current = false;
    onEnd?.();
  }

  return {
    onPointerDown(event: ReactPointerEvent<SVGGElement>) {
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);
      const svg = event.currentTarget.ownerSVGElement;
      const rect = svg?.getBoundingClientRect();
      const viewBox = svg?.viewBox?.baseVal;
      dragState.current = {
        pointerId: event.pointerId,
        startAnchor: getAnchor(),
        startClient: { x: event.clientX, y: event.clientY },
        startRect: {
          h: rect?.height || VIEW.h,
          w: rect?.width || VIEW.w,
        },
        // Read the SVG's own viewBox so a drag tracks the cursor 1:1 whatever the
        // scene's coordinate size is (not the hardcoded VIEW).
        viewW: viewBox && viewBox.width ? viewBox.width : VIEW.w,
        viewH: viewBox && viewBox.height ? viewBox.height : VIEW.h,
      };
      hasMoved.current = false;
    },
    onPointerMove(event: ReactPointerEvent<SVGGElement>) {
      if (!dragState.current || dragState.current.pointerId !== event.pointerId) return;

      const deltaX = event.clientX - dragState.current.startClient.x;
      const deltaY = event.clientY - dragState.current.startClient.y;
      if (!hasMoved.current && Math.hypot(deltaX, deltaY) < 3) return;

      event.preventDefault();
      hasMoved.current = true;
      // preserveAspectRatio="meet" scales the viewBox uniformly and letterboxes
      // the wider axis, so use one scale (the larger ratio) for both axes. This
      // keeps a drag exactly 1:1 with the cursor instead of drifting on the
      // letterboxed axis.
      const scale = Math.max(
        dragState.current.viewW / dragState.current.startRect.w,
        dragState.current.viewH / dragState.current.startRect.h,
      );
      onMove({
        x: dragState.current.startAnchor.x + deltaX * scale,
        y: dragState.current.startAnchor.y + deltaY * scale,
      });
    },
    onPointerUp(event: ReactPointerEvent<SVGGElement>) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      finishDrag();
    },
    onPointerCancel() {
      finishDrag();
    },
    onLostPointerCapture() {
      finishDrag();
    },
  };
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

// Map a value to a pixel length relative to a reference value, so arrows are
// sized honestly against one another. Brought over from the saga scenes.
export function scaleByReference(value: number, referenceValue: number, referencePx: number) {
  if (referenceValue <= 0) return 0;
  return (value / referenceValue) * referencePx;
}
