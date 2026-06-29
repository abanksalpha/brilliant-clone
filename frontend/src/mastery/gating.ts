// Pure lesson gating. Decides whether a lesson is accessible based on whether
// the prior lesson's misconceptions are mastered, with a peek-ahead bypass and
// an always-open first lesson. Deterministic: the caller passes `now` so there
// is no hidden clock read, no Math.random, and no global state.

import { isLessonMastered } from './masteryModel';
import type { MasteryMap, ProblemRef } from './types';

export type LessonGate = {
  unlocked: boolean;
  mastered: boolean;
  reason: 'first' | 'mastered' | 'peek' | 'locked';
};

/**
 * Resolve access to a lesson.
 *
 *   - The first lesson is always unlocked (reason 'first').
 *   - Otherwise a peek-ahead request unlocks it (reason 'peek').
 *   - Otherwise access depends on whether the prior lesson is mastered: unlocked
 *     mirrors mastery (reason 'mastered' when true, 'locked' when false).
 *
 * `mastered` always reports the true mastery state of the prior lesson's
 * problems, independent of why the lesson is unlocked, so a peeked-into lesson
 * still surfaces that the prior work is not yet finished.
 */
export function canAccessLesson(params: {
  masteryMap: MasteryMap;
  priorLessonProblems: ProblemRef[];
  isFirstLesson: boolean;
  peekAhead: boolean;
  now: Date;
}): LessonGate {
  const { masteryMap, priorLessonProblems, isFirstLesson, peekAhead, now } = params;
  const mastered = isLessonMastered(masteryMap, priorLessonProblems, now);

  if (isFirstLesson) {
    return { unlocked: true, mastered, reason: 'first' };
  }

  if (peekAhead) {
    return { unlocked: true, mastered, reason: 'peek' };
  }

  return { unlocked: mastered, mastered, reason: mastered ? 'mastered' : 'locked' };
}
