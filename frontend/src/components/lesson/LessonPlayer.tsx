import { useEffect, useState } from 'react';
import type { Lesson } from '../../content';
import { LessonRenderer } from './LessonRenderer';

type LessonPlayerProps = {
  lesson: Lesson;
  initialStepIndex?: number;
  initialVisitedStepCount?: number;
  onLessonComplete?: (lessonId: string) => number | void;
  onQuestionAnswered?: (lessonId: string, stepNumber: number) => number | void;
  onStepChange?: (lessonId: string, nextStepIndex: number, maxVisitedStepIndex: number) => void;
};

type QuestionXpEvent = {
  amount: number;
  id: number;
};

function clampStepIndex(stepIndex: number | undefined, totalSteps: number) {
  if (!Number.isFinite(stepIndex) || totalSteps <= 0) {
    return 0;
  }

  return Math.min(Math.max(Math.trunc(stepIndex ?? 0), 0), totalSteps - 1);
}

export function LessonPlayer({
  lesson,
  initialStepIndex = 0,
  initialVisitedStepCount,
  onLessonComplete,
  onQuestionAnswered,
  onStepChange,
}: LessonPlayerProps) {
  const totalSteps = lesson.steps.length;
  const clampedInitialStepIndex = clampStepIndex(initialStepIndex, totalSteps);
  const clampedInitialMaxVisitedStepIndex = Math.max(
    clampedInitialStepIndex,
    clampStepIndex((initialVisitedStepCount ?? clampedInitialStepIndex + 1) - 1, totalSteps),
  );
  const [currentStepIndex, setCurrentStepIndex] = useState(clampedInitialStepIndex);
  const [maxVisitedStepIndex, setMaxVisitedStepIndex] = useState(clampedInitialMaxVisitedStepIndex);
  const [isComplete, setIsComplete] = useState(false);
  const [xpEarned, setXpEarned] = useState(0);
  const [questionXpEvent, setQuestionXpEvent] = useState<QuestionXpEvent | null>(null);

  useEffect(() => {
    const nextInitialStepIndex = clampStepIndex(initialStepIndex, lesson.steps.length);
    const nextInitialMaxVisitedStepIndex = Math.max(
      nextInitialStepIndex,
      clampStepIndex((initialVisitedStepCount ?? nextInitialStepIndex + 1) - 1, lesson.steps.length),
    );
    setCurrentStepIndex(nextInitialStepIndex);
    setMaxVisitedStepIndex(nextInitialMaxVisitedStepIndex);
    setIsComplete(false);
    setXpEarned(0);
    setQuestionXpEvent(null);
  }, [initialStepIndex, initialVisitedStepCount, lesson.lessonId, lesson.steps.length]);

  useEffect(() => {
    if (!questionXpEvent) {
      return;
    }

    // Matches the .lesson-xp-burst CSS animation (1.2s) so the node unmounts
    // right as it finishes fading out instead of lingering or flashing back.
    const timer = window.setTimeout(() => {
      setQuestionXpEvent(null);
    }, 1250);

    return () => window.clearTimeout(timer);
  }, [questionXpEvent]);

  function handleContinue() {
    const currentStep = lesson.steps[currentStepIndex];
    if (currentStep?.type === 'interactive') {
      const awarded = onQuestionAnswered?.(lesson.lessonId, currentStep.stepNumber);
      const awardedXp = typeof awarded === 'number' ? Math.max(awarded, 0) : 0;
      if (awardedXp > 0) {
        setQuestionXpEvent((previous) => ({
          amount: awardedXp,
          id: (previous?.id ?? 0) + 1,
        }));
      }
    }

    if (currentStepIndex >= totalSteps - 1) {
      const earned = onLessonComplete?.(lesson.lessonId);
      setXpEarned(typeof earned === 'number' ? Math.max(earned, 0) : 0);
      setIsComplete(true);
      return;
    }

    const nextStepIndex = currentStepIndex + 1;
    const nextMaxVisitedStepIndex = Math.max(maxVisitedStepIndex, nextStepIndex);
    setCurrentStepIndex(nextStepIndex);
    setMaxVisitedStepIndex(nextMaxVisitedStepIndex);
    onStepChange?.(lesson.lessonId, nextStepIndex, nextMaxVisitedStepIndex);
  }

  function handleStepSelect(nextStepIndex: number) {
    const clampedNextStepIndex = clampStepIndex(nextStepIndex, totalSteps);
    if (clampedNextStepIndex > maxVisitedStepIndex || clampedNextStepIndex === currentStepIndex) {
      return;
    }

    setCurrentStepIndex(clampedNextStepIndex);
    onStepChange?.(lesson.lessonId, clampedNextStepIndex, maxVisitedStepIndex);
  }

  return (
    <LessonRenderer
      currentStepIndex={currentStepIndex}
      earnedXp={xpEarned}
      isComplete={isComplete}
      lesson={lesson}
      onContinue={handleContinue}
      onStepSelect={handleStepSelect}
      questionXpEvent={questionXpEvent}
      visitedStepCount={maxVisitedStepIndex + 1}
    />
  );
}
