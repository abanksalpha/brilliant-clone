import { getCourseLessons, getLessonById, type InteractiveStep } from './index';

const expectedLessons = [
  {
    lessonId: 'coulombs-law',
    lessonNumber: 1,
    title: "Coulomb's Law",
    counts: { totalSteps: 27, interactiveProblems: 16, conceptCards: 11 },
    prerequisites: [],
  },
  {
    lessonId: 'charging-conductors-insulators',
    lessonNumber: 2,
    title: 'Charging, Conductors & Insulators',
    counts: { totalSteps: 26, interactiveProblems: 15, conceptCards: 11 },
    prerequisites: ['coulombs-law'],
  },
];

const KNOWN_INTERACTION_TYPES = new Set([
  'drag',
  'drag-rotate',
  'drag-to-match',
  'multiple-choice',
  'slider',
  'tap',
  'numeric',
  'sandbox',
  'build-formula',
  'vector-aim',
  'ordering',
]);

function getInteractiveSteps(lesson: ReturnType<typeof getCourseLessons>[number]): InteractiveStep[] {
  return lesson.steps.filter((step): step is InteractiveStep => step.type === 'interactive');
}

describe('lesson content loader', () => {
  it('returns the Coulomb lesson', () => {
    const lessons = getCourseLessons();

    expect(lessons).toHaveLength(2);
    expect(lessons.map((lesson) => lesson.lessonId)).toEqual(
      expectedLessons.map((lesson) => lesson.lessonId),
    );
  });

  it('loads lessons by id', () => {
    for (const expectedLesson of expectedLessons) {
      expect(getLessonById(expectedLesson.lessonId)?.title).toBe(expectedLesson.title);
    }

    expect(getLessonById('missing-lesson')).toBeUndefined();
  });
});

describe('lesson content records', () => {
  it('match source titles, prerequisites, and counts', () => {
    const lessons = getCourseLessons();

    for (const expectedLesson of expectedLessons) {
      const lesson = getLessonById(expectedLesson.lessonId);
      const interactiveSteps = getInteractiveSteps(lesson!);
      const conceptSteps = lesson!.steps.filter((step) => step.type === 'concept');

      expect(lesson).toEqual(
        expect.objectContaining({
          lessonId: expectedLesson.lessonId,
          lessonNumber: expectedLesson.lessonNumber,
          title: expectedLesson.title,
          counts: expectedLesson.counts,
          prerequisites: expectedLesson.prerequisites,
        }),
      );
      expect(lessons[expectedLesson.lessonNumber - 1]).toBe(lesson);
      expect(lesson!.steps).toHaveLength(expectedLesson.counts.totalSteps);
      expect(interactiveSteps).toHaveLength(expectedLesson.counts.interactiveProblems);
      expect(conceptSteps).toHaveLength(expectedLesson.counts.conceptCards);
    }
  });

  it('gives every interactive step required prompt, feedback, and explanation fields', () => {
    for (const lesson of getCourseLessons()) {
      for (const step of getInteractiveSteps(lesson)) {
        expect(step.prompt, `${lesson.lessonId} step ${step.stepNumber} prompt`).not.toHaveLength(0);
        expect(
          step.interactionType,
          `${lesson.lessonId} step ${step.stepNumber} interaction type`,
        ).not.toHaveLength(0);
        expect(
          step.feedback.correct,
          `${lesson.lessonId} step ${step.stepNumber} correct feedback`,
        ).not.toHaveLength(0);
        expect(
          step.feedback.wrong.length,
          `${lesson.lessonId} step ${step.stepNumber} wrong feedback`,
        ).toBeGreaterThan(0);
        expect(
          step.explanation,
          `${lesson.lessonId} step ${step.stepNumber} explanation`,
        ).not.toHaveLength(0);
      }
    }
  });

  it('marks exactly one correct answer for every choice-based step', () => {
    for (const lesson of getCourseLessons()) {
      for (const step of getInteractiveSteps(lesson)) {
        if (!step.choices) continue;

        expect(
          step.choices.filter((choice) => choice.correct),
          `${lesson.lessonId} step ${step.stepNumber}`,
        ).toHaveLength(1);
      }
    }
  });

  it('uses known interaction types and ships the config each one needs', () => {
    for (const lesson of getCourseLessons()) {
      for (const step of getInteractiveSteps(lesson)) {
        const where = `${lesson.lessonId} step ${step.stepNumber}`;
        expect(KNOWN_INTERACTION_TYPES.has(step.interactionType), `${where} type`).toBe(true);

        if (step.interactionType === 'numeric') {
          expect(step.numeric, `${where} numeric config`).toBeDefined();
          expect(Number.isFinite(step.numeric!.answer), `${where} numeric answer`).toBe(true);
        }
        if (step.interactionType === 'sandbox') {
          expect(step.sandbox, `${where} sandbox config`).toBeDefined();
          expect(step.sandbox!.fixedCharges.length, `${where} sandbox charges`).toBeGreaterThan(0);
        }
        if (step.interactionType === 'build-formula') {
          expect(step.buildFormula, `${where} build-formula config`).toBeDefined();
          expect(step.buildFormula!.pieces.length, `${where} formula pieces`).toBeGreaterThan(0);
        }
        if (step.interactionType === 'vector-aim') {
          expect(step.vectorAim, `${where} vector-aim config`).toBeDefined();
          expect(Number.isFinite(step.vectorAim!.targetAngleDeg), `${where} target angle`).toBe(true);
        }
        if (step.interactionType === 'ordering') {
          expect(step.ordering, `${where} ordering config`).toBeDefined();
          expect(step.ordering!.items.length, `${where} ordering items`).toBeGreaterThan(1);
        }
      }
    }
  });
});
