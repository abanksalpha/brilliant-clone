import type { Lesson } from '../../content';
import { CHARGING_LESSON_ID, ChargingExperience } from './ChargingExperience';
import { COULOMB_LESSON_ID, CoulombExperience } from './CoulombExperience';
import { InteractionRenderer } from './InteractionRenderer';
import { LessonComplete } from './LessonComplete';
import { SessionChrome } from './session/SessionChrome';
import { toLearnerStep } from './lessonExperience';

type LessonRendererProps = {
  currentStepIndex: number;
  earnedXp?: number;
  isComplete: boolean;
  lesson: Lesson;
  onContinue: () => void;
  onStepSelect?: (stepIndex: number) => void;
  questionXpEvent?: {
    amount: number;
    id: number;
  } | null;
  visitedStepCount?: number;
};

export function LessonRenderer({
  currentStepIndex,
  earnedXp = 0,
  isComplete,
  lesson,
  onContinue,
  onStepSelect,
  questionXpEvent,
  visitedStepCount,
}: LessonRendererProps) {
  const totalSteps = lesson.steps.length;

  if (isComplete) {
    return <LessonComplete title={lesson.title} earnedXp={earnedXp} />;
  }

  const rawStep = lesson.steps[currentStepIndex];
  const learnerStep = toLearnerStep(lesson, rawStep);
  const isFinalStep = currentStepIndex === totalSteps - 1;

  return (
    <section className="lesson-player" aria-label={`${lesson.title} learning experience`}>
      {questionXpEvent ? (
        <div
          className="lesson-xp-burst"
          data-testid="lesson-xp-burst"
          key={questionXpEvent.id}
          role="status"
          aria-live="polite"
        >
          +{questionXpEvent.amount} XP
        </div>
      ) : null}
      <SessionChrome
        current={currentStepIndex + 1}
        onStepSelect={onStepSelect}
        title={lesson.title}
        total={totalSteps}
        visitedStepCount={visitedStepCount}
      />
      {lesson.lessonId === COULOMB_LESSON_ID ? (
        <CoulombExperience
          isFinalStep={isFinalStep}
          learnerStep={learnerStep}
          onContinue={onContinue}
          step={rawStep}
        />
      ) : lesson.lessonId === CHARGING_LESSON_ID ? (
        <ChargingExperience
          isFinalStep={isFinalStep}
          learnerStep={learnerStep}
          onContinue={onContinue}
          step={rawStep}
        />
      ) : (
        <article className="lesson-experience" key={learnerStep.id}>
          <InteractionRenderer
            isFinalStep={isFinalStep}
            step={learnerStep}
            onContinue={onContinue}
          />
        </article>
      )}
    </section>
  );
}
