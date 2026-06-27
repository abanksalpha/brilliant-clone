import lesson1 from './lessons/lesson1.json';
import lesson2 from './lessons/lesson2.json';
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
  OrderingConfig,
  OrderingItem,
  SandboxCharge,
  SandboxConfig,
  Step,
  StepType,
  VectorAimConfig,
  VisualConfig,
} from './schema';

const lessons = [lesson1, lesson2] as unknown as Lesson[];

export function getCourseLessons(): Lesson[] {
  return [...lessons].sort((a, b) => a.lessonNumber - b.lessonNumber);
}

export function getLessonById(lessonId: string): Lesson | undefined {
  return lessons.find((lesson) => lesson.lessonId === lessonId);
}
