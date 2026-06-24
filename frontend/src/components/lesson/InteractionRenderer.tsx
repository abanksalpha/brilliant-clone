import { useState } from 'react';
import { FeedbackRenderer } from './FeedbackRenderer';
import { RichText } from './RichText';
import type { LearnerChoice, LearnerStep } from './lessonExperience';

type AnswerState = {
  choice: LearnerChoice;
  status: 'correct' | 'wrong';
} | null;

type InteractionRendererProps = {
  canContinue?: boolean;
  isFinalStep: boolean;
  onContinue: () => void;
  step: LearnerStep;
};

export function InteractionRenderer({
  canContinue = true,
  isFinalStep,
  onContinue,
  step,
}: InteractionRendererProps) {
  const [answer, setAnswer] = useState<AnswerState>(null);

  if (step.interactionKind === 'match') {
    return (
      <div className="experience-panel">
        <h2>{step.prompt}</h2>
        <button className="secondary-button" disabled={!canContinue} type="button" onClick={onContinue}>
          Continue
        </button>
      </div>
    );
  }

  if (step.interactionKind === 'observe') {
    return (
      <div className="experience-panel experience-panel-concept">
        <p className="eyebrow">Key idea</p>
        {step.body ? <RichText text={step.body} /> : null}
        <button className="secondary-button" type="button" onClick={onContinue}>
          {isFinalStep ? 'Finish lesson' : 'Continue'}
        </button>
      </div>
    );
  }

  return (
    <div className="experience-panel">
      <h2>{step.prompt}</h2>
      <div className="choice-list" aria-label="Predictions">
        {step.choices.map((choice) => (
          <button
            className="choice-button"
            disabled={answer?.status === 'correct'}
            key={choice.id}
            type="button"
            onClick={() => setAnswer({
              choice,
              status: choice.correct ? 'correct' : 'wrong',
            })}
          >
            {choice.text}
          </button>
        ))}
      </div>
      <FeedbackRenderer
        status={answer?.status ?? null}
        wrongChoiceId={answer?.choice.id}
        isFinalStep={isFinalStep}
        step={step}
        onContinue={onContinue}
        onRetry={() => setAnswer(null)}
      />
    </div>
  );
}
