import { Figure, Legend } from '../primitives';
import './Step20_OrderInduction.css';

// Step 20 - "Order the induction steps". The ordering itself happens in the rail
// (the shared Ordering widget); this scene is a static supporting figure. It is a
// compact reference of the three pieces an induction uses: a charged (negative)
// rod, a neutral metal sphere, and a wire to ground. The sphere is drawn neutral
// with its free charges evenly balanced, so the figure names the cast without
// revealing the sequence the learner has to reconstruct.

// Sphere and rod are placed so the whole motif sits centered in the 360-wide
// frame with equal left/right margins (rod left edge and sphere right edge both
// 84px from the edges) and a clear 50px gap between them (never touching).
const SPHERE = { x: 234, y: 98, r: 42 };

// Six free charges evenly spaced on a ring inside the sphere, offsets from its
// center, alternating sign so the conductor reads as balanced (neutral) and is
// never polarized to one side (which would hint at the order).
const RING = [
  { dx: 0, dy: -20, sign: '+' as const },
  { dx: 17, dy: -10, sign: '-' as const },
  { dx: 17, dy: 10, sign: '+' as const },
  { dx: 0, dy: 20, sign: '-' as const },
  { dx: -17, dy: 10, sign: '+' as const },
  { dx: -17, dy: -10, sign: '-' as const },
];

// Negative rod held to the left, clearly clear of the sphere (never touching).
const ROD = { cx: 113, cy: 98, w: 58, h: 26 };
const ROD_SIGN_DX = [-16, 0, 16];

// Ground: a short wire dropping from the bottom of the sphere to an earth symbol.
const WIRE_TOP = SPHERE.y + SPHERE.r;
const WIRE_BOTTOM = 166;
const GROUND_LINES = [
  { y: 166, half: 17 },
  { y: 171, half: 11 },
  { y: 176, half: 5 },
];

function Dot({ x, y, sign }: { x: number; y: number; sign: '+' | '-' }) {
  const tone = sign === '+' ? 'positive' : 'negative';
  return (
    <g>
      <circle className={`charge-circle charge-circle-${tone} cci-20-dot`} cx={x} cy={y} r={7} />
      <text className="cci-20-sign" x={x} y={y}>
        {sign === '+' ? '+' : '\u2212'}
      </text>
    </g>
  );
}

export function Step20_OrderInduction() {
  return (
    <>
      <Figure>
        <text className="cci-20-title" x={SPHERE.x} y={46}>
          metal sphere
        </text>

        <g data-testid="cci-20-sphere" data-charge="neutral">
          <circle className="cci-20-sphere-body" cx={SPHERE.x} cy={SPHERE.y} r={SPHERE.r} />
          {RING.map((charge) => (
            <Dot
              key={`${charge.dx}-${charge.dy}`}
              x={SPHERE.x + charge.dx}
              y={SPHERE.y + charge.dy}
              sign={charge.sign}
            />
          ))}
        </g>

        <g className="cci-20-ground">
          <path className="cci-20-wire" d={`M${SPHERE.x},${WIRE_TOP} V${WIRE_BOTTOM}`} />
          {GROUND_LINES.map((line) => (
            <line key={line.y} x1={SPHERE.x - line.half} x2={SPHERE.x + line.half} y1={line.y} y2={line.y} />
          ))}
          <text className="cci-20-label" x={SPHERE.x} y={192}>
            ground
          </text>
        </g>

        <g className="cci-20-rod-group">
          <rect
            className="cci-20-rod"
            x={ROD.cx - ROD.w / 2}
            y={ROD.cy - ROD.h / 2}
            width={ROD.w}
            height={ROD.h}
            rx={ROD.h / 2}
          />
          {ROD_SIGN_DX.map((dx) => (
            <text key={dx} className="cci-20-rod-sign" x={ROD.cx + dx} y={ROD.cy}>
              {'\u2212'}
            </text>
          ))}
          <text className="cci-20-rod-label" x={ROD.cx} y={132}>
            charged rod
          </text>
        </g>
      </Figure>

      <Legend text="The pieces of an induction setup: a charged rod, a neutral metal sphere, and a wire to ground. Put the four moves in order on the right." />
    </>
  );
}
