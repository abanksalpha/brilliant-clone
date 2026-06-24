import { RichText } from './RichText';
import { getWrongFeedback, type LearnerStep } from './lessonExperience';

export type AnswerStatus = 'correct' | 'wrong';

type FeedbackRendererProps = {
  status: AnswerStatus | null;
  // Optional choice id so multiple-choice steps can show choice-specific hints.
  wrongChoiceId?: string;
  isFinalStep: boolean;
  onContinue: () => void;
  onRetry: () => void;
  step: LearnerStep;
};

export function FeedbackRenderer({
  status,
  wrongChoiceId,
  isFinalStep,
  onContinue,
  onRetry,
  step,
}: FeedbackRendererProps) {
  if (!status) return null;

  const isCorrect = status === 'correct';
  const feedbackText = isCorrect
    ? step.feedback?.correct
    : getWrongFeedback(step, wrongChoiceId ?? '');

  return (
    <section className={isCorrect ? 'feedback-panel notice' : 'feedback-panel error'}>
      <h3>{isCorrect ? 'Nice work' : 'Look again'}</h3>
      {feedbackText ? <RichText text={feedbackText} variant="feedback" /> : null}
      {isCorrect && step.explanation ? (
        <div className="reveal-panel">
          <RichText text={step.explanation} variant="feedback" />
        </div>
      ) : null}
      <button className="secondary-button" type="button" onClick={isCorrect ? onContinue : onRetry}>
        {isCorrect ? (isFinalStep ? 'Finish lesson' : 'Continue') : 'Try again'}
      </button>
    </section>
  );
}
