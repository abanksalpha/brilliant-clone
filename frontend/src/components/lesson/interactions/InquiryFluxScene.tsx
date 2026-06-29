import { useState } from 'react';
import type { InquiryFluxScreen } from '../../../content/schema';
import { celebrateSmall } from '../../../lib/confetti';
import { MathText } from '../RichText';
import { FluxScene } from './FluxScene';

type Stage = 'predict' | 'revealed';

// Phase 2 (Inquiry) for Electric Flux: a uniform field and a surface. The learner
// drags a gauge to predict the flux, then the reveal highlights the field lines that
// cross. A tilted flat plate passes cos(tilt) of the field; a closed box passes a net
// of zero. Ungraded, like every inquiry.
export function InquiryFluxScene({ screen, onComplete }: { screen: InquiryFluxScreen; onComplete: () => void }) {
  const tiltDeg = screen.tiltDeg ?? 60;
  const trueFraction = screen.surface === 'box' ? 0 : Math.cos((tiltDeg * Math.PI) / 180);
  const [stage, setStage] = useState<Stage>('predict');
  const [prediction, setPrediction] = useState(0.7);
  const predicting = stage === 'predict';

  function reveal() {
    // A close guess earns the same small celebration as a correct problem.
    if (Math.abs(prediction - trueFraction) <= 0.12) celebrateSmall();
    setStage('revealed');
  }

  return (
    <article className="lesson-experience cl1-experience inquiry-scene" data-testid={`inquiry-scene-${screen.id}`}>
      <section className="lesson-visual cl1-stage" aria-label={screen.prompt}>
        <FluxScene
          surface={screen.surface}
          plateTilt={tiltDeg}
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
              Drag the gauge to the flux you expect through the surface, then reveal. A guess is the point; you will see the answer next.
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
