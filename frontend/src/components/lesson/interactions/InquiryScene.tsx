import { useMemo, useState } from 'react';
import type { InquiryPredictScreen } from '../../../content/schema';
import { celebrateSmall } from '../../../lib/confetti';
import { forceVectorsForPair, magnitude } from '../physics';
import { clamp, scaleByReference } from '../scenes/primitives';
import { ARROW_GAP, FIELD, FIELD_CHARGE_R, TwoChargeField, type FieldCharge, type Point } from './TwoChargeField';

// Pixels for the reference (revealed) force; every arrow length scales from this,
// so it sets the on-screen size of all inquiry arrows (157.5 = 1.25x the prior 126).
// At this scale the strongest explore values (e.g. 3x3) run their heads out to the
// field edge rather than fitting fully inside it.
const REF_PX = 157.5;
const MARGIN = 34;
const MIN_SEP = 2 * FIELD_CHARGE_R + 18;
const CYCLE = [-3, -2, -1, 0, 1, 2, 3];
// The guess starts tilted this far below the (horizontal) force axis, so it reads
// as the student's own prediction to aim and size, not the answer pre-drawn on the
// real arrow.
const START_TILT = Math.PI / 4;

// Layouts in the field's coordinate space, charges centered with room on the
// outer sides for the strongest repulsion arrows to extend fully.
const LAYOUT = {
  // The cycle screen opens with a single pair centered in the field. (The intro
  // slide is a separate two-row demonstration, so there is no single position to
  // match for a seamless hand-off.)
  cycle: { left: { x: 310, y: 190 }, right: { x: 450, y: 190 } },
  // The distance screen starts the pair close together (just above MIN_SEP) so
  // doubling the separation on reveal is a clear, visible spread.
  move: { left: { x: 310, y: 190 }, right: { x: 390, y: 190 } },
} as const;

type Stage = 'predict' | 'revealed';

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// A guess counts as correct or very close when its arrow tip lands near the tip of
// the force that is revealed (so both its direction and size are about right). The
// tolerance scales a little with the arrow length, with a floor so a short arrow
// is not impossibly strict.
export function closeEnough(guessTip: Point, forceTip: Point, forceLenPx: number): boolean {
  const tolerance = Math.max(34, forceLenPx * 0.32);
  return dist(guessTip, forceTip) <= tolerance;
}

function nextInCycle(q: number): number {
  const i = CYCLE.indexOf(q);
  return CYCLE[(i + 1) % CYCLE.length] ?? 0;
}

// Force magnitude in scene units (k = 1) for a pair, used only to size arrows.
function pairForce(qA: number, qB: number, r: number): number {
  return r > 0 ? Math.abs(qA * qB) / (r * r) : 0;
}

// One fixed pixels-per-force reference per screen, taken from the larger of the
// baseline and revealed forces, so the baseline arrow is already a useful size
// and the revealed arrow grows or shrinks honestly against it.
function referenceForce(layout: { left: Point; right: Point }, screen: InquiryPredictScreen): number {
  const r0 = dist(layout.left, layout.right);
  const qL = Math.abs(screen.left.q);
  const qR = Math.abs(screen.right.q);
  const baseline = pairForce(qL, qR, r0);
  let revealed: number;
  if (screen.target.apply === 'set-charge') {
    const nL = screen.target.chargeId === 'left' ? Math.abs(screen.target.toQ) : qL;
    const nR = screen.target.chargeId === 'right' ? Math.abs(screen.target.toQ) : qR;
    revealed = pairForce(nL, nR, r0);
  } else {
    revealed = pairForce(qL, qR, r0 * screen.target.toDistanceFactor);
  }
  return Math.max(baseline, revealed) || 1;
}

