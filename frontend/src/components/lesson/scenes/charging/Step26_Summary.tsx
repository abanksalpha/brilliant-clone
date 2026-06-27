import { Figure, Legend } from '../primitives';
import './Step26_Summary.css';

// Step 26 (concept) - the bookend. The opening sticky-balloon scene returns,
// reusing the Step 1 balloon/wall language so it reads as the same picture, now
// annotated with the wall's surface molecules polarized to face the balloon: each
// molecule's positive core is nudged toward the balloon and its electrons pushed
// into the wall, so the closer, opposite charge pulls the balloon in. The hook is
// resolved.

const WALL_X = 232;

// The same flattened balloon path used in Step 1, pressed against the wall.
const BALLOON_PATH = [
  'M 172 32',
  'C 206 32 231 50 231 76',
  'L 231 124',
  'C 231 150 202 166 166 166',
  'C 132 166 108 140 112 104',
  'C 114 64 138 32 172 32',
  'Z',
].join(' ');

// Negative charge marks on the balloon, weighted toward the wall-facing side.
const CHARGES: Array<[number, number]> = [
  [176, 86],
  [210, 82],
  [192, 110],
  [214, 120],
  [184, 136],
];

// Engineering-style hatch ticks along the inside (solid) face of the wall.
const HATCHES = [40, 64, 88, 112, 136, 160, 184];

// Surface molecules along the balloon's flat contact face. Polarized so the
// positive core faces the balloon (left) and the electrons sit deeper (right).
const MOL_CX = 247;
const MOLECULES = [76, 92, 108, 124];

export function Step26_Summary() {
  return (
    <>
      <Figure>
        <g className="cci-26-scene">
          <line className="cci-26-floor" x1={80} x2={300} y1={198} y2={198} />

          <g className="cci-26-wall" data-testid="cci-26-wall">
            <line className="cci-26-wall-surface" x1={WALL_X} x2={WALL_X} y1={24} y2={198} />
            {HATCHES.map((y) => (
              <line
                className="cci-26-hatch"
                key={y}
                x1={WALL_X}
                x2={WALL_X + 14}
                y1={y}
                y2={y + 14}
              />
            ))}
            <text
              className="cci-26-wall-label"
              data-testid="cci-26-wall-label"
              x={284}
              y={108}
              textAnchor="middle"
              dominantBaseline="central"
              transform="rotate(-90 284 108)"
            >
              neutral
            </text>
          </g>

          <path className="cci-26-string" d="M166 178 q 13 13 -2 22" fill="none" />

          <path className="cci-26-balloon" data-testid="cci-26-balloon" d={BALLOON_PATH} />
          <polygon className="cci-26-knot" points="166,166 160,178 172,178" />

          {CHARGES.map(([x, y]) => (
            <text
              className="cci-26-charge"
              key={`${x}-${y}`}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
            >
              -
            </text>
          ))}

          <g className="cci-26-molecules" data-testid="cci-26-molecules">
            {MOLECULES.map((y) => (
              <g key={y}>
                <ellipse className="cci-26-molecule" cx={MOL_CX} cy={y} rx={13} ry={7} />
                <text
                  className="cci-26-mol-plus"
                  x={MOL_CX - 6}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  +
                </text>
                <text
                  className="cci-26-mol-minus"
                  x={MOL_CX + 6}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  -
                </text>
              </g>
            ))}
          </g>
        </g>
      </Figure>
      <Legend text="The balloon polarizes the wall's surface molecules, turning their plus side to face it. Now the opposite charge is closer, so the wall pulls back and the balloon sticks." />
    </>
  );
}
