import { useMemo, useState } from 'react';
import type { InquiryPolarizeScreen } from '../../../content/schema';
import { celebrateSmall } from '../../../lib/confetti';
import { magnitude, polarizationForce } from '../physics';
import { clamp, scaleByReference } from '../scenes/primitives';
import { closeEnough } from './InquiryScene';
import { PolarizationField } from './PolarizationField';
import { ARROW_GAP, FIELD, type Point } from './TwoChargeField';

// Pixels for the reference (revealed) force. Smaller than the point-charge scenes
// because the rod starts near the sphere, so the arrow lives in a tighter gap.
const REF_PX = 90;
const MARGIN = 34;
const SPHERE = { x: 300, y: 190, r: 64 };
// The rod starts near the sphere so the attraction reads as a short, strong pull.
const ROD_START_X = 500;
const ROD_Y = 190;
// Keep the rod clear of the sphere so the force stays finite and the bar never
// overlaps the conductor.
const MIN_GAP = SPHERE.r + 64;
// The guess starts tilted this far below the (horizontal) force axis so a visible
// dashed arrow is there to aim and resize, off the real force arrow.
const START_TILT = Math.PI / 4;

type Stage = 'predict' | 'revealed';

// Phase 2 (Inquiry) for Charging: a charged rod beside a neutral conducting sphere.
// The learner predicts the net force the neutral sphere feels (drag the dashed
// arrow), then the reveal shows the induced separation and the true attraction, and
// the rod can be dragged nearer or farther to explore. Ungraded, like every inquiry.
export function InquiryPolarizeScene({
  screen,
  onComplete,
}: {
  screen: InquiryPolarizeScreen;
  onComplete: () => void;
}) {
  const [rod, setRod] = useState({ x: ROD_START_X, y: ROD_Y, q: screen.rodCharge });
  const [stage, setStage] = useState<Stage>('predict');
  // The dashed guess stays through the reveal so the learner can compare it to the
  // true force; it clears once they start exploring (moving the rod).
  const [explored, setExplored] = useState(false);

  // One fixed reference: the net force at the starting distance, so the revealed
  // arrow opens at REF_PX and grows or shrinks honestly as the rod moves.
  const refForce = useMemo(
    () => magnitude(polarizationForce({ x: ROD_START_X, y: ROD_Y, q: screen.rodCharge }, SPHERE, SPHERE.r).force) || 1,
    [screen.rodCharge],
  );

  const predicting = stage === 'predict';
  const current = polarizationForce(rod, SPHERE, SPHERE.r).force;

  const [prediction, setPrediction] = useState<Point>(() => {
    const baseLen = scaleByReference(magnitude(current), refForce, REF_PX);
    const reach = SPHERE.r + ARROW_GAP + baseLen;
    return {
      x: clamp(SPHERE.x + reach * Math.cos(START_TILT), MARGIN, FIELD.w - MARGIN),
      y: clamp(SPHERE.y + reach * Math.sin(START_TILT), MARGIN, FIELD.h - MARGIN),
    };
  });

  function reveal() {
    const force = polarizationForce(rod, SPHERE, SPHERE.r).force;
    const mag = magnitude(force);
    // A close guess earns the same small celebration as a correct problem. Fired
    // before the stage commits; it never gates the reveal.
    if (mag > 1e-12) {
      const len = scaleByReference(mag, refForce, REF_PX);
      const u = { x: force.x / mag, y: force.y / mag };
      const tip = {
        x: SPHERE.x + u.x * (SPHERE.r + ARROW_GAP + len),
        y: SPHERE.y + u.y * (SPHERE.r + ARROW_GAP + len),
      };
      if (closeEnough(prediction, tip, len)) celebrateSmall();
    }
    setStage('revealed');
  }

  // The rod slides horizontally (the polarization axis stays horizontal), never
  // closer than MIN_GAP so the bar clears the sphere and the force stays finite.
  function moveRod(pt: Point) {
    setExplored(true);
    const x = clamp(pt.x, SPHERE.x + MIN_GAP, FIELD.w - MARGIN);
    setRod((r) => ({ ...r, x, y: SPHERE.y }));
  }

  return (
    <article className="lesson-experience cl1-experience inquiry-scene" data-testid={`inquiry-scene-${screen.id}`}>
      <section className="lesson-visual cl1-stage" aria-label={screen.prompt}>
        <PolarizationField
          rod={rod}
          sphere={SPHERE}
          showInduced={!predicting}
          netForce={predicting ? null : current}
          refForce={refForce}
          refPx={REF_PX}
          prediction={explored ? null : prediction}
          onPredictMove={predicting ? setPrediction : undefined}
          onRodMove={!predicting ? moveRod : undefined}
          rodMovable={!predicting}
        />
      </section>
      <div className="experience-panel cl1-rail inquiry-rail">
        <p className="eyebrow">Prediction</p>
        <p className="inquiry-prompt-text">{screen.prompt}</p>
        {predicting ? (
          <>
            <p className="inquiry-hint">
              The sphere is neutral now. Drag the dashed arrow to the force you expect it to feel. Committing to a guess first makes the answer stick, even when you miss.
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
            <p className="inquiry-hint">Drag the rod nearer or farther to change the force.</p>
            <button type="button" className="secondary-button" onClick={onComplete}>
              Continue
            </button>
          </>
        )}
      </div>
    </article>
  );
}
