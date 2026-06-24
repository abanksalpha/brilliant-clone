import { useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { LessonPlayer } from '../components/lesson/LessonPlayer';
import { getLessonById } from '../content';
import { useProgress } from '../progress/ProgressContext';

export function LessonPage() {
  const { lessonId } = useParams();
  const lesson = lessonId ? getLessonById(lessonId) : undefined;
  const {
    isLoading,
    progress,
    getLessonStepIndex,
    getVisitedStepCount,
    completeLesson,
    answerQuestion,
    setLessonStep,
  } = useProgress();

  // The resume position is captured once per lesson. Reading it live on every
  // render would let a mid-session progress change (e.g. completeLesson clearing
  // the session) flow back in as a fresh "initial" step and bounce the player
  // back to step 1 instead of showing the completion screen.
  const initialsRef = useRef<{ lessonId: string; stepIndex: number; visitedStepCount: number } | null>(null);

  function handleLessonStepChange(activeLessonId: string, nextStepIndex: number, maxVisitedStepIndex?: number) {
    const activeLesson = getLessonById(activeLessonId);
    const totalSteps = activeLesson?.steps.length ?? 0;
    setLessonStep(activeLessonId, nextStepIndex, totalSteps, maxVisitedStepIndex);
  }

  function handleLessonComplete(completedLessonId: string) {
    return completeLesson(completedLessonId);
  }

  function handleQuestionAnswered(activeLessonId: string, stepNumber: number) {
    return answerQuestion(activeLessonId, stepNumber);
  }

  if (!lesson) {
    return (
      <main className="lesson-shell theme-handdrawn theme-handdrawn--lesson">
        <section className="panel lesson-missing">
          <p className="eyebrow">Topic</p>
          <h1>Topic not found</h1>
          <p>Choose a topic from the dashboard.</p>
          <Link className="secondary-button" to="/dashboard">
            Back to dashboard
          </Link>
        </section>
      </main>
    );
  }

  if (isLoading) {
    return (
      <main className="lesson-shell theme-handdrawn theme-handdrawn--lesson">
        <section className="panel lesson-loading">
          <p className="eyebrow" role="status">
            Loading…
          </p>
        </section>
      </main>
    );
  }

  if (!initialsRef.current || initialsRef.current.lessonId !== lesson.lessonId) {
    // A finished lesson is being reviewed, so unlock every screen (completion
    // clears the saved session, which would otherwise relock all but step 1).
    const isCompleted = progress.completedLessonIds.includes(lesson.lessonId);
    initialsRef.current = {
      lessonId: lesson.lessonId,
      stepIndex: getLessonStepIndex(lesson.lessonId, lesson.steps.length),
      visitedStepCount: isCompleted
        ? lesson.steps.length
        : getVisitedStepCount(lesson.lessonId, lesson.steps.length),
    };
  }
  const { stepIndex: initialStepIndex, visitedStepCount: initialVisitedStepCount } = initialsRef.current;

  return (
    <main className="lesson-shell theme-handdrawn theme-handdrawn--lesson">
      <LessonPlayer
        initialStepIndex={initialStepIndex}
        initialVisitedStepCount={initialVisitedStepCount}
        lesson={lesson}
        onLessonComplete={handleLessonComplete}
        onQuestionAnswered={handleQuestionAnswered}
        onStepChange={handleLessonStepChange}
      />
    </main>
  );
}
