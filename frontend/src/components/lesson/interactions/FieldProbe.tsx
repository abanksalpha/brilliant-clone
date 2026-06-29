import { type KeyboardEvent } from 'react';
import { forceOnCharge, magnitude, netForceFromCharges, type Vec2 } from '../physics';
import { Arrow, Charge, DragHandle, clamp, scaleByReference, usePointerDrag } from '../scenes/primitives';
import { ARROW_GAP, FIELD, FIELD_CHARGE_R, type Point } from './TwoChargeField';

export type FieldSource = { id: string; x: number; y: number; q: number };

const HEAD_SCALE = FIELD.w / 360;
const MARGIN = 34;
const PROBE_R = 7;
// At a null point the two contribution arrows point opposite ways along the axis;
// offset them onto parallel tracks (one above, one below) so both stay readable.
const CONTRIB_TRACK = 16;

function signOf(q: number): '+' | '-' | 'neutral' {
  if (q > 0) return '+';
  if (q < 0) return '-';
  return 'neutral';
}

function unit(v: Vec2, fallback: Vec2): Vec2 {
  const m = magnitude(v);
  return m < 1e-12 ? fallback : { x: v.x / m, y: v.y / m };
}

// Source charges and a probe point. On reveal the field at the probe is drawn off
// the probe: a single net arrow for a lone source, or each source's contribution
// (so two equal-and-opposite fields read as a null point). In the predict stage the
// learner drags a dashed guess for the field, anchored on the probe.
export function FieldProbe({
  sources,
  probe,
  showField,
  showMode,
  refForce,
  refPx,
  prediction,
  onPredictMove,
  onProbeMove,
  probeMovable = false,
}: {
  sources: FieldSource[];
  probe: Point;
  showField: boolean;
  showMode: 'net' | 'contributions';
  refForce: number;
  refPx: number;
  prediction?: Point | null;
  onPredictMove?: (pt: Point) => void;
  onProbeMove?: (pt: Point) => void;
  probeMovable?: boolean;
}) {
  const clampToFigure = (p: Point): Point => ({
    x: clamp(p.x, MARGIN, FIELD.w - MARGIN),
    y: clamp(p.y, MARGIN, FIELD.h - MARGIN),
  });

  const predictDrag = usePointerDrag(
    (pt) => onPredictMove?.(clampToFigure(pt)),
    () => prediction ?? probe,
  );
  const probeDrag = usePointerDrag(
    (pt) => onProbeMove?.(clampToFigure(pt)),
    () => probe,
  );

  const probePC = { x: probe.x, y: probe.y, q: 1 };
  const sourcePCs = sources.map((s) => ({ x: s.x, y: s.y, q: s.q }));
  const contributions = sourcePCs.map((s) => forceOnCharge(probePC, s));
  const net = netForceFromCharges(probePC, sourcePCs);
  const netU = unit(net, { x: 1, y: 0 });
  const netLen = scaleByReference(magnitude(net), refForce, refPx);
  const isNull = magnitude(net) / (refForce || 1) < 0.08;

  const predDir = prediction ? unit({ x: prediction.x - probe.x, y: prediction.y - probe.y }, netU) : netU;
  const predOrigin = { x: probe.x + predDir.x * (PROBE_R + ARROW_GAP), y: probe.y + predDir.y * (PROBE_R + ARROW_GAP) };
  const handlePoint = prediction ?? predOrigin;
  const reachDist = prediction ? Math.hypot(prediction.x - probe.x, prediction.y - probe.y) : 0;
  const predLen = Math.max(0, reachDist - (PROBE_R + ARROW_GAP));
  const predTip = { x: predOrigin.x + predDir.x * predLen, y: predOrigin.y + predDir.y * predLen };

  const fieldArrow = (u: Vec2, len: number, perp: Point) => {
    if (len < 1) return null;
    const tailX = probe.x + u.x * (PROBE_R + ARROW_GAP) + perp.x;
    const tailY = probe.y + u.y * (PROBE_R + ARROW_GAP) + perp.y;
    return <Arrow x1={tailX} y1={tailY} x2={tailX + u.x * len} y2={tailY + u.y * len} tone="net" headScale={HEAD_SCALE} />;
  };

  return (
    <div className="cl1-figure" data-testid="field-probe">
      <svg viewBox={`0 0 ${FIELD.w} ${FIELD.h}`} preserveAspectRatio="xMidYMid meet">
        {showField && showMode === 'net' ? <g data-testid="field-net">{fieldArrow(netU, netLen, { x: 0, y: 0 })}</g> : null}

        {showField && showMode === 'contributions' ? (
          <g data-testid="field-contributions">
            {contributions.map((c, i) => {
              const cu = unit(c, { x: 1, y: 0 });
              const clen = scaleByReference(magnitude(c), refForce, refPx);
              // Two collinear contributions overlap on the axis, so split them onto
              // tracks (one up, one down). Three or more radiate in different
              // directions and read fine drawn straight from the probe.
              const perp = sources.length === 2 ? { x: 0, y: (i === 0 ? -1 : 1) * CONTRIB_TRACK } : { x: 0, y: 0 };
              return <g key={sources[i].id}>{fieldArrow(cu, clen, perp)}</g>;
            })}
            {isNull ? (
              <text className="field-null" x={probe.x} y={probe.y - 34} textAnchor="middle" dy="0.32em">
                0
              </text>
            ) : null}
          </g>
        ) : null}

        {prediction ? (
          <g data-testid="field-ghost">
            <Arrow x1={predOrigin.x} y1={predOrigin.y} x2={predTip.x} y2={predTip.y} tone="ghost" dashed headScale={HEAD_SCALE} />
          </g>
        ) : null}

        {sources.map((s) => (
          <g key={s.id}>
            <Charge x={s.x} y={s.y} sign={signOf(s.q)} count={Math.abs(s.q)} r={FIELD_CHARGE_R} />
          </g>
        ))}

        {renderProbe()}

        {onPredictMove && prediction ? (
          <DragHandle
            drag={predictDrag}
            label="Your predicted field"
            min={0}
            max={Math.round(FIELD.w)}
            value={Math.round(handlePoint.x)}
            onKeyDown={predictKey}
            testId="field-predict-handle"
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

  function renderProbe() {
    const dot = <circle className="field-probe-point" cx={probe.x} cy={probe.y} r={PROBE_R} />;
    if (onProbeMove && probeMovable) {
      return (
        <DragHandle
          drag={probeDrag}
          label="Move the probe point"
          min={0}
          max={Math.round(FIELD.w)}
          value={Math.round(probe.x)}
          onKeyDown={probeKey}
          testId="field-probe-handle"
          x={probe.x}
          y={probe.y}
        >
          {dot}
        </DragHandle>
      );
    }
    return <g data-testid="field-probe-point">{dot}</g>;
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

  function probeKey(event: KeyboardEvent<SVGGElement>) {
    if (!onProbeMove) return;
    const step = 8;
    let dx = 0;
    let dy = 0;
    if (event.key === 'ArrowRight') dx = step;
    else if (event.key === 'ArrowLeft') dx = -step;
    else if (event.key === 'ArrowUp') dy = -step;
    else if (event.key === 'ArrowDown') dy = step;
    if (dx === 0 && dy === 0) return;
    event.preventDefault();
    onProbeMove(clampToFigure({ x: probe.x + dx, y: probe.y + dy }));
  }
}
