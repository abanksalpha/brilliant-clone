import { Figure, Legend } from '../primitives';
import './Step01_StickyBalloon.css';

// Step 1 (concept) - the everyday puzzle: a charged balloon clings flat to a
// neutral wall. Static, hand-drawn figure matching the Coulomb HookScene.

const WALL_X = 232;

// A balloon shaped like the Coulomb hook balloon but squashed flat where it
// presses against the wall on the right.
const BALLOON_PATH = [
  'M 172 32',
  'C 206 32 231 50 231 76',
  'L 231 124',
  'C 231 150 202 166 166 166',
  'C 132 166 108 140 112 104',
  'C 114 64 138 32 172 32',
  'Z',
].join(' ');

// Small negative charge marks, spread over the balloon, weighted toward the
// wall-facing side that does the clinging.
const CHARGES: Array<[number, number]> = [
  [176, 86],
  [210, 82],
  [192, 110],
  [214, 120],
  [184, 136],
];

// Engineering-style hatch ticks along the inside (solid) face of the wall.
const HATCHES = [40, 64, 88, 112, 136, 160, 184];

export function Step01_StickyBalloon() {
  return (
    <>
      <Figure>
        <g className="cci-01-scene">
          <line className="cci-01-floor" x1={80} x2={300} y1={198} y2={198} />

          <g className="cci-01-wall" data-testid="cci-01-wall">
            <line className="cci-01-wall-surface" x1={WALL_X} x2={WALL_X} y1={24} y2={198} />
            {HATCHES.map((y) => (
              <line
                className="cci-01-hatch"
                key={y}
                x1={WALL_X}
                x2={WALL_X + 14}
                y1={y}
                y2={y + 14}
              />
            ))}
            <text
              className="cci-01-wall-label"
              data-testid="cci-01-wall-label"
              x={276}
              y={108}
              textAnchor="middle"
              dominantBaseline="central"
              transform="rotate(-90 276 108)"
            >
              neutral
            </text>
          </g>

          <path className="cci-01-string" d="M166 178 q 13 13 -2 22" fill="none" />

          <path className="cci-01-balloon" data-testid="cci-01-balloon" d={BALLOON_PATH} />
          <polygon className="cci-01-knot" points="166,166 160,178 172,178" />

          {CHARGES.map(([x, y]) => (
            <text
              className="cci-01-charge"
              key={`${x}-${y}`}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
            >
              -
            </text>
          ))}
        </g>
      </Figure>
      <Legend text="A charged balloon clings flat to a neutral wall. With equal plus and minus charge, how can the wall pull back?" />
    </>
  );
}
