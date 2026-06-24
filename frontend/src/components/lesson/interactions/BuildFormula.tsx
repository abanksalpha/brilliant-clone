import { useMemo, useRef, useState } from 'react';
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import type { BuildFormulaConfig } from '../../../content';
import type { AnswerStatus } from '../FeedbackRenderer';
import { Fraction } from '../conceptVisuals';
import { preventClickFocus } from '../shared/preventClickFocus';

type BuildFormulaProps = {
  config: BuildFormulaConfig;
  disabled?: boolean;
  onResult: (status: AnswerStatus) => void;
};

type SlotKey = string;

type DragState = {
  pointerId: number;
  pieceId: string;
  fromSlot: SlotKey | null;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  moved: boolean;
};

// A small dead-zone so a tap (place/remove) is never mistaken for a drag.
const MOVE_THRESHOLD = 4;

function sameMultiset(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((value, index) => value === sortedB[index]);
}

export function BuildFormula({ config, disabled = false, onResult }: BuildFormulaProps) {
  const numeratorSlots = useMemo(
    () => config.numerator.map((_, index) => `n${index}` as SlotKey),
    [config.numerator],
  );
  const denominatorSlots = useMemo(
    () => config.denominator.map((_, index) => `d${index}` as SlotKey),
    [config.denominator],
  );
  const orderedSlots = useMemo(
    () => [...numeratorSlots, ...denominatorSlots],
    [numeratorSlots, denominatorSlots],
  );

  const [placements, setPlacements] = useState<Record<SlotKey, string | null>>({});
  const [drag, setDrag] = useState<DragState | null>(null);
  const [hoverSlot, setHoverSlot] = useState<SlotKey | null>(null);

  const slotRefs = useRef<Record<SlotKey, HTMLDivElement | null>>({});
  // Authoritative copy of the active drag so pointer handlers never read a stale closure.
  const dragRef = useRef<DragState | null>(null);

  const usedPieceIds = new Set(Object.values(placements).filter(Boolean) as string[]);
  const trayPieces = config.pieces.filter((piece) => !usedPieceIds.has(piece.id));

  function labelFor(pieceId: string | null | undefined) {
    if (!pieceId) return null;
    return config.pieces.find((piece) => piece.id === pieceId)?.label ?? null;
  }

  function setDragState(next: DragState | null) {
    dragRef.current = next;
    setDrag(next);
  }

  function placeInNextEmpty(pieceId: string) {
    setPlacements((current) => {
      const slot = orderedSlots.find((key) => !current[key]);
      if (!slot) return current;
      return { ...current, [slot]: pieceId };
    });
  }

  function clearSlot(slot: SlotKey) {
    setPlacements((current) => ({ ...current, [slot]: null }));
  }

  function dropOnSlot(pieceId: string, fromSlot: SlotKey | null, targetSlot: SlotKey) {
    setPlacements((current) => {
      const next = { ...current };
      const displaced = next[targetSlot] ?? null;
      next[targetSlot] = pieceId;
      // Dragging between slots swaps; a displaced piece from the tray simply returns to the tray.
      if (fromSlot && fromSlot !== targetSlot) {
        next[fromSlot] = displaced;
      }
      return next;
    });
  }

  function slotAtPoint(x: number, y: number): SlotKey | null {
    for (const slot of orderedSlots) {
      const element = slotRefs.current[slot];
      if (!element) continue;
      const rect = element.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        return slot;
      }
    }
    return null;
  }

  function startDrag(
    event: ReactPointerEvent<HTMLElement>,
    pieceId: string,
    fromSlot: SlotKey | null,
  ) {
    if (disabled) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const rect = event.currentTarget.getBoundingClientRect();
    setDragState({
      pointerId: event.pointerId,
      pieceId,
      fromSlot,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      moved: false,
    });
    setHoverSlot(null);
  }

  function moveDrag(event: ReactPointerEvent<HTMLElement>) {
    const state = dragRef.current;
    if (!state || state.pointerId !== event.pointerId) return;
    event.preventDefault();
    const moved =
      state.moved ||
      Math.hypot(event.clientX - state.startX, event.clientY - state.startY) > MOVE_THRESHOLD;
    setDragState({ ...state, x: event.clientX, y: event.clientY, moved });
    setHoverSlot(moved ? slotAtPoint(event.clientX, event.clientY) : null);
  }

  function endDrag(event: ReactPointerEvent<HTMLElement>) {
    const state = dragRef.current;
    if (!state || state.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);

    if (!state.moved) {
      // Treat a tap like the old click: tray piece fills the next slot, a placed piece pops out.
      if (state.fromSlot) clearSlot(state.fromSlot);
      else placeInNextEmpty(state.pieceId);
    } else {
      const targetSlot = slotAtPoint(event.clientX, event.clientY);
      if (targetSlot) dropOnSlot(state.pieceId, state.fromSlot, targetSlot);
      else if (state.fromSlot) clearSlot(state.fromSlot);
    }

    setDragState(null);
    setHoverSlot(null);
  }

  function cancelDrag() {
    setDragState(null);
    setHoverSlot(null);
  }

  function onPieceKeyDown(
    event: ReactKeyboardEvent<HTMLElement>,
    pieceId: string,
    fromSlot: SlotKey | null,
  ) {
    if (disabled) return;
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      event.preventDefault();
      if (fromSlot) clearSlot(fromSlot);
      else placeInNextEmpty(pieceId);
    }
  }

  function check() {
    if (disabled) return;
    const numeratorPieces = numeratorSlots
      .map((slot) => placements[slot])
      .filter(Boolean) as string[];
    const denominatorPieces = denominatorSlots
      .map((slot) => placements[slot])
      .filter(Boolean) as string[];
    const correct =
      sameMultiset(numeratorPieces, config.numerator) &&
      sameMultiset(denominatorPieces, config.denominator);
    onResult(correct ? 'correct' : 'wrong');
  }

  const allFilled = orderedSlots.every((slot) => placements[slot]);

  function pieceHandlers(pieceId: string, fromSlot: SlotKey | null) {
    return {
      onMouseDown: preventClickFocus,
      onPointerDown: (event: ReactPointerEvent<HTMLElement>) => startDrag(event, pieceId, fromSlot),
      onPointerMove: moveDrag,
      onPointerUp: endDrag,
      onPointerCancel: cancelDrag,
      onLostPointerCapture: cancelDrag,
      onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) =>
        onPieceKeyDown(event, pieceId, fromSlot),
    };
  }

  function renderSlotRow(slots: SlotKey[]) {
    return (
      <div className="cl1-build-slot-row">
        {slots.map((slot) => {
          const pieceId = placements[slot] ?? null;
          const label = labelFor(pieceId);
          const isHover = hoverSlot === slot;
          const isSource = Boolean(drag?.moved && drag.fromSlot === slot);
          const interactive = Boolean(pieceId) && !disabled;
          const className = [
            'cl1-build-slot',
            label ? 'cl1-build-slot--filled' : '',
            isHover ? 'cl1-build-slot--hover' : '',
            isSource ? 'cl1-build-slot--source' : '',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <div
              key={slot}
              ref={(element) => {
                slotRefs.current[slot] = element;
              }}
              className={className}
              {...(interactive && pieceId
                ? {
                    role: 'button',
                    tabIndex: 0,
                    'aria-label': `Remove ${label}`,
                    ...pieceHandlers(pieceId, slot),
                  }
                : {})}
            >
              {label ?? <span className="cl1-build-slot-dot" aria-hidden="true" />}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className={`cl1-build${drag?.moved ? ' cl1-build--dragging' : ''}`}>
      <div className="cl1-build-equation">
        <span className="cl1-build-prefix">{config.prefixLabel ?? 'F = k ×'}</span>
        <Fraction
          numerator={renderSlotRow(numeratorSlots)}
          denominator={renderSlotRow(denominatorSlots)}
        />
      </div>

      <div className="cl1-build-tray" aria-label="Formula pieces">
        {trayPieces.map((piece) => {
          const isSource = Boolean(
            drag?.moved && drag.fromSlot === null && drag.pieceId === piece.id,
          );
          return (
            <button
              key={piece.id}
              type="button"
              className={`cl1-build-piece${isSource ? ' cl1-build-piece--source' : ''}`}
              disabled={disabled}
              {...pieceHandlers(piece.id, null)}
            >
              {piece.label}
            </button>
          );
        })}
      </div>

      <button
        className="secondary-button"
        type="button"
        disabled={disabled || !allFilled}
        onClick={check}
      >
        Check formula
      </button>

      {drag?.moved
        ? createPortal(
            <div
              className="cl1-build-ghost"
              aria-hidden="true"
              style={{
                left: `${drag.x - drag.offsetX}px`,
                top: `${drag.y - drag.offsetY}px`,
                width: `${drag.width}px`,
                height: `${drag.height}px`,
              }}
            >
              {labelFor(drag.pieceId)}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
