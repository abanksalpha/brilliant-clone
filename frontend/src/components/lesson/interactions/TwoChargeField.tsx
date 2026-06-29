import { type KeyboardEvent } from 'react';
import { forceVectorsForPair, magnitude, type PointCharge, type Vec2 } from '../physics';
import { Arrow, Charge, DragHandle, clamp, scaleByReference, usePointerDrag } from '../scenes/primitives';

export type FieldCharge = { id: 'left' | 'right'; x: number; y: number; q: number };
export type Point = { x: number; y: number };

// A wide coordinate space so force arrows have room to scale honestly (the
// strongest reachable force still fits) instead of being clipped or capped.
export const FIELD = { w: 760, h: 380 };
export const FIELD_CHARGE_R = 30;
// Gap between a charge edge and the tail of its force arrow, so the length reads.
export const ARROW_GAP = 10;
// When two attraction arrows would overlap in the gap between the charges, each is
// shifted this far perpendicular to the axis (one up, one down) onto its own track.
const ARROW_TRACK = 14;
const MARGIN = 34;

function signOf(q: number): '+' | '-' | 'neutral' {
  if (q > 0) return '+';
  if (q < 0) return '-';
  return 'neutral';
}

function toPC(c: FieldCharge): PointCharge {
  return { x: c.x, y: c.y, q: c.q };
}

function unit(v: Vec2, fallback: Vec2): Vec2 {
  const m = magnitude(v);
  return m < 1e-9 ? fallback : { x: v.x / m, y: v.y / m };
}

// The field uses a wide coordinate space, so scale arrowheads up to match, which
// keeps them the same on-screen size as the lesson's other scenes (viewBox 360).
const HEAD_SCALE = FIELD.w / 360;

