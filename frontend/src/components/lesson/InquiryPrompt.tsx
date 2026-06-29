import { useState } from 'react';
import type { InquiryPrompt as InquiryPromptModel, SandboxConfig } from '../../content';
import { ChargeSandbox } from './interactions/ChargeSandbox';
import { InquiryIntro } from './interactions/InquiryIntro';
import { InquiryFieldScene } from './interactions/InquiryFieldScene';
import { InquiryFluxScene } from './interactions/InquiryFluxScene';
import { InquiryGaussScene } from './interactions/InquiryGaussScene';
import { InquiryPolarizeScene } from './interactions/InquiryPolarizeScene';
import { InquiryScene } from './interactions/InquiryScene';
import { InquiryShareScene } from './interactions/InquiryShareScene';
import './InquiryPrompt.css';

type InquiryPromptProps = {
  inquiry: InquiryPromptModel;
  onComplete: () => void;
  initialScreen?: number;
  onStepChange?: (index: number) => void;
};

// A neutral two-charge field for sandbox inquiries. It carries no goal, so
// ChargeSandbox stays exploratory: a draggable test charge with a live force
// arrow and readout, and never a graded check.
const EXPLORE_SANDBOX: SandboxConfig = {
  width: 10,
  height: 6,
  fixedCharges: [
    { id: 'left', x: 2.5, y: 3, q: 1 },
    { id: 'right', x: 7.5, y: 3, q: -1 },
  ],
  testCharge: { id: 'test', x: 5, y: 1.6, q: 1 },
};

/**
 * Phase 2 of the lesson: a quick, low-stakes generative primer shown before any
 * instruction. The learner commits a guess so the upcoming explanation has
 * something to resolve. Nothing here is graded; the capture mode just records a
 * prediction and Continue moves on.
 */
export function InquiryPrompt({ inquiry, onComplete, initialScreen, onStepChange }: InquiryPromptProps) {
  const screens = inquiry.screens ?? [];
  const [screenIndex, setScreenIndex] = useState(() =>
    Math.min(Math.max(0, Math.trunc(initialScreen ?? 0)), Math.max(0, screens.length - 1)),
  );
  // Every hook runs unconditionally (Rules of Hooks). The legacy capture path
  // below owns these two; the screens path returns early without using them.
  const [text, setText] = useState('');
  const [choiceId, setChoiceId] = useState<string | null>(null);

  if (screens.length > 0) {
    const current = screens[screenIndex];
    const advance = () => {
      if (screenIndex < screens.length - 1) {
        const next = screenIndex + 1;
        setScreenIndex(next);
        onStepChange?.(next);
      } else {
        onComplete();
      }
    };
    return (
      <div className="inquiry-stage" data-testid="inquiry-prompt">
        {current.kind === 'intro' ? (
          <InquiryIntro key={current.id} screen={current} onComplete={advance} />
        ) : current.kind === 'polarize' ? (
          <InquiryPolarizeScene key={current.id} screen={current} onComplete={advance} />
        ) : current.kind === 'share' ? (
          <InquiryShareScene key={current.id} screen={current} onComplete={advance} />
        ) : current.kind === 'field' ? (
          <InquiryFieldScene key={current.id} screen={current} onComplete={advance} />
        ) : current.kind === 'flux' ? (
          <InquiryFluxScene key={current.id} screen={current} onComplete={advance} />
        ) : current.kind === 'gauss' ? (
          <InquiryGaussScene key={current.id} screen={current} onComplete={advance} />
        ) : (
          <InquiryScene key={current.id} screen={current} onComplete={advance} />
        )}
      </div>
    );
  }

  const choices = inquiry.choices ?? [];

  const canContinue =
    inquiry.capture === 'sandbox' ||
    (inquiry.capture === 'text' && text.trim().length > 0) ||
    (inquiry.capture === 'choice' && choiceId !== null);

  return (
    <section className="panel lesson-phase inquiry" data-testid="inquiry-prompt">
      <p className="eyebrow">Explore</p>
      <h2 className="inquiry-question">{inquiry.question}</h2>
      <p className="inquiry-frame">Make your best guess. We will revisit it after the explanation.</p>

      {inquiry.capture === 'text' ? (
        <textarea
          className="inquiry-text"
          rows={3}
          value={text}
          aria-label="Your guess"
          placeholder="Write your prediction"
          onChange={(event) => setText(event.target.value)}
        />
      ) : null}

      {inquiry.capture === 'choice' ? (
        <div className="inquiry-choices choice-list" role="radiogroup" aria-label="Your guess">
          {choices.map((choice) => {
            const selected = choiceId === choice.id;
            return (
              <button
                key={choice.id}
                type="button"
                role="radio"
                aria-checked={selected}
                className={`choice-button inquiry-choice${selected ? ' inquiry-choice--selected' : ''}`}
                onClick={() => setChoiceId(choice.id)}
              >
                {choice.text}
              </button>
            );
          })}
        </div>
      ) : null}

      {inquiry.capture === 'sandbox' ? (
        <div className="inquiry-sandbox" data-testid="inquiry-sandbox">
          <ChargeSandbox config={EXPLORE_SANDBOX} />
        </div>
      ) : null}

      <button
        type="button"
        className="secondary-button inquiry-continue"
        disabled={!canContinue}
        onClick={onComplete}
      >
        Continue
      </button>
    </section>
  );
}
