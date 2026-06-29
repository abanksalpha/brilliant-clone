import { type KeyboardEvent } from 'react';
import { magnitude, type Vec2 } from '../physics';
import { Arrow, DragHandle, clamp, scaleByReference, usePointerDrag } from '../scenes/primitives';
import { ARROW_GAP, FIELD, type Point } from './TwoChargeField';

export type RodCharge = { x: number; y: number; q: number };
export type Sphere = { x: number; y: number; r: number };

// Match the on-screen arrowhead size to the lesson's other scenes (viewBox 360).
const HEAD_SCALE = FIELD.w / 360;
const MARGIN = 34;
// The charged rod, drawn as an upright bar of stacked sign glyphs. The force model
// treats it as a point charge at its center, so the bar is purely presentational.
const ROD_W = 44;
const ROD_H = 156;

function unit(v: Vec2, fallback: Vec2): Vec2 {
  const m = magnitude(v);
  return m < 1e-9 ? fallback : { x: v.x / m, y: v.y / m };
}

// A charged rod beside a neutral conducting sphere. In the predict stage the sphere
// reads neutral and the learner drags a dashed guess for the net force it feels. On
// reveal the sphere shows its induced separation (opposite sign on the near side,
// same sign on the far side) and the true net force, drawn off the sphere edge
// toward the rod. The rod can then be dragged nearer or farther to explore.
export function PolarizationField({
  rod,
  sphere,
  showInduced,
  netForce,
  refForce,
  refPx,
  prediction,
  onPredictMove,
  onRodMove,
  rodMovable = false,
}: {
  rod: RodCharge;
  sphere: Sphere;
  showInduced: boolean;
  netForce: Vec2 | null;
  refForce: number;
  refPx: number;
  prediction?: Point | null;
  onPredictMove?: (pt: Point) => void;
  onRodMove?: (pt: Point) => void;
  rodMovable?: boolean;
}) {
  const clampToFigure = (p: Point): Point => ({
    x: clamp(p.x, MARGIN, FIELD.w - MARGIN),
    y: clamp(p.y, MARGIN, FIELD.h - MARGIN),
  });

  const predictDrag = usePointerDrag(
    (point) => onPredictMove?.(clampToFigure(point)),
    () => prediction ?? { x: sphere.x, y: sphere.y },
  );
  const rodDrag = usePointerDrag(
    (point) => onRodMove?.(clampToFigure(point)),
    () => ({ x: rod.x, y: rod.y }),
  );

  // The polarization (and force) axis runs from the sphere toward the rod.
  const axis = unit({ x: rod.x - sphere.x, y: rod.y - sphere.y }, { x: 1, y: 0 });

  // Revealed net force: drawn off the sphere edge along its own direction (toward
  // the rod), its length scaled against the reference like every arrow.
  const netU = netForce ? unit(netForce, axis) : axis;
  const netTail = { x: sphere.x + netU.x * (sphere.r + ARROW_GAP), y: sphere.y + netU.y * (sphere.r + ARROW_GAP) };
  // Never let the arrow cross into the rod: clamp its head a margin short of the
  // rod's near edge. The force points toward the rod, so the arrow grows into a
  // shrinking gap as the rod nears; this keeps it readable instead of piercing it.
  const rodNearEdge = rod.x - ROD_W / 2;
  const rawNetLen = netForce ? scaleByReference(magnitude(netForce), refForce, refPx) : 0;
  const maxNetLen = netU.x > 0.01 ? Math.max(0, (rodNearEdge - 10 - netTail.x) / netU.x) : Number.POSITIVE_INFINITY;
  const netLen = Math.min(rawNetLen, maxNetLen);

  // Ghost prediction anchored on the sphere (the body that feels the force). Drawn
  // like a force arrow: tail a gap off the sphere edge along the dragged direction,
  // shaft to the dragged tip, collapsing to length 0 once the tip is on the sphere.
  const predDir = prediction
    ? unit({ x: prediction.x - sphere.x, y: prediction.y - sphere.y }, axis)
    : axis;
  const predOrigin = {
    x: sphere.x + predDir.x * (sphere.r + ARROW_GAP),
    y: sphere.y + predDir.y * (sphere.r + ARROW_GAP),
  };
  const handlePoint = prediction ?? predOrigin;
  const reachDist = prediction ? Math.hypot(prediction.x - sphere.x, prediction.y - sphere.y) : 0;
  const predLen = Math.max(0, reachDist - (sphere.r + ARROW_GAP));
  const predTip = { x: predOrigin.x + predDir.x * predLen, y: predOrigin.y + predDir.y * predLen };

  // Induced charge: opposite sign on the near side (toward the rod), same sign on
  // the far side. Three stacked glyphs per side sit on a band inside the surface.
  const nearSign = rod.q >= 0 ? '-' : '+';
  const farSign = rod.q >= 0 ? '+' : '-';
  const sideOffset = sphere.r * 0.52;
  const nearX = sphere.x + axis.x * sideOffset;
  const farX = sphere.x - axis.x * sideOffset;
  const glyphRows = [-1, 0, 1];
  const toneOf = (s: string) => (s === '-' ? 'neg' : 'pos');

  return (
    <div className="cl1-figure" data-testid="polarization-field">
      <svg viewBox={`0 0 ${FIELD.w} ${FIELD.h}`} preserveAspectRatio="xMidYMid meet">
        {netForce && netLen >= 1 ? (
          <g data-testid="polarize-net-force">
            <Arrow x1={netTail.x} y1={netTail.y} x2={netTail.x + netU.x * netLen} y2={netTail.y + netU.y * netLen} tone="net" headScale={HEAD_SCALE} />
          </g>
        ) : null}

        {prediction ? (
          <g data-testid="polarize-ghost">
            <Arrow x1={predOrigin.x} y1={predOrigin.y} x2={predTip.x} y2={predTip.y} tone="ghost" dashed headScale={HEAD_SCALE} />
          </g>
        ) : null}

        <circle className="polarize-sphere" cx={sphere.x} cy={sphere.y} r={sphere.r} />

        {showInduced ? (
          <g data-testid="polarize-induced">
            <line
              className="polarize-split"
              x1={sphere.x}
              y1={sphere.y - sphere.r * 0.82}
              x2={sphere.x}
              y2={sphere.y + sphere.r * 0.82}
              aria-hidden="true"
            />
            {glyphRows.map((k) => (
              <text key={`near-${k}`} className={`polarize-glyph polarize-glyph--${toneOf(nearSign)}`} x={nearX} y={sphere.y + k * 26} textAnchor="middle" dy="0.32em">
                {nearSign}
              </text>
            ))}
            {glyphRows.map((k) => (
              <text key={`far-${k}`} className={`polarize-glyph polarize-glyph--${toneOf(farSign)}`} x={farX} y={sphere.y + k * 26} textAnchor="middle" dy="0.32em">
                {farSign}
              </text>
            ))}
          </g>
        ) : (
          <text className="polarize-neutral" x={sphere.x} y={sphere.y} textAnchor="middle" dy="0.32em">
            0
          </text>
        )}

        {renderRod()}

        {onPredictMove && prediction ? (
          <DragHandle
            drag={predictDrag}
            label="Your predicted force"
            min={0}
            max={Math.round(FIELD.w)}
            value={Math.round(handlePoint.x)}
            onKeyDown={predictKey}
            testId="polarize-predict-handle"
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

  function renderRod() {
    const x = rod.x - ROD_W / 2;
    const y = rod.y - ROD_H / 2;
    const sign = rod.q >= 0 ? '+' : '-';
    const count = clamp(Math.round(Math.abs(rod.q)), 1, 3);
    const rows = Array.from({ length: count }, (_, i) => i - (count - 1) / 2);
    const bar = (
      <g>
        <rect className="polarize-rod" x={x} y={y} width={ROD_W} height={ROD_H} rx={14} />
        {rows.map((row) => (
          <text key={row} className="polarize-rod-glyph" x={rod.x} y={rod.y + row * 42} textAnchor="middle" dy="0.32em">
            {sign}
          </text>
        ))}
      </g>
    );

    if (onRodMove && rodMovable) {
      return (
        <DragHandle
          drag={rodDrag}
          label="Move the charged rod"
          min={0}
          max={Math.round(FIELD.w)}
          value={Math.round(rod.x)}
          onKeyDown={rodKey}
          testId="polarize-rod"
          x={rod.x}
          y={rod.y}
        >
          {bar}
        </DragHandle>
      );
    }
    return (
      <g data-testid="polarize-rod" aria-hidden="true">
        {bar}
      </g>
    );
  }

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

  function rodKey(event: KeyboardEvent<SVGGElement>) {
    if (!onRodMove) return;
    const step = 8;
    let dx = 0;
    let dy = 0;
    if (event.key === 'ArrowRight') dx = step;
    else if (event.key === 'ArrowLeft') dx = -step;
    else if (event.key === 'ArrowUp') dy = -step;
    else if (event.key === 'ArrowDown') dy = step;
    if (dx === 0 && dy === 0) return;
    event.preventDefault();
    onRodMove(clampToFigure({ x: rod.x + dx, y: rod.y + dy }));
  }
}
