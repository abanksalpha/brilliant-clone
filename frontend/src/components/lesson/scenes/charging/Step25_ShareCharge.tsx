import { Arrow, Charge, Figure, Legend } from '../primitives';
import './Step25_ShareCharge.css';

// Supporting visual for the numeric step "Share the charge". Static figure:
// a charged metal sphere (Q) touching an identical neutral sphere, a short
// transition arrow, then the two spheres pulled apart with Q/2 on each. The
// rail shows the numeric input; this scene only illustrates the split.

const R = 20;
const CY = 116;
const STATE_LABEL_Y = 52;
const MAGNITUDE_Y = 176;

// Before: the charged sphere is tangent to the neutral one (centers 2R apart).
const BEFORE_LEFT_X = 58;
const BEFORE_RIGHT_X = BEFORE_LEFT_X + R * 2;

// After: the same pair pulled apart, charge shared equally.
const AFTER_LEFT_X = 226;
const AFTER_RIGHT_X = 304;

// The transition arrow sits centered in the gap between the two groups.
const ARROW_X1 = 138;
const ARROW_X2 = 186;

const BEFORE_CENTER_X = (BEFORE_LEFT_X + BEFORE_RIGHT_X) / 2;
const AFTER_CENTER_X = (AFTER_LEFT_X + AFTER_RIGHT_X) / 2;

export function Step25_ShareCharge() {
  return (
    <>
      <Figure>
        <text className="cci-25-state" x={BEFORE_CENTER_X} y={STATE_LABEL_Y} textAnchor="middle">
          touching
        </text>
        <text className="cci-25-state" x={AFTER_CENTER_X} y={STATE_LABEL_Y} textAnchor="middle">
          separated
        </text>

        <Charge x={BEFORE_LEFT_X} y={CY} sign="+" r={R} />
        <Charge x={BEFORE_RIGHT_X} y={CY} sign="neutral" r={R} />
        <text className="cci-25-mag" x={BEFORE_LEFT_X} y={MAGNITUDE_Y} textAnchor="middle">
          Q
        </text>
        <text
          className="cci-25-mag cci-25-mag--muted"
          x={BEFORE_RIGHT_X}
          y={MAGNITUDE_Y}
          textAnchor="middle"
        >
          neutral
        </text>

        <g className="cci-25-flow">
          <Arrow x1={ARROW_X1} x2={ARROW_X2} y1={CY} y2={CY} />
        </g>

        <Charge x={AFTER_LEFT_X} y={CY} sign="+" r={R} />
        <Charge x={AFTER_RIGHT_X} y={CY} sign="+" r={R} />
        <text className="cci-25-mag" x={AFTER_LEFT_X} y={MAGNITUDE_Y} textAnchor="middle">
          Q/2
        </text>
        <text className="cci-25-mag" x={AFTER_RIGHT_X} y={MAGNITUDE_Y} textAnchor="middle">
          Q/2
        </text>
      </Figure>
      <Legend text="Two identical metal spheres touch, so charge flows until they match. The original charge splits evenly, leaving Q/2 on each once you pull them apart." />
    </>
  );
}
