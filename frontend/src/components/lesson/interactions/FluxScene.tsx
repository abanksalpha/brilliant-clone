import { type KeyboardEvent } from 'react';
import { DragHandle, clamp, usePointerDrag } from '../scenes/primitives';
import { type Point } from './TwoChargeField';

// Uniform field drawn as evenly spaced horizontal lines on the left, a surface in
// the middle, and a flux gauge on the right.
const FIELD_X0 = 44;
const FIELD_X1 = 540;
const LINE_YS = [70, 110, 150, 190, 230, 270, 310];
const CX = 292;
const CY = 190;
const PLATE = 260;
const BOX_W = 120;
const BOX_H = 200;
// Flux gauge (a vertical bar): fraction 0 at the bottom, 1 at the top.
const GX = 628;
const GW = 48;
const GY = 70;
const GH = 240;
const GBOTTOM = GY + GH;
const HEAD = 9;
// The drawn content spans x 44..682 (field lines to the gauge's guess marker) and
// y ~32..320 (the "Flux" label down to a face-on plate). Frame the viewBox to that
// box so the field, surface, and gauge sit centered with equal margins instead of
// floating left in the wider two-charge field space this scene used to borrow.
const VIEW_W = 726;
const VIEW_H = 352;

function deg2rad(d: number): number {
  return (d * Math.PI) / 180;
}

// A surface in a uniform field. In the predict stage the learner drags the gauge to
// guess the flux; the reveal highlights the field lines that cross the surface, tilts
// the plate to its angle (or marks the closed box's in and out faces), and fills the
// gauge to the true value.
export function FluxScene({
  surface,
  plateTilt,
  revealed,
  trueFraction,
  prediction,
  onPredict,
}: {
  surface: 'plate' | 'box';
  plateTilt: number;
  revealed: boolean;
  trueFraction: number;
  prediction: number | null;
  onPredict?: (fraction: number) => void;
}) {
  const gaugeDrag = usePointerDrag(
    (pt) => onPredict?.(clamp((GBOTTOM - pt.y) / GH, 0, 1)),
    () => ({ x: GX + GW / 2, y: GBOTTOM - (prediction ?? 0) * GH }),
  );

  // Which field lines cross the surface (so they can be highlighted on reveal).
  const plateHalfExtent = (PLATE * Math.cos(deg2rad(plateTilt))) / 2;
  const crosses = (y: number): boolean =>
    surface === 'box' ? Math.abs(y - CY) <= BOX_H / 2 : Math.abs(y - CY) <= plateHalfExtent + 0.5;

  // Plate endpoints: face-on (tilt 0) is vertical, perpendicular to the field.
  const theta = deg2rad(plateTilt);
  const half = PLATE / 2;
  const plateTop: Point = { x: CX - half * Math.sin(theta), y: CY - half * Math.cos(theta) };
  const plateBottom: Point = { x: CX + half * Math.sin(theta), y: CY + half * Math.cos(theta) };

  const predFraction = prediction ?? 0;
  const fillFraction = revealed ? trueFraction : predFraction;
  const fillTop = GBOTTOM - fillFraction * GH;
  const handleY = GBOTTOM - predFraction * GH;

  return (
    <div className="cl1-figure" data-testid="flux-scene">
      <svg viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="xMidYMid meet">
        {LINE_YS.map((y) => {
          const active = revealed && crosses(y);
          const dim = revealed && !crosses(y);
          const cls = `flux-line${active ? ' flux-line--active' : ''}${dim ? ' flux-line--dim' : ''}`;
          return (
            <g key={y} className={cls} data-testid={active ? 'flux-line-active' : undefined}>
              <line x1={FIELD_X0} y1={y} x2={FIELD_X1} y2={y} />
              <polygon points={`${FIELD_X1},${y} ${FIELD_X1 - HEAD},${y - HEAD * 0.6} ${FIELD_X1 - HEAD},${y + HEAD * 0.6}`} />
            </g>
          );
        })}

        {surface === 'plate' ? (
          <line
            className="flux-plate"
            x1={plateTop.x}
            y1={plateTop.y}
            x2={plateBottom.x}
            y2={plateBottom.y}
            data-testid="flux-plate"
          />
        ) : (
          <g data-testid="flux-box">
            <rect className="flux-box" x={CX - BOX_W / 2} y={CY - BOX_H / 2} width={BOX_W} height={BOX_H} rx={6} />
            {revealed ? (
              <>
                <line className="flux-face flux-face--in" x1={CX - BOX_W / 2} y1={CY - BOX_H / 2} x2={CX - BOX_W / 2} y2={CY + BOX_H / 2} />
                <line className="flux-face flux-face--out" x1={CX + BOX_W / 2} y1={CY - BOX_H / 2} x2={CX + BOX_W / 2} y2={CY + BOX_H / 2} />
              </>
            ) : null}
          </g>
        )}

        <text className="flux-gauge-label" x={GX + GW / 2} y={GY - 14} textAnchor="middle">
          Flux
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
            data-testid="flux-gauge-fill"
          />
        ) : null}
        {revealed && prediction !== null ? (
          <line className="flux-gauge-guess" x1={GX - 6} y1={handleY} x2={GX + GW + 6} y2={handleY} data-testid="flux-gauge-guess" />
        ) : null}

        {onPredict && prediction !== null ? (
          <DragHandle
            drag={gaugeDrag}
            label="Your predicted flux"
            min={0}
            max={100}
            value={Math.round(predFraction * 100)}
            onKeyDown={gaugeKey}
            testId="flux-gauge-handle"
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
