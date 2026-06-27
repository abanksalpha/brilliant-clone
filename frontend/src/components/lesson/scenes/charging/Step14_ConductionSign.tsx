import type { ReactNode } from 'react';
import { Arrow, Charge, Figure, Legend } from '../primitives';
import './Step14_ConductionSign.css';

// Step 14 (multiple-choice) - a static supporting figure. The rail shows the
// choices ("same sign", "opposite sign", "no net charge"); this scene draws a
// before/after pair that proves charging by conduction leaves the SAME sign:
//   before: a negative object touches a neutral one (tangent, in contact),
//   after:  the pair pulled apart, both now negative.
// Charge glyphs and the transition arrow reuse the shared primitives so the
// figure matches the Coulomb and "Share the charge" (Step 25) scenes.

const R = 20;
const CY = 112;
const STATE_LABEL_Y = 54;
const CAPTION_Y = 170;

// Before: a charged (negative) object tangent to a neutral one (centers 2R apart
// so they read as touching).
const BEFORE_NEG_X = 64;
const BEFORE_NEUTRAL_X = BEFORE_NEG_X + R * 2;
const BEFORE_CENTER_X = (BEFORE_NEG_X + BEFORE_NEUTRAL_X) / 2;

// After: the same pair pulled apart, both ending negative.
const AFTER_LEFT_X = 242;
const AFTER_RIGHT_X = 296;
const AFTER_CENTER_X = (AFTER_LEFT_X + AFTER_RIGHT_X) / 2;

// The transition arrow sits centered in the gap between the two groups.
const ARROW_X1 = 150;
const ARROW_X2 = 196;

function SignedCharge({
  sign,
  x,
  testId,
}: {
  sign: '-' | 'neutral';
  x: number;
  testId: string;
}) {
  return (
    <g data-testid="cci-14-charge" data-sign={sign === '-' ? 'negative' : 'neutral'} data-role={testId}>
      <Charge x={x} y={CY} sign={sign} r={R} />
    </g>
  );
}

function Group({ children, testId }: { children: ReactNode; testId: string }) {
  return <g data-testid={testId}>{children}</g>;
}

export function Step14_ConductionSign() {
  return (
    <>
      <Figure>
        <Group testId="cci-14-before">
          <text className="cci-14-state" x={BEFORE_CENTER_X} y={STATE_LABEL_Y} textAnchor="middle">
            before
          </text>
          <SignedCharge sign="-" x={BEFORE_NEG_X} testId="before-charged" />
          <SignedCharge sign="neutral" x={BEFORE_NEUTRAL_X} testId="before-neutral" />
          <text className="cci-14-cap" x={BEFORE_CENTER_X} y={CAPTION_Y} textAnchor="middle">
            in contact
          </text>
        </Group>

        <g className="cci-14-flow">
          <Arrow x1={ARROW_X1} x2={ARROW_X2} y1={CY} y2={CY} />
        </g>

        <Group testId="cci-14-after">
          <text className="cci-14-state" x={AFTER_CENTER_X} y={STATE_LABEL_Y} textAnchor="middle">
            after
          </text>
          <SignedCharge sign="-" x={AFTER_LEFT_X} testId="after-left" />
          <SignedCharge sign="-" x={AFTER_RIGHT_X} testId="after-right" />
          <text
            className="cci-14-cap cci-14-cap--same"
            x={AFTER_CENTER_X}
            y={CAPTION_Y}
            textAnchor="middle"
          >
            same sign
          </text>
        </Group>
      </Figure>
      <Legend text="A negative object touches a neutral one. On contact they share charge of the same sign, so both end up negative. Conduction leaves the same sign." />
    </>
  );
}
