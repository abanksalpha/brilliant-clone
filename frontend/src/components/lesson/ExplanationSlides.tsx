import { useEffect, useRef, useState } from 'react';
import type { Slide } from '../../content';
import { RichText } from './RichText';
import './ExplanationSlides.css';

type ExplanationSlidesProps = {
  slides: Slide[];
  onComplete: () => void;
  // Slide to open on (resume position). Clamped to the deck; defaults to the first.
  initialIndex?: number;
  // Reports the current slide index up to the session so the single PhaseBar can
  // show within-Learn granularity. Fires on mount and on every slide change.
  onStepChange?: (index: number) => void;
};

// Phase 3 of the lesson: one or two static explanation slides. There is no
// interaction beyond navigation. Next walks the deck; the button on the final
// slide hands control back to the session via onComplete. Body text inherits the
// shared 68ch RichText cap so prose stays comfortable to read.
export function ExplanationSlides({ slides, onComplete, initialIndex = 0, onStepChange }: ExplanationSlidesProps) {
  const [index, setIndex] = useState(() => {
    const max = Math.max(0, slides.length - 1);
    const start = Math.trunc(Number.isFinite(initialIndex) ? initialIndex : 0);
    return Math.min(Math.max(0, start), max);
  });
  const total = slides.length;
  const slide = slides[index];
  const isLast = index >= total - 1;

  // Keep the reporter in a ref so a changing callback identity does not refire
  // the effect; report only when the slide index actually changes (and on mount).
  const onStepRef = useRef(onStepChange);
  onStepRef.current = onStepChange;
  useEffect(() => {
    onStepRef.current?.(index);
  }, [index]);

  if (!slide) {
    return (
      <section className="panel lesson-phase explanation-slides" data-testid="explanation-slides">
        <button type="button" className="secondary-button" onClick={onComplete}>
          Continue
        </button>
      </section>
    );
  }

  return (
    <section className="panel lesson-phase explanation-slides" data-testid="explanation-slides">
      <p className="eyebrow">Learn</p>
      {/* Keyed by slide so the content rises in on each Next (and on entering
          Learn), while the eyebrow and nav stay put. */}
      <div key={index} className="lesson-card-rise explanation-slide__content">
        {slide.heading ? <h2 className="explanation-slide__heading">{slide.heading}</h2> : null}
        <div className="explanation-slide__body">
          <RichText text={slide.body} variant="body" />
        </div>
        {slide.figure ? (
          <figure className="explanation-slide__figure" data-testid="explanation-figure">
            <RichText text={slide.figure} variant="visual" />
          </figure>
        ) : null}
      </div>
      <div className="explanation-slides__nav">
        {total > 1 ? (
          <p className="explanation-slides__count" aria-hidden="true">
            {index + 1} / {total}
          </p>
        ) : null}
        <button
          type="button"
          className="secondary-button"
          onClick={() => (isLast ? onComplete() : setIndex((value) => value + 1))}
        >
          {isLast ? 'Continue' : 'Next'}
        </button>
      </div>
    </section>
  );
}
