import type { Choice, InteractiveStep, Lesson, Step } from '../../content';

export type LearnerChoice = {
  id: string;
  text: string;
  correct: boolean;
};

export type LearnerStep = {
  body?: string;
  choices: LearnerChoice[];
  explanation?: string;
  feedback?: {
    correct?: string;
    wrong: Array<{
      choiceIds: string[];
      text: string;
    }>;
  };
  id: string;
  interactionKind: 'choice' | 'match' | 'observe';
  prompt: string;
};

export function toLearnerStep(lesson: Lesson, step: Step): LearnerStep {
  const prompt = step.type === 'interactive' ? sanitizeCopy(step.prompt) : '';
  const body = step.type === 'concept' ? sanitizeCopy(step.body) : undefined;

  return {
    body,
    choices: step.type === 'interactive' ? mapChoices(step.choices) : [],
    explanation: sanitizeOptional(step.explanation),
    feedback: step.type === 'interactive' ? mapFeedback(step) : undefined,
    id: `${lesson.lessonId}-${step.stepNumber}`,
    interactionKind: getInteractionKind(step),
    prompt,
  };
}

export function getWrongFeedback(step: LearnerStep, choiceId: string) {
  const matchingFeedback = step.feedback?.wrong.find((feedback) => (
    feedback.choiceIds.includes(choiceId)
  ));

  return matchingFeedback?.text ?? step.feedback?.wrong[0]?.text ?? 'Try the scene again and watch what changes.';
}

function mapChoices(choices: Choice[] | undefined): LearnerChoice[] {
  return (choices ?? []).map((choice) => ({
    correct: choice.correct,
    id: choice.id,
    text: sanitizeCopy(choice.text),
  }));
}

function mapFeedback(step: InteractiveStep): LearnerStep['feedback'] {
  return {
    correct: sanitizeOptional(step.feedback.correct),
    wrong: step.feedback.wrong.map((feedback) => ({
      choiceIds: extractChoiceIds(feedback.label),
      text: sanitizeCopy(feedback.text),
    })),
  };
}

function extractChoiceIds(label: string | undefined) {
  if (!label) return [];

  const parenthesized = label.match(/\(([^)]+)\)/)?.[1] ?? '';
  const ids = parenthesized
    .split(/\s+or\s+|,\s*|\s+/)
    .map((id) => id.trim().replace(/[^A-Z]/g, ''))
    .filter(Boolean);

  return ids;
}

function getInteractionKind(step: Step): LearnerStep['interactionKind'] {
  if (step.type === 'concept') return 'observe';
  if (step.interactionType === 'drag-to-match' || step.correctMatches?.length) return 'match';
  if (step.choices?.length) return 'choice';

  return 'observe';
}

function sanitizeOptional(text: string | undefined) {
  return text ? sanitizeCopy(text) : undefined;
}

export function sanitizeCopy(text: string) {
  return text
    .replace(/\bIn Lesson \d+\b/g, 'Earlier')
    .replace(/\bfrom Lesson \d+\b/g, 'from earlier')
    .replace(/\bLesson \d+\b/g, 'this topic')
    .replace(/\bSteps? \d+(?: and \d+)?\b/g, 'the earlier experiment')
    .replace(/\s*->\s*/g, '')
    .trim();
}
