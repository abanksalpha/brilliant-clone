import lesson1 from './lessons/lesson1.json';
import type { Lesson } from './schema';

export type {
  BuildFormulaConfig,
  BuildFormulaPiece,
  Choice,
  ConceptStep,
  Feedback,
  InteractionType,
  InteractiveStep,
  Lesson,
  LessonCounts,
  NumericConfig,
  SandboxCharge,
  SandboxConfig,
  Step,
  StepType,
  VectorAimConfig,
  VisualConfig,
} from './schema';

const lessons = [lesson1] as Lesson[];

export function getCourseLessons(): Lesson[] {
  return [...lessons].sort((a, b) => a.lessonNumber - b.lessonNumber);
}

export function getLessonById(lessonId: string): Lesson | undefined {
  return lessons.find((lesson) => lesson.lessonId === lessonId);
}