export function InquiryScene({ screen, onComplete }: { screen: InquiryPredictScreen; onComplete: () => void }) {
  const layout = LAYOUT[screen.mode];
  const refForce = useMemo(() => referenceForce(layout, screen), [layout, screen]);

  const [left, setLeft] = useState<FieldCharge>({ id: 'left', x: layout.left.x, y: layout.left.y, q: screen.left.q });
  const [right, setRight] = useState<FieldCharge>({ id: 'right', x: layout.right.x, y: layout.right.y, q: screen.right.q });
  const [stage, setStage] = useState<Stage>('predict');
  // The dashed guess stays on screen through the reveal (including when the reveal
  // moves or changes a charge) so the learner can compare it to the revealed force.
  // It only clears once they start exploring (changing a charge's amount or
  // position), since the guess no longer matches the configuration they build.
  const [explored, setExplored] = useState(false);

  // Anchor the prediction on the charge that stays put on reveal: the right
  // charge on the charge screen (positions are fixed), the left charge on the
  // distance screen (the right charge is the one that moves away).
  const predictFrom: 'left' | 'right' = screen.mode === 'cycle' ? 'right' : 'left';

  // The prediction starts at a baseline length but tilted off the force axis
  // (down and outward), so a visible dashed arrow is there from the start for the
  // learner to aim and resize, without sitting on top of the real force arrow.
  const [prediction, setPrediction] = useState<Point>(() => {
    const r0 = dist(layout.left, layout.right);
    const baseLen = scaleByReference(pairForce(screen.left.q, screen.right.q, r0), refForce, REF_PX);
    const reach = FIELD_CHARGE_R + ARROW_GAP + baseLen;
    const anchor = predictFrom === 'left' ? layout.left : layout.right;
    const axisSign = predictFrom === 'left' ? -1 : 1;
    return {
      x: clamp(anchor.x + axisSign * reach * Math.cos(START_TILT), MARGIN, FIELD.w - MARGIN),
      y: clamp(anchor.y + reach * Math.sin(START_TILT), MARGIN, FIELD.h - MARGIN),
    };
  });

  const predicting = stage === 'predict';

  // The charge configuration the reveal produces (a tripled charge, or the right
  // charge moved to its new distance). Computed up front so the same result drives
  // both the closeness check and the committed state.
  function revealedPair(): { left: FieldCharge; right: FieldCharge } {
    if (screen.target.apply === 'set-charge') {
      const toQ = screen.target.toQ;
      return screen.target.chargeId === 'left'
        ? { left: { ...left, q: toQ }, right }
        : { left, right: { ...right, q: toQ } };
    }
    const factor = screen.target.toDistanceFactor;
    return {
      left,
      right: {
        ...right,
        x: clamp(left.x + (right.x - left.x) * factor, MARGIN, FIELD.w - MARGIN),
        y: clamp(left.y + (right.y - left.y) * factor, MARGIN, FIELD.h - MARGIN),
      },
    };
  }

  // Whether the learner's guess tip is close to where the revealed force arrow
  // ends, on the anchored charge (the one that stays put). Mirrors how
  // TwoChargeField sizes and places the real force arrow.
  function predictionIsClose(pair: { left: FieldCharge; right: FieldCharge }): boolean {
    const forces = forceVectorsForPair(pair.left, pair.right);
    const anchor = predictFrom === 'left' ? pair.left : pair.right;
    const force = predictFrom === 'left' ? forces.onLeft : forces.onRight;
    const mag = magnitude(force);
    if (mag < 1e-9) return false;
    const lenPx = scaleByReference(mag, refForce, REF_PX);
    const reach = FIELD_CHARGE_R + ARROW_GAP + lenPx;
    const tip = { x: anchor.x + (force.x / mag) * reach, y: anchor.y + (force.y / mag) * reach };
    return closeEnough(prediction, tip, lenPx);
  }

  function reveal() {
    const pair = revealedPair();
    // A correct or very close guess earns a small celebration, the same burst as a
    // correct problem. Fired before the state commits; it does not gate the reveal.
    if (predictionIsClose(pair)) {
      celebrateSmall();
    }
    setLeft(pair.left);
    setRight(pair.right);
    setStage('revealed');
  }

  function cycle(id: 'left' | 'right') {
    setExplored(true);
    const setter = id === 'left' ? setLeft : setRight;
    setter((c) => ({ ...c, q: nextInCycle(c.q) }));
  }

  // Free 2D move of either charge, kept inside the figure and never closer than
  // MIN_SEP so the force (and its arrow) stays finite.
  function move(id: 'left' | 'right', pt: Point) {
    setExplored(true);
    const other = id === 'left' ? right : left;
    let p: Point = { x: clamp(pt.x, MARGIN, FIELD.w - MARGIN), y: clamp(pt.y, MARGIN, FIELD.h - MARGIN) };
    const d = dist(p, other);
    if (d < MIN_SEP) {
      const u = d < 1e-9 ? { x: 1, y: 0 } : { x: (p.x - other.x) / d, y: (p.y - other.y) / d };
      p = {
        x: clamp(other.x + u.x * MIN_SEP, MARGIN, FIELD.w - MARGIN),
        y: clamp(other.y + u.y * MIN_SEP, MARGIN, FIELD.h - MARGIN),
      };
    }
    const setter = id === 'left' ? setLeft : setRight;
    setter((c) => ({ ...c, x: p.x, y: p.y }));
  }

  return (
    <article className="lesson-experience cl1-experience inquiry-scene" data-testid={`inquiry-scene-${screen.id}`}>
      <section className="lesson-visual cl1-stage" aria-label={screen.prompt}>
        <TwoChargeField
          left={left}
          right={right}
          refForce={refForce}
          refPx={REF_PX}
          prediction={explored ? null : prediction}
          onPredictMove={predicting ? setPrediction : undefined}
          onCycle={!predicting && screen.mode === 'cycle' ? cycle : undefined}
          onChargeMove={!predicting && screen.mode === 'move' ? move : undefined}
          predictFrom={predictFrom}
          movable={!predicting && screen.mode === 'move' ? 'right' : 'none'}
        />
      </section>
      <div className="experience-panel cl1-rail inquiry-rail">
        <p className="eyebrow">Prediction</p>
        <p className="inquiry-prompt-text">{screen.prompt}</p>
        {predicting ? (
          <>
            <p className="inquiry-hint">
              The solid arrows are the force now; drag the dashed arrow to the force you expect. Committing to a guess first makes the answer stick, even when you miss.
            </p>
            <button type="button" className="secondary-button" onClick={reveal}>
              Reveal
            </button>
          </>
        ) : (
          <>
            <hr className="inquiry-divider" aria-hidden="true" />
            <p className="inquiry-reveal-caption">{screen.revealCaption}</p>
            {screen.note ? <p className="inquiry-note">{screen.note}</p> : null}
            <p className="inquiry-hint">
              {screen.mode === 'cycle' ? 'Tap a charge to change it.' : 'Drag the right charge to move it.'}
            </p>
            <button type="button" className="secondary-button" onClick={onComplete}>
              Continue
            </button>
          </>
        )}
      </div>
    </article>
  );
}
