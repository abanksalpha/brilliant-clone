import { Figure, Legend } from '../primitives';
import './Step11_AttractOrRepel.css';

// Step 11 (multiple-choice) - a static supporting figure. The rail shows the
// choices (attracted / repelled / nothing); this scene just poses the setup. A
// charged rod, sign deliberately left open (a "±" badge, the prompt says "for
// either sign of rod"), is held near a neutral metal can. A big question mark
// hovers over the can with a faint two-way arrow, because the can could move
// toward the rod or away. The can's charge is drawn balanced and evenly mixed so
// it reads as neutral and gives nothing away; the answer is made in the rail.

const ROD = { cx: 82, cy: 110, w: 18, h: 92 };
const CAN = { cx: 232, top: 80, bottom: 164, halfW: 42, lidRy: 11 };
const CAPTION_Y = 196;

const CAN_BODY = [
  `M ${CAN.cx - CAN.halfW} ${CAN.top}`,
  `L ${CAN.cx - CAN.halfW} ${CAN.bottom}`,
  `A ${CAN.halfW} ${CAN.lidRy} 0 0 0 ${CAN.cx + CAN.halfW} ${CAN.bottom}`,
  `L ${CAN.cx + CAN.halfW} ${CAN.top}`,
  'Z',
].join(' ');

// Equal plus and minus, evenly interleaved (never separated): neutral overall.
const NEUTRAL_MARKS = [
  { x: 216, y: 116, sign: '+' as const },
  { x: 248, y: 116, sign: '-' as const },
  { x: 216, y: 146, sign: '-' as const },
  { x: 248, y: 146, sign: '+' as const },
];

const MAYBE = { y: 60, left: 206, right: 258 };

export function Step11_AttractOrRepel() {
  return (
    <>
      <Figure>
        <text
          className="cci-11-question"
          data-testid="cci-11-question"
          x={CAN.cx}
          y={50}
          textAnchor="middle"
        >
          ?
        </text>

        <g aria-hidden="true">
          <line
            className="cci-11-maybe-line"
            x1={MAYBE.left + 6}
            x2={MAYBE.right - 6}
            y1={MAYBE.y}
            y2={MAYBE.y}
          />
          <polygon
            className="cci-11-maybe-head"
            points={`${MAYBE.left},${MAYBE.y} ${MAYBE.left + 8},${MAYBE.y - 4.5} ${MAYBE.left + 8},${MAYBE.y + 4.5}`}
          />
          <polygon
            className="cci-11-maybe-head"
            points={`${MAYBE.right},${MAYBE.y} ${MAYBE.right - 8},${MAYBE.y - 4.5} ${MAYBE.right - 8},${MAYBE.y + 4.5}`}
          />
        </g>

        <g data-testid="cci-11-can">
          <path className="cci-11-can" d={CAN_BODY} />
          <ellipse
            className="cci-11-can-lid"
            cx={CAN.cx}
            cy={CAN.top}
            rx={CAN.halfW}
            ry={CAN.lidRy}
          />
          <line
            className="cci-11-can-sheen"
            x1={CAN.cx - 30}
            x2={CAN.cx - 30}
            y1={CAN.top + 16}
            y2={CAN.bottom - 12}
          />
          <line
            className="cci-11-can-sheen cci-11-can-sheen--faint"
            x1={CAN.cx - 22}
            x2={CAN.cx - 22}
            y1={CAN.top + 20}
            y2={CAN.bottom - 18}
          />

          <g className="cci-11-neutral-marks">
            {NEUTRAL_MARKS.map((mark) =>
              mark.sign === '+' ? (
                <text
                  key={`${mark.x}-${mark.y}`}
                  className="cci-11-plus-mark"
                  x={mark.x}
                  y={mark.y}
                  dy="0.32em"
                  textAnchor="middle"
                >
                  +
                </text>
              ) : (
                <circle
                  key={`${mark.x}-${mark.y}`}
                  className="cci-11-electron"
                  cx={mark.x}
                  cy={mark.y}
                  r={6}
                />
              ),
            )}
          </g>

          <text
            className="cci-11-caption"
            data-testid="cci-11-can-label"
            x={CAN.cx}
            y={CAPTION_Y}
            textAnchor="middle"
          >
            neutral can
          </text>
        </g>

        <g data-testid="cci-11-rod">
          <rect
            className="cci-11-rod"
            x={ROD.cx - ROD.w / 2}
            y={ROD.cy - ROD.h / 2}
            width={ROD.w}
            height={ROD.h}
            rx={8}
          />
          <text
            className="cci-11-rod-sign"
            data-testid="cci-11-rod-sign"
            x={ROD.cx}
            y={ROD.cy}
            dy="0.32em"
            textAnchor="middle"
          >
            &#177;
          </text>
          <text
            className="cci-11-caption"
            data-testid="cci-11-rod-label"
            x={ROD.cx}
            y={CAPTION_Y}
            textAnchor="middle"
          >
            charged rod
          </text>
        </g>
      </Figure>
      <Legend text="A charged rod, either sign, held near a neutral metal can. Attract or repel?" />
    </>
  );
}