export function TwoChargeField({
  left,
  right,
  refForce,
  refPx,
  prediction,
  onPredictMove,
  onChargeMove,
  onCycle,
  predictFrom = 'right',
  movable = 'none',
}: {
  left: FieldCharge;
  right: FieldCharge;
  refForce: number;
  refPx: number;
  // The learner's predicted force tip (px). Drawn as a dashed arrow off the right
  // charge; when onPredictMove is set it can be dragged freely in any direction.
  prediction?: Point | null;
  onPredictMove?: (pt: Point) => void;
  onChargeMove?: (id: 'left' | 'right', pt: Point) => void;
  onCycle?: (id: 'left' | 'right') => void;
  // Which charge the dashed prediction arrow is anchored on (it should be the one
  // that does not move on reveal).
  predictFrom?: 'left' | 'right';
  movable?: 'none' | 'right' | 'both';
}) {
  const forces = forceVectorsForPair(toPC(left), toPC(right));
  const leftU = unit(forces.onLeft, { x: -1, y: 0 });
  const rightU = unit(forces.onRight, { x: 1, y: 0 });

  const clampToFigure = (p: Point): Point => ({
    x: clamp(p.x, MARGIN, FIELD.w - MARGIN),
    y: clamp(p.y, MARGIN, FIELD.h - MARGIN),
  });

  // Three drag bindings, created unconditionally to respect the Rules of Hooks.
  const predictDrag = usePointerDrag(
    (point) => onPredictMove?.(clampToFigure(point)),
    () => prediction ?? { x: right.x, y: right.y },
  );
  const leftDrag = usePointerDrag(
    (point) => onChargeMove?.('left', clampToFigure(point)),
    () => ({ x: left.x, y: left.y }),
  );
  const rightDrag = usePointerDrag(
    (point) => onChargeMove?.('right', clampToFigure(point)),
    () => ({ x: right.x, y: right.y }),
  );

  // One rule for every force arrow (matching the lesson's other scenes): the tail
  // sits a gap off the charge edge and the shaft extends by `len` along the force
  // direction, so the head points outward for repulsion and inward for attraction.
  // Length is strictly proportional to the force and never capped.
  //
  // Attraction arrows point inward and can overlap in the gap between the charges,
  // merging into one double-headed line. When their combined length exceeds that
  // gap, split them onto parallel tracks (one above the axis, one below) so they
  // read as two distinct, equal-and-opposite arrows.
  const lenLeft = scaleByReference(magnitude(forces.onLeft), refForce, refPx);
  const lenRight = scaleByReference(magnitude(forces.onRight), refForce, refPx);
  const attracting = left.q * right.q < 0;
  const separation = Math.hypot(right.x - left.x, right.y - left.y);
  const innerGap = separation - 2 * (FIELD_CHARGE_R + ARROW_GAP);
  const splitTracks = attracting && lenLeft + lenRight > innerGap;
  const axis = unit({ x: right.x - left.x, y: right.y - left.y }, { x: 1, y: 0 });
  const trackPerp: Point = splitTracks
    ? { x: -axis.y * ARROW_TRACK, y: axis.x * ARROW_TRACK }
    : { x: 0, y: 0 };

  const forceArrow = (c: FieldCharge, u: Vec2, len: number, perpOffset: Point) => {
    if (len < 1) return null;
    const tailX = c.x + u.x * (FIELD_CHARGE_R + ARROW_GAP) + perpOffset.x;
    const tailY = c.y + u.y * (FIELD_CHARGE_R + ARROW_GAP) + perpOffset.y;
    return (
      <Arrow x1={tailX} y1={tailY} x2={tailX + u.x * len} y2={tailY + u.y * len} tone="net" headScale={HEAD_SCALE} />
    );
  };

  // Anchor the prediction on the charge that stays put, so the dashed arrow is
  // never orphaned when the other charge moves on reveal. It is drawn like a force
  // arrow: the tail sits a gap off the charge edge along the dragged direction and
  // the shaft runs toward the dragged tip.
  const predCharge = predictFrom === 'left' ? left : right;
  const predFallback = predictFrom === 'left' ? leftU : rightU;
  const predDir = prediction
    ? unit({ x: prediction.x - predCharge.x, y: prediction.y - predCharge.y }, predFallback)
    : predFallback;
  const predOrigin = {
    x: predCharge.x + predDir.x * (FIELD_CHARGE_R + ARROW_GAP),
    y: predCharge.y + predDir.y * (FIELD_CHARGE_R + ARROW_GAP),
  };
  // The handle follows the cursor exactly. The drawn arrow, though, falls back to
  // length 0 once the tip is inside the charge or its gap, so a guess dragged onto
  // the charge disappears instead of rendering as a reversed, broken arrow.
  const handlePoint = prediction ?? predOrigin;
  const reachDist = prediction
    ? Math.hypot(prediction.x - predCharge.x, prediction.y - predCharge.y)
    : 0;
  const predLen = Math.max(0, reachDist - (FIELD_CHARGE_R + ARROW_GAP));
  const arrowTip = { x: predOrigin.x + predDir.x * predLen, y: predOrigin.y + predDir.y * predLen };

  return (
    <div className="cl1-figure" data-testid="two-charge-field">
      <svg viewBox={`0 0 ${FIELD.w} ${FIELD.h}`} preserveAspectRatio="xMidYMid meet">
        {forceArrow(left, leftU, lenLeft, { x: -trackPerp.x, y: -trackPerp.y })}
        {forceArrow(right, rightU, lenRight, trackPerp)}

        {prediction ? (
          <g data-testid="ghost-arrow">
            <Arrow
              x1={predOrigin.x}
              y1={predOrigin.y}
              x2={arrowTip.x}
              y2={arrowTip.y}
              tone="ghost"
              dashed
              headScale={HEAD_SCALE}
            />
          </g>
        ) : null}

        {renderCharge(left)}
        {renderCharge(right)}

        {onPredictMove && prediction ? (
          <DragHandle
            drag={predictDrag}
            label="Your predicted force"
            min={0}
            max={Math.round(FIELD.w)}
            value={Math.round(handlePoint.x)}
            onKeyDown={predictKey}
            testId="predict-handle"
            x={handlePoint.x}
            y={handlePoint.y}
          >
            <circle className="pot-hit-target" cx={handlePoint.x} cy={handlePoint.y} r={26} />
            <circle className="predict-ring" cx={handlePoint.x} cy={handlePoint.y} r={15} />
          </DragHandle>
        ) : null}
      </svg>
    </div>
  );

  function predictKey(event: KeyboardEvent<SVGGElement>) {
    if (!prediction || !onPredictMove) return;
    const step = 8;
    let dx = 0;
    let dy = 0;
    if (event.key === 'ArrowRight') dx = step;
    else if (event.key === 'ArrowLeft') dx = -step;
    else if (event.key === 'ArrowUp') dy = -step;
    else if (event.key === 'ArrowDown') dy = step;
    if (dx === 0 && dy === 0) return;
    event.preventDefault();
    onPredictMove(clampToFigure({ x: prediction.x + dx, y: prediction.y + dy }));
  }

  function chargeKey(c: FieldCharge) {
    return (event: KeyboardEvent<SVGGElement>) => {
      if (!onChargeMove) return;
      const step = 8;
      let dx = 0;
      let dy = 0;
      if (event.key === 'ArrowRight') dx = step;
      else if (event.key === 'ArrowLeft') dx = -step;
      else if (event.key === 'ArrowUp') dy = -step;
      else if (event.key === 'ArrowDown') dy = step;
      if (dx === 0 && dy === 0) return;
      event.preventDefault();
      onChargeMove(c.id, clampToFigure({ x: c.x + dx, y: c.y + dy }));
    };
  }

  function renderCharge(c: FieldCharge) {
    const node = <Charge x={c.x} y={c.y} sign={signOf(c.q)} count={Math.abs(c.q)} r={FIELD_CHARGE_R} />;

    if (onCycle) {
      return (
        <g
          key={c.id}
          role="button"
          tabIndex={0}
          aria-label={`Cycle ${c.id} charge`}
          data-testid={`cycle-${c.id}`}
          onClick={() => onCycle(c.id)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onCycle(c.id);
            }
          }}
          style={{ cursor: 'pointer' }}
        >
          {node}
        </g>
      );
    }

    if (onChargeMove && (movable === 'both' || (movable === 'right' && c.id === 'right'))) {
      return (
        <DragHandle
          key={c.id}
          drag={c.id === 'left' ? leftDrag : rightDrag}
          label={`Move ${c.id} charge`}
          min={0}
          max={Math.round(FIELD.w)}
          value={Math.round(c.x)}
          onKeyDown={chargeKey(c)}
          testId={`move-${c.id}`}
          x={c.x}
          y={c.y}
        >
          {node}
        </DragHandle>
      );
    }

    return <g key={c.id}>{node}</g>;
  }
}
