import { Figure, Legend } from '../primitives';
import './Step05_ClassifyMaterials.css';

// Step 5 (multiple-choice) - a static supporting figure. The rail shows the
// choices ("A copper wire", "A rubber balloon", "A glass rod"); this scene just
// draws the three candidate objects, clearly labeled, on the hand-drawn theme.
// Three columns evenly spaced on the shared 360x220 grid.
const COL = { copper: 60, rubber: 180, glass: 300 };
const LABEL_Y = 178;

// A bent length of copper wire: one stroke sweeps right then left so it reads as
// a real cable, with a thin highlight ridge for sheen. Centered on the column.
const WIRE_PATH = 'M 52 50 C 88 62 80 86 54 96 C 30 105 34 130 70 146';

// A teardrop rubber balloon, narrowing to the knot at the bottom (Step 1 shape
// language, re-centered and a touch smaller).
const BALLOON_PATH = [
  'M 180 40',
  'C 210 40 218 64 218 86',
  'C 218 112 200 130 180 138',
  'C 160 130 142 112 142 86',
  'C 142 64 150 40 180 40',
  'Z',
].join(' ');

export function Step05_ClassifyMaterials() {
  return (
    <>
      <Figure>
        <g className="cci-05-scene">
          <g data-testid="cci-05-copper" aria-label="A copper wire">
            <path className="cci-05-wire" d={WIRE_PATH} fill="none" />
            <path className="cci-05-wire-sheen" d={WIRE_PATH} fill="none" />
            <text
              className="cci-05-label"
              data-testid="cci-05-label-copper"
              x={COL.copper}
              y={LABEL_Y}
              textAnchor="middle"
            >
              Copper wire
            </text>
          </g>

          <g data-testid="cci-05-rubber" aria-label="A rubber balloon">
            <path className="cci-05-balloon" d={BALLOON_PATH} />
            <ellipse
              className="cci-05-gloss"
              cx={166}
              cy={70}
              rx={7}
              ry={11}
              transform="rotate(-22 166 70)"
            />
            <polygon className="cci-05-knot" points="180,150 173,138 187,138" />
            <path className="cci-05-string" d="M 180 150 q 11 12 -3 22" fill="none" />
            <text
              className="cci-05-label"
              data-testid="cci-05-label-rubber"
              x={COL.rubber}
              y={LABEL_Y}
              textAnchor="middle"
            >
              Rubber balloon
            </text>
          </g>

          <g data-testid="cci-05-glass" aria-label="A glass rod">
            <rect className="cci-05-rod" x={291} y={42} width={18} height={108} rx={9} />
            <line className="cci-05-rod-sheen" x1={297} x2={297} y1={56} y2={120} />
            <line className="cci-05-rod-sheen cci-05-rod-sheen--faint" x1={303} x2={303} y1={60} y2={104} />
            <text
              className="cci-05-label"
              data-testid="cci-05-label-glass"
              x={COL.glass}
              y={LABEL_Y}
              textAnchor="middle"
            >
              Glass rod
            </text>
          </g>
        </g>
      </Figure>
      <Legend text="A copper wire, a rubber balloon, and a glass rod. A conductor carries a sea of free electrons; an insulator keeps each one pinned to its atom." />
    </>
  );
}
