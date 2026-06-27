import { useParams } from 'react-router-dom';
import { CHARGING_LESSON_ID, ChargingExperience } from '../components/lesson/ChargingExperience';
import { COULOMB_LESSON_ID, CoulombExperience } from '../components/lesson/CoulombExperience';
import { toLearnerStep } from '../components/lesson/lessonExperience';
import { getLessonById } from '../content';

// DEV-only isolated renderer for a single lesson step, used to screenshot and
// verify each scene without auth or progress. Reachable at
// /dev/scene/:lessonId/:step, or /dev/charging/:step (defaults to charging).
export function DevSceneGalleryPage() {
  const { lessonId: lessonIdParam, step: stepParam } = useParams();
  const lessonId = lessonIdParam ?? CHARGING_LESSON_ID;
  const lesson = getLessonById(lessonId);
  const stepNumber = Number(stepParam);
  const rawStep = lesson?.steps.find((candidate) => candidate.stepNumber === stepNumber);

  if (!lesson || !rawStep) {
    return (
      <main className="lesson-shell theme-handdrawn theme-handdrawn--lesson">
        <section className="panel lesson-missing">
          <p className="eyebrow">Scene gallery</p>
          <h1>Scene not found</h1>
          <p>Pick a step from 1 to {lesson?.steps.length ?? 26}.</p>
        </section>
      </main>
    );
  }

  const learnerStep = toLearnerStep(lesson, rawStep);
  const Experience = lesson.lessonId === COULOMB_LESSON_ID ? CoulombExperience : ChargingExperience;

  return (
    <main className="lesson-shell theme-handdrawn theme-handdrawn--lesson">
      <Experience step={rawStep} learnerStep={learnerStep} isFinalStep={false} onContinue={() => {}} />
    </main>
  );
}
