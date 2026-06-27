import { Figure, Legend } from '../primitives';
import './Step17_InductionTrick.css';

// Step 17 (concept) - the induction trick. A static teaser that sets up the
// staged induction animation in Step 18: a negative rod is held near a metal
// sphere that already has a ground wire, with a clear gap so the rod never
// touches. A faint, ghosted plus inside a dashed ring (and a muted label) hints
// at the payoff - induction leaves the sphere the opposite sign, positive -
// without spelling out the ordered moves, which the next step demonstrates.

const SPHERE = { cx: 184, cy: 90, r: 48 };

// Negative rod parked to the left with a wide gap from the sphere (never touching).
const ROD = { x: 51, y: 54, w: 18, h: 72 };
const ROD_CX = ROD.x + ROD.w / 2;
const ROD_CY = ROD.y + ROD.h / 2;
const ROD_MINUS = [-20, 0, 20];

// Ground wire: straight down from the bottom of the sphere to an earth symbol.
const WIRE_TOP = { x: SPHERE.cx, y: SPHERE.cy + SPHERE.r };
const WIRE_BOTTOM = { x: SPHERE.cx, y: 170 };
const GROUND_BARS = [
  { y: 170, half: 18 },
  { y: 176, half: 11 },
  { y: 182, half: 5 },
];

export function Step17_InductionTrick() {
  return (
    <>
      <Figure>
        <g data-testid="cci-17-ground" className="cci-17-ground">
          <path className="cci-17-wire" d={`M${WIRE_TOP.x},${WIRE_TOP.y} V${WIRE_BOTTOM.y}`} />
          {GROUND_BARS.map((bar) => (
            <line key={bar.y} x1={SPHERE.cx - bar.half} x2={SPHERE.cx + bar.half} y1={bar.y} y2={bar.y} />
          ))}
          <text className="cci-17-caption" x={SPHERE.cx} y={200} textAnchor="middle">
            to ground
          </text>
        </g>

        <circle
          className="cci-17-sphere"
          data-testid="cci-17-sphere"
          cx={SPHERE.cx}
          cy={SPHERE.cy}
          r={SPHERE.r}
        />
        <ellipse
          className="cci-17-sphere-sheen"
          cx={SPHERE.cx - 20}
          cy={SPHERE.cy - 22}
          rx={17}
          ry={10}
        />

        <g data-testid="cci-17-hint">
          <circle className="cci-17-hint-ring" cx={SPHERE.cx} cy={SPHERE.cy} r={28} />
          <text className="cci-17-hint-sign" x={SPHERE.cx} y={SPHERE.cy}>
            +
          </text>
          <path className="cci-17-hint-connector" d="M206,73 Q232,57 248,59" />
          <text className="cci-17-hint-label" x={294} y={56}>
            ends up positive
          </text>
        </g>

        <g className="cci-17-rod-group">
          <rect
            className="cci-17-rod"
            data-testid="cci-17-rod"
            x={ROD.x}
            y={ROD.y}
            width={ROD.w}
            height={ROD.h}
            rx={9}
          />
          {ROD_MINUS.map((offset) => (
            <rect
              key={offset}
              className="cci-17-rod-minus"
              x={ROD_CX - 4.5}
              y={ROD_CY + offset - 1.5}
              width={9}
              height={3}
              rx={1.5}
            />
          ))}
          <text className="cci-17-caption" x={ROD_CX} y={144} textAnchor="middle">
            negative rod
          </text>
        </g>
      </Figure>
      <Legend text="A negative rod held near a grounded metal sphere, never touching it. The faint plus hints how induction leaves the sphere positive, the opposite sign." />
    </>
  );
}
