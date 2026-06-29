import { useState } from 'react';
import type { InquiryGaussScreen } from '../../../content/schema';
import { celebrateSmall } from '../../../lib/confetti';
import { MathText } from '../RichText';
import { GaussScene } from './GaussScene';

type Stage = 'predict' | 'revealed';

// Phase 2 (Inquiry) for Gauss's law: a point charge and a Gaussian loop. The learner
// drags a gauge to predict the net flux, then the reveal shows it depends only on
// whether the charge is enclosed: full (Q / epsilon_0) when inside, zero when
// outside. Ungraded, like every inquiry.
export function InquiryGaussScene({ screen, onComplete }: { screen: InquiryGaussScreen; onComplete: () => void }) {
  const trueFraction = screen.enclosed ? 1 : 0;
  const [stage, setStage] = useState<Stage>('predict');
  const [prediction, setPrediction] = useState(0.6);
  const predicting = stage === 'predict';

  function reveal() {
    if (Math.abs(prediction - trueFraction) <= 0.15) celebrateSmall();
    setStage('revealed');
  }

  return (
    <article className="lesson-experience cl1-experience inquiry-scene" data-testid={`inquiry-scene-${screen.id}`}>
      <section className="lesson-visual cl1-stage" aria-label={screen.prompt}>
        <GaussScene
          enclosed={screen.enclosed}
          revealed={!predicting}
          trueFraction={trueFraction}
          prediction={prediction}
          onPredict={predicting ? setPrediction : undefined}
        />
      </section>
      <div className="experience-panel cl1-rail inquiry-rail">
        <p className="eyebrow">Prediction</p>
        <p className="inquiry-prompt-text"><MathText text={screen.prompt} /></p>
        {predicting ? (
          <>
            <p className="inquiry-hint">
              Drag the gauge to the net flux you expect through the loop, then reveal. A guess is the point; you will see the answer next.
            </p>
            <button type="button" className="secondary-button" onClick={reveal}>
              Reveal
            </button>
          </>
        ) : (
          <>
            <hr className="inquiry-divider" aria-hidden="true" />
            <p className="inquiry-reveal-caption"><MathText text={screen.revealCaption} /></p>
            {screen.note ? <p className="inquiry-note"><MathText text={screen.note} /></p> : null}
            <button type="button" className="secondary-button" onClick={onComplete}>
              Continue
            </button>
          </>
        )}
      </div>
    </article>
  );
}
