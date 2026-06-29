import { type KeyboardEvent } from 'react';
import { Charge, DragHandle, clamp, usePointerDrag } from '../scenes/primitives';
import { FIELD } from './TwoChargeField';

const NRAYS = 12;
const HEAD = 9;
// Flux gauge (a vertical bar), matching the flux scene.
const GX = 628;
const GW = 48;
const GY = 70;
const GH = 240;
const GBOTTOM = GY + GH;

// A point charge with a radial field and a Gaussian surface (a dashed loop). The
// learner drags the gauge to predict the net flux through the loop; the reveal shows
// it depends only on whether the charge is enclosed: a loop around the charge passes
// all of it (Q / epsilon_0), a loop beside it passes a net of zero.
export function GaussScene({
  enclosed,
  revealed,
  trueFraction,
  prediction,
  onPredict,
}: {
  enclosed: boolean;
  revealed: boolean;
  trueFraction: number;
  prediction: number | null;
  onPredict?: (fraction: number) => void;
}) {
  // Two compositions that both stay inside the 760 by 380 viewBox so no ray, head,
  // or arc is clipped at the frame. Enclosed: the charge sits at the loop's center
  // and rays reach just past the loop, so every line leaves through it. Outside: the
  // charge sits clear of the loop on the left and the rays are short enough to fit
  // top to bottom while still reaching into the loop, so lines read as passing through.
  const charge = enclosed ? { x: 300, y: 190 } : { x: 215, y: 190 };
  const loop = enclosed ? { x: 300, y: 190, r: 112 } : { x: 430, y: 190, r: 110 };
  const rayLen = enclosed ? 152 : 165;

  const gaugeDrag = usePointerDrag(
    (pt) => onPredict?.(clamp((GBOTTOM - pt.y) / GH, 0, 1)),
    () => ({ x: GX + GW / 2, y: GBOTTOM - (prediction ?? 0) * GH }),
  );

  const rays = Array.from({ length: NRAYS }, (_, i) => {
    const angle = (i / NRAYS) * Math.PI * 2;
    return {
      x: charge.x + Math.cos(angle) * rayLen,
      y: charge.y + Math.sin(angle) * rayLen,
      ax: Math.cos(angle),
      ay: Math.sin(angle),
    };
  });

  const predFraction = prediction ?? 0;
  const fillFraction = revealed ? trueFraction : predFraction;
  const fillTop = GBOTTOM - fillFraction * GH;
  const handleY = GBOTTOM - predFraction * GH;

  const leftArc = `M ${loop.x},${loop.y - loop.r} A ${loop.r},${loop.r} 0 0 0 ${loop.x},${loop.y + loop.r}`;
  const rightArc = `M ${loop.x},${loop.y - loop.r} A ${loop.r},${loop.r} 0 0 1 ${loop.x},${loop.y + loop.r}`;

  return (
    <div className="cl1-figure" data-testid="gauss-scene">
      <svg viewBox={`0 0 ${FIELD.w} ${FIELD.h}`} preserveAspectRatio="xMidYMid meet">
        {rays.map((ray, i) => (
          <g key={i} className="gauss-ray">
            <line x1={charge.x} y1={charge.y} x2={ray.x} y2={ray.y} />
            <polygon
              points={`${ray.x},${ray.y} ${ray.x - ray.ax * HEAD - ray.ay * HEAD * 0.55},${ray.y - ray.ay * HEAD + ray.ax * HEAD * 0.55} ${ray.x - ray.ax * HEAD + ray.ay * HEAD * 0.55},${ray.y - ray.ay * HEAD - ray.ax * HEAD * 0.55}`}
            />
          </g>
        ))}

        <circle className="gauss-loop" cx={loop.x} cy={loop.y} r={loop.r} data-testid="gauss-loop" />

        {revealed ? (
          enclosed ? (
            <circle className="gauss-arc gauss-arc--out" cx={loop.x} cy={loop.y} r={loop.r} data-testid="gauss-out" />
          ) : (
            <g data-testid="gauss-inout">
              <path className="gauss-arc gauss-arc--in" d={leftArc} />
              <path className="gauss-arc gauss-arc--out" d={rightArc} />
            </g>
          )
        ) : null}

        <Charge x={charge.x} y={charge.y} sign="+" count={1} r={26} />

        <text className="flux-gauge-label" x={GX + GW / 2} y={GY - 14} textAnchor="middle">
          Net flux
        </text>
        <rect className="flux-gauge-track" x={GX} y={GY} width={GW} height={GH} rx={8} />
        {fillFraction > 0.001 ? (
          <rect
            className={`flux-gauge-fill${revealed ? ' flux-gauge-fill--true' : ''}`}
            x={GX}
            y={fillTop}
            width={GW}
            height={GBOTTOM - fillTop}
            rx={8}
            data-testid="gauss-gauge-fill"
          />
        ) : null}
        {revealed && prediction !== null ? (
          <line className="flux-gauge-guess" x1={GX - 6} y1={handleY} x2={GX + GW + 6} y2={handleY} data-testid="gauss-gauge-guess" />
        ) : null}

        {onPredict && prediction !== null ? (
          <DragHandle
            drag={gaugeDrag}
            label="Your predicted net flux"
            min={0}
            max={100}
            value={Math.round(predFraction * 100)}
            onKeyDown={gaugeKey}
            testId="gauss-gauge-handle"
            x={GX + GW / 2}
            y={handleY}
          >
            <circle className="pot-hit-target" cx={GX + GW / 2} cy={handleY} r={22} />
            <circle className="predict-ring" cx={GX + GW / 2} cy={handleY} r={13} />
          </DragHandle>
        ) : null}
      </svg>
    </div>
  );

  function gaugeKey(event: KeyboardEvent<SVGGElement>) {
    if (!onPredict || prediction === null) return;
    const step = 0.06;
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      onPredict(clamp(prediction + step, 0, 1));
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      onPredict(clamp(prediction - step, 0, 1));
    }
  }
}
