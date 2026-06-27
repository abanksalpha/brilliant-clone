import { Figure, Legend } from '../primitives';
import './Step15_Grounding.css';

// Step 15 (concept) - grounding. A charged metal sphere (holding a few excess
// electrons) is joined by a conducting wire that runs straight down to a standard
// earth-ground symbol. Electrons ride the wire, and a double-headed arrow beside
// it shows the flow goes either way: off into the ground, or up out of it,
// whichever the situation calls for. The figure is fully static; the rail carries
// the concept body.

const SPHERE = { cx: 180, cy: 54, r: 40 };

// Excess electrons sit low in the sphere, toward the wire, so they read as charge
// ready to move. They stay well inside the sphere radius.
const SPHERE_ELECTRONS = [
  { cx: 164, cy: 58 },
  { cx: 180, cy: 52 },
  { cx: 196, cy: 58 },
  { cx: 172, cy: 72 },
  { cx: 188, cy: 72 },
];

// The wire drops from the sphere's bottom edge to the top bar of the ground symbol.
const WIRE = { x: SPHERE.cx, top: SPHERE.cy + SPHERE.r, bottom: 160 };

// Electrons strung along the wire between the sphere and the ground.
const WIRE_ELECTRONS = [104, 122, 140].map((cy) => ({ cx: WIRE.x, cy }));

// Standard earth-ground symbol: three horizontal bars, widest on top, centered on
// the wire and shrinking as they descend.
const GROUND_BARS = [
  { y: 160, half: 26 },
  { y: 169, half: 17 },
  { y: 178, half: 9 },
];

// Two-way flow arrow, parked just right of the wire and clear of the electrons.
const FLOW = { x: 206, top: 104, bottom: 140, headW: 4, headH: 8 };

export function Step15_Grounding() {
  return (
    <>
      <Figure>
        <line
          className="cci-15-wire"
          data-testid="cci-15-wire"
          x1={WIRE.x}
          y1={WIRE.top}
          x2={WIRE.x}
          y2={WIRE.bottom}
        />

        <circle
          className="cci-15-sphere"
          data-testid="cci-15-sphere"
          cx={SPHERE.cx}
          cy={SPHERE.cy}
          r={SPHERE.r}
        />
        <circle
          className="cci-15-sphere-charge"
          cx={SPHERE.cx}
          cy={SPHERE.cy}
          r={SPHERE.r - 3}
        />
        <ellipse
          className="cci-15-sphere-sheen"
          cx={SPHERE.cx - 15}
          cy={SPHERE.cy - 18}
          rx={15}
          ry={9}
        />
        {SPHERE_ELECTRONS.map((electron, index) => (
          <circle
            key={`sphere-${index}`}
            className="cl1-electron cci-15-sphere-electron"
            cx={electron.cx}
            cy={electron.cy}
            r={6}
          />
        ))}

        {WIRE_ELECTRONS.map((electron, index) => (
          <circle
            key={`wire-${index}`}
            className="cl1-electron cl1-electron-moving cci-15-wire-electron"
            data-testid="cci-15-wire-electron"
            cx={electron.cx}
            cy={electron.cy}
            r={5.5}
          />
        ))}

        <g aria-hidden="true">
          <line
            className="cci-15-flow"
            x1={FLOW.x}
            y1={FLOW.top + FLOW.headH}
            x2={FLOW.x}
            y2={FLOW.bottom - FLOW.headH}
          />
          <polygon
            className="cci-15-flow-head"
            points={`${FLOW.x},${FLOW.top} ${FLOW.x - FLOW.headW},${FLOW.top + FLOW.headH} ${FLOW.x + FLOW.headW},${FLOW.top + FLOW.headH}`}
          />
          <polygon
            className="cci-15-flow-head"
            points={`${FLOW.x},${FLOW.bottom} ${FLOW.x - FLOW.headW},${FLOW.bottom - FLOW.headH} ${FLOW.x + FLOW.headW},${FLOW.bottom - FLOW.headH}`}
          />
        </g>

        <g className="cci-15-ground" data-testid="cci-15-ground">
          {GROUND_BARS.map((bar) => (
            <line
              key={`bar-${bar.y}`}
              className="cci-15-ground-bar"
              x1={WIRE.x - bar.half}
              y1={bar.y}
              x2={WIRE.x + bar.half}
              y2={bar.y}
            />
          ))}
        </g>

        <text className="cci-15-caption" x={WIRE.x} y={198}>
          earth
        </text>
      </Figure>
      <Legend text="A conducting wire ties the charged sphere to the earth, a reservoir so large it never fills up. Electrons can ride the wire either way, off to the ground or up from it, whichever the situation needs." />
    </>
  );
}
