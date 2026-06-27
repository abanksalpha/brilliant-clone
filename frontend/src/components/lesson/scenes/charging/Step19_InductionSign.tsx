import { Charge, Figure, Legend } from '../primitives';
import './Step19_InductionSign.css';

// Step 19 (multiple-choice) - a static supporting figure; the rail holds the
// choices. It draws a before/after pair that answers "what sign after
// induction?": a negative rod held near a grounded conductor (before), then the
// same conductor left net POSITIVE, the opposite sign, once the rod and the
// ground have been removed (after). Charges reuse the shared Charge primitive so
// they match the Coulomb scenes and the step 18 induction animation.

const SPHERE_R = 27;
const MARK_R = 10;

// Before half: rod on the left, conductor centre, ground dropping below it.
const BEFORE = { cx: 96, cy: 102 };
const ROD = { cx: 26, top: 64, h: 80, w: 24 };
const GROUND = { x: 106, top: 127, bottom: 168 };

// After half: the isolated, positively charged conductor.
const AFTER = { cx: 266, cy: 102 };

function Earth({ x, y }: { x: number; y: number }) {
  return (
    <g className="cci-19-ground" data-testid="cci-19-ground">
      <path className="cci-19-wire" d={`M${x},${GROUND.top} V${y}`} />
      <line x1={x - 13} x2={x + 13} y1={y} y2={y} />
      <line x1={x - 8} x2={x + 8} y1={y + 6} y2={y + 6} />
      <line x1={x - 3} x2={x + 3} y1={y + 12} y2={y + 12} />
      <text className="cci-19-tag" x={x} y={y + 28}>
        ground
      </text>
    </g>
  );
}

export function Step19_InductionSign() {
  return (
    <>
      <Figure>
        <text className="cci-19-head" data-testid="cci-19-head-before" x={BEFORE.cx} y={34}>
          Before
        </text>
        <text className="cci-19-head" data-testid="cci-19-head-after" x={AFTER.cx} y={34}>
          After
        </text>

        {/* Before: negative rod held near a grounded conductor. */}
        <g data-testid="cci-19-before">
          <circle
            className="cci-19-sphere-body"
            cx={BEFORE.cx}
            cy={BEFORE.cy}
            r={SPHERE_R}
          />
          {/* Near side left positive as the rod drives its electrons out. */}
          <Charge x={BEFORE.cx - 16} y={BEFORE.cy - 4} sign="+" r={MARK_R} />

          <Earth x={GROUND.x} y={GROUND.bottom} />
          {/* One repelled electron draining down the wire to earth. */}
          <Charge x={GROUND.x} y={146} sign="-" r={9} muted />

          <g data-testid="cci-19-rod" data-sign="negative">
            <rect
              className="cci-19-rod"
              x={ROD.cx - ROD.w / 2}
              y={ROD.top}
              width={ROD.w}
              height={ROD.h}
              rx={ROD.w / 2}
            />
            <Charge x={ROD.cx} y={ROD.top + 18} sign="-" r={MARK_R} />
            <Charge x={ROD.cx} y={ROD.top + 40} sign="-" r={MARK_R} />
            <Charge x={ROD.cx} y={ROD.top + 62} sign="-" r={MARK_R} />
            <text className="cci-19-tag" x={ROD.cx} y={ROD.top + ROD.h + 16}>
              rod
            </text>
          </g>
        </g>

        {/* Process arrow: remove the rod and the ground. */}
        <g>
          <line className="cci-19-flow" x1={160} x2={195} y1={BEFORE.cy} y2={BEFORE.cy} />
          <polygon
            className="cci-19-flow-head"
            points={`202,${BEFORE.cy} 193,${BEFORE.cy - 5} 193,${BEFORE.cy + 5}`}
          />
          <text className="cci-19-caption" x={181} y={BEFORE.cy + 22}>
            remove both
          </text>
        </g>

        {/* After: the conductor alone, left net positive (the opposite sign). */}
        <g data-testid="cci-19-after" data-charge="positive">
          <circle className="cci-19-sphere-body" cx={AFTER.cx} cy={AFTER.cy} r={SPHERE_R} />
          <circle className="cci-19-pos" cx={AFTER.cx} cy={AFTER.cy} r={SPHERE_R - 2} opacity={0.5} />
          <circle className="cci-19-ring" cx={AFTER.cx} cy={AFTER.cy} r={SPHERE_R + 5} />
          <Charge x={AFTER.cx - 16} y={AFTER.cy - 8} sign="+" r={MARK_R} />
          <Charge x={AFTER.cx + 16} y={AFTER.cy - 8} sign="+" r={MARK_R} />
          <Charge x={AFTER.cx} y={AFTER.cy + 14} sign="+" r={MARK_R} />
          <text
            className="cci-19-status cci-19-status--pos"
            data-testid="cci-19-result"
            x={AFTER.cx}
            y={AFTER.cy + 58}
          >
            Positive
          </text>
        </g>
      </Figure>
      <Legend text="The negative rod drives the conductor's electrons out through the ground. Take the ground away, then the rod, and the conductor is left positive, the opposite sign." />
    </>
  );
}
