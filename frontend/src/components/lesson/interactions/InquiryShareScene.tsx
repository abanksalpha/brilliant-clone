import { type KeyboardEvent, useState } from 'react';
import type { InquiryShareScreen } from '../../../content/schema';
import { celebrateSmall } from '../../../lib/confetti';
import { Charge } from '../scenes/primitives';
import { FIELD } from './TwoChargeField';

const CYCLE = [0, 1, 2, 3];
const SPHERE_R = 56;
const LEFT_X = 250;
const RIGHT_X = 510;
const MID_Y = 190;

type Stage = 'predict' | 'revealed';

function signFor(q: number): '+' | '-' | 'neutral' {
  if (q > 0) return '+';
  if (q < 0) return '-';
  return 'neutral';
}

function nextGuess(q: number): number {
  return CYCLE[(CYCLE.indexOf(q) + 1) % CYCLE.length] ?? 0;
}

// Phase 2 (Inquiry) for Charging, second screen: two identical conducting spheres,
// one charged and one neutral, briefly touch. The learner taps the neutral sphere
// to predict its charge afterward; the reveal splits the total evenly. Ungraded,
// like every inquiry.
export function InquiryShareScene({ screen, onComplete }: { screen: InquiryShareScreen; onComplete: () => void }) {
  const leftStart = screen.leftStart;
  // Identical spheres in contact share the total evenly.
  const finalEach = Math.round(leftStart / 2);
  const [stage, setStage] = useState<Stage>('predict');
  const [guess, setGuess] = useState(0);
  const predicting = stage === 'predict';

  function reveal() {
    if (guess === finalEach) celebrateSmall();
    setStage('revealed');
  }

  function cycleGuess() {
    setGuess(nextGuess);
  }

  function onGuessKey(event: KeyboardEvent<SVGGElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      cycleGuess();
    }
  }

  const leftQ = predicting ? leftStart : finalEach;
  const rightQ = predicting ? guess : finalEach;

  return (
    <article className="lesson-experience cl1-experience inquiry-scene" data-testid={`inquiry-scene-${screen.id}`}>
      <section className="lesson-visual cl1-stage" aria-label={screen.prompt}>
        <div className="cl1-figure" data-testid="charge-share-field">
          <svg viewBox={`0 0 ${FIELD.w} ${FIELD.h}`} preserveAspectRatio="xMidYMid meet">
            <line
              className="share-contact"
              x1={LEFT_X + SPHERE_R}
              y1={MID_Y}
              x2={RIGHT_X - SPHERE_R}
              y2={MID_Y}
              aria-hidden="true"
            />
            <g>
              <Charge x={LEFT_X} y={MID_Y} sign={signFor(leftQ)} count={Math.abs(leftQ)} r={SPHERE_R} />
            </g>
            {predicting ? (
              <g
                role="button"
                tabIndex={0}
                aria-label="Predict the right sphere's charge"
                data-testid="share-guess"
                onClick={cycleGuess}
                onKeyDown={onGuessKey}
                style={{ cursor: 'pointer' }}
              >
                <Charge x={RIGHT_X} y={MID_Y} sign={signFor(rightQ)} count={Math.abs(rightQ)} r={SPHERE_R} />
              </g>
            ) : (
              <g data-testid="share-result">
                <Charge x={RIGHT_X} y={MID_Y} sign={signFor(rightQ)} count={Math.abs(rightQ)} r={SPHERE_R} />
              </g>
            )}
          </svg>
        </div>
      </section>
      <div className="experience-panel cl1-rail inquiry-rail">
        <p className="eyebrow">Prediction</p>
        <p className="inquiry-prompt-text">{screen.prompt}</p>
        {predicting ? (
          <>
            <p className="inquiry-hint">
              Tap the right sphere to set your guess for its charge after they touch, then reveal. A guess is the point; you will see the answer next.
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
            <button type="button" className="secondary-button" onClick={onComplete}>
              Continue
            </button>
          </>
        )}
      </div>
    </article>
  );
}
