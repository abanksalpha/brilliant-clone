import { Link, useParams } from 'react-router-dom';
import { LessonSession } from '../components/lesson/LessonSession';
import { LoadingScreen } from '../components/shell/LoadingScreen';
import { getLessonModule } from '../content';
import { useProgress } from '../progress/ProgressContext';

export function LessonPage() {
  const { lessonId } = useParams();
  const module = lessonId ? getLessonModule(lessonId) : undefined;
  const { isLoading, getLessonPhase, setLessonPhase, completeLesson, answerQuestion } = useProgress();

  if (!module) {
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
    return <LoadingScreen />;
  }

  // Resume position is read once here; LessonSession captures it on mount so a
  // mid-lesson phase change does not bounce the learner back to the start.
  const { phase, within } = getLessonPhase(module.lessonId);

  return (
    <LessonSession
      module={module}
      initialPhase={phase}
      initialWithin={within}
      onPhaseChange={(nextPhase, nextWithin) => setLessonPhase(module.lessonId, nextPhase, nextWithin)}
      onLessonComplete={() => completeLesson(module.lessonId)}
      onQuestionAnswered={(stepNumber) => answerQuestion(module.lessonId, stepNumber)}
    />
  );
}
