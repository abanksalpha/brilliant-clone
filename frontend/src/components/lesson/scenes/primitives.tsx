import {
  useRef,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { preventClickFocus } from '../shared/preventClickFocus';

export const VIEW = { h: 220, w: 360 };
export const CHARGE_R = 18;

export function Figure({ children }: { children: ReactNode }) {
  return (
    <div className="cl1-figure">
      <svg viewBox={`0 0 ${VIEW.w} ${VIEW.h}`} preserveAspectRatio="xMidYMid meet">
        {children}
      </svg>
    </div>
  );
}

export function Charge({
  x,
  y,
  sign,
  r = CHARGE_R,
  muted = false,
}: {
  x: number;
  y: number;
  sign: '+' | '-' | 'neutral';
  r?: number;
  muted?: boolean;
}) {
  const tone = sign === '+' ? 'positive' : sign === '-' ? 'negative' : 'neutral';
  const fontSize = Math.max(14, Math.round(r * 0.9));
  const label = sign === 'neutral' ? '0' : sign;
  const dy = sign === '-' ? '0.02em' : '0.03em';
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
}: {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
  tone?: 'net';
}) {
  const totalLength = Math.hypot(x2 - x1, y2 - y1);
  if (totalLength < 1) return null;

  const angle = Math.atan2(y2 - y1, x2 - x1);
  const nominalHeadLength = Math.min(12, Math.max(9, totalLength * 0.62));
  const headLength = Math.min(nominalHeadLength, Math.max(totalLength - 0.2, 0.2));
  const headWidth = Math.min(9.2, Math.max(6.8, headLength * 0.95));
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
  const className = `force-arrow${tone === 'net' ? ' force-arrow-net' : ''}`;

  return (
    <g>
      {Math.hypot(shaftEnd.x - x1, shaftEnd.y - y1) > 0.5 ? (
        <line className={className} x1={x1} x2={shaftEnd.x} y1={y1} y2={shaftEnd.y} />
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

export function MiniPanel({
  children,
  title,
  onSelect,
  selected,
  ariaLabel,
}: {
  children: ReactNode;
  title: string;
  onSelect?: () => void;
  selected?: boolean;
  ariaLabel?: string;
}) {
  if (onSelect) {
    return (
      <button
        type="button"
        className={`cl1-mini-panel cl1-mini-panel--tappable${selected ? ' cl1-mini-panel--selected' : ''}`}
        aria-label={ariaLabel ?? title}
        aria-pressed={selected}
        onMouseDown={preventClickFocus}
        onClick={onSelect}
      >
        <strong>{title}</strong>
        {children}
      </button>
    );
  }

  return (
    <div className="cl1-mini-panel">
      <strong>{title}</strong>
      {children}
    </div>
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
      const rect = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
      dragState.current = {
        pointerId: event.pointerId,
        startAnchor: getAnchor(),
        startClient: { x: event.clientX, y: event.clientY },
        startRect: {
          h: rect?.height || VIEW.h,
          w: rect?.width || VIEW.w,
        },
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
      const scaleX = VIEW.w / dragState.current.startRect.w;
      const scaleY = VIEW.h / dragState.current.startRect.h;
      onMove({
        x: dragState.current.startAnchor.x + deltaX * scaleX,
        y: dragState.current.startAnchor.y + deltaY * scaleY,
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

export function scaleByReference(value: number, referenceValue: number, referencePx: number) {
  return (value / referenceValue) * referencePx;
}
