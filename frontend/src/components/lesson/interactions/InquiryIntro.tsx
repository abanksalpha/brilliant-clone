import type { InquiryIntroScreen } from '../../../content/schema';
import { forceVectorsForPair, magnitude, type Vec2 } from '../physics';
import { Arrow, Charge } from '../scenes/primitives';
import { ARROW_GAP, FIELD, FIELD_CHARGE_R } from './TwoChargeField';

// Two demonstration rows sit symmetrically above and below the field's middle,
// with the charges a little farther apart than the predict screens so the force
// arrows between them have room to read. The rows are spread well clear of the
// midline so each one clears the divider with a generous, unhurried gap
// (44 svg units from each charge edge to the line).
const ROW_TOP = 116;
const ROW_BOTTOM = 264;
const LEFT_X = 285;
const RIGHT_X = 475;
// A hairline sits at the vertical midpoint between the two rows so the attract pair
// and the repel pair read as two separate scenes, not one. It is centered on the
// figure and runs as a long section rule spanning most of the figure width (~79%),
// leaving only a small symmetric margin at each edge, so it decisively divides the
// two scenes rather than merely bracketing the charges.
const DIVIDER_Y = (ROW_TOP + ROW_BOTTOM) / 2;
const FIGURE_CENTER_X = (LEFT_X + RIGHT_X) / 2;
const DIVIDER_HALF_WIDTH = 300;
const DIVIDER_X1 = FIGURE_CENTER_X - DIVIDER_HALF_WIDTH;
const DIVIDER_X2 = FIGURE_CENTER_X + DIVIDER_HALF_WIDTH;
// A fixed, illustrative arrow length: this slide shows the rule, not a measured
// magnitude. Both charges in a pair carry equal and opposite arrows, and the
// length stays short enough that two inward (attraction) arrows do not overlap.
const ARROW_LEN = 46;
// Match the on-screen arrowhead size to the lesson's other scenes (viewBox 360).
const HEAD_SCALE = FIELD.w / 360;

function signOf(q: number): '+' | '-' | 'neutral' {
  if (q > 0) return '+';
  if (q < 0) return '-';
  return 'neutral';
}

function unit(v: Vec2, fallback: Vec2): Vec2 {
  const m = magnitude(v);
  return m < 1e-9 ? fallback : { x: v.x / m, y: v.y / m };
}

// One demonstration row: a pair of charges with their equal-and-opposite force
// arrows. Opposite charges pull inward (attract); like charges push outward
// (repel). Arrows are drawn first so the charges sit on top of the tails.
function ChargePairRow({ y, leftQ, rightQ, testId }: { y: number; leftQ: number; rightQ: number; testId: string }) {
  const forces = forceVectorsForPair({ x: LEFT_X, y, q: leftQ }, { x: RIGHT_X, y, q: rightQ });
  const leftU = unit(forces.onLeft, { x: -1, y: 0 });
  const rightU = unit(forces.onRight, { x: 1, y: 0 });

  const arrow = (cx: number, u: Vec2) => {
    const tailX = cx + u.x * (FIELD_CHARGE_R + ARROW_GAP);
    const tailY = y + u.y * (FIELD_CHARGE_R + ARROW_GAP);
    return (
      <Arrow x1={tailX} y1={tailY} x2={tailX + u.x * ARROW_LEN} y2={tailY + u.y * ARROW_LEN} tone="net" headScale={HEAD_SCALE} />
    );
  };

  return (
    <g data-testid={testId}>
      {arrow(LEFT_X, leftU)}
      {arrow(RIGHT_X, rightU)}
      <Charge x={LEFT_X} y={y} sign={signOf(leftQ)} count={Math.abs(leftQ)} r={FIELD_CHARGE_R} />
      <Charge x={RIGHT_X} y={y} sign={signOf(rightQ)} count={Math.abs(rightQ)} r={FIELD_CHARGE_R} />
    </g>
  );
}

// A read-and-continue orientation slide: it shows two pairs of charges with their
// force arrows (opposite charges attracting, like charges repelling) beside a
// short body, so a first-time learner meets the idea of charge before the
// prediction screens begin.
export function InquiryIntro({ screen, onComplete }: { screen: InquiryIntroScreen; onComplete: () => void }) {
  return (
    <article className="lesson-experience cl1-experience inquiry-scene" data-testid={`inquiry-scene-${screen.id}`}>
      <section className="lesson-visual cl1-stage" aria-label={screen.heading ?? 'Charge'}>
        <div className="cl1-figure" data-testid="intro-figure">
          <svg viewBox={`0 0 ${FIELD.w} ${FIELD.h}`} preserveAspectRatio="xMidYMid meet">
            <ChargePairRow y={ROW_TOP} leftQ={screen.left.q} rightQ={screen.right.q} testId="intro-row-attract" />
            {/* Hairline between the rows. Mirrors the `.inquiry-divider` token in
                styles.css (1px, oklch(84% 0.018 78)); inlined here because this
                rule lives inside the SVG rather than the text rail. */}
            <line
              x1={DIVIDER_X1}
              y1={DIVIDER_Y}
              x2={DIVIDER_X2}
              y2={DIVIDER_Y}
              stroke="oklch(84% 0.018 78)"
              strokeWidth={1}
              data-testid="intro-divider"
              aria-hidden="true"
            />
            <ChargePairRow y={ROW_BOTTOM} leftQ={1} rightQ={1} testId="intro-row-repel" />
          </svg>
        </div>
      </section>
      <div className="experience-panel cl1-rail inquiry-rail">
        <p className="eyebrow">Key idea</p>
        {screen.heading ? <p className="inquiry-prompt-text">{screen.heading}</p> : null}
        {screen.body
          .split(/\n\s*\n/)
          .map((paragraph) => paragraph.trim())
          .filter(Boolean)
          .map((paragraph, index) => (
            <p key={index} className="inquiry-intro">
              {paragraph}
            </p>
          ))}
        <button type="button" className="secondary-button" onClick={onComplete}>
          Continue
        </button>
      </div>
    </article>
  );
}
