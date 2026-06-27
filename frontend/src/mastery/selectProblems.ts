// Problem selection for cold post lesson sets and the adaptive quiz. Pure and
// deterministic: identical inputs always produce identical output, with no
// Math.random and no I/O. Ordering ties are broken by original input index so
// results are stable regardless of the engine sort implementation.

import { currentStrength } from './masteryModel';
import type { MasteryMap, ProblemRef } from './types';

type Scored = {
  problem: ProblemRef;
  index: number;
  priority: number;
};

function sharesTag(a: string[], b: string[]): boolean {
  return a.some((tag) => b.includes(tag));
}

/**
 * Cold post lesson set: the problems that belong to `lessonId`, ordered from
 * easiest to hardest. Ties keep their original input order (stable).
 */
export function selectPostLessonSet(lessonId: string, problems: ProblemRef[]): ProblemRef[] {
  return problems
    .map((problem, index) => ({ problem, index }))
    .filter((entry) => entry.problem.lessonId === lessonId)
    .sort((a, b) => a.problem.difficulty - b.problem.difficulty || a.index - b.index)
    .map((entry) => entry.problem);
}

/**
 * Priority of a problem: 1 minus the strength of its weakest tag. A tag with no
 * map entry counts as strength 0 (top priority). A problem with no tags has
 * nothing weak to remediate, so it is treated as strength 1 (priority 0).
 */
function priorityOf(problem: ProblemRef, map: MasteryMap, now: Date): number {
  if (problem.misconceptionTags.length === 0) return 0;

  let weakest = 1;
  for (const tag of problem.misconceptionTags) {
    const entry = map[tag];
    const strength = entry ? currentStrength(entry, now) : 0;
    if (strength < weakest) weakest = strength;
  }
  return 1 - weakest;
}

/**
 * Adaptive quiz: pick up to `count` problems that target the student's weakest
 * misconceptions, then order them so consecutive problems avoid sharing a tag
 * when an alternative exists.
 *
 * Steps:
 *   1. Score every problem by priority (weakest associated misconception).
 *   2. Sort by priority descending, then lower difficulty, then input order.
 *   3. Greedily build the sequence: at each step take the highest priority
 *      remaining problem that does not share a tag with the previous pick; if
 *      none avoids a shared tag, take the highest priority remaining one.
 *   4. Return the first `count` of that sequence. A non positive count yields [].
 */
export function selectAdaptiveQuiz(
  problems: ProblemRef[],
  map: MasteryMap,
  count: number,
  now: Date,
): ProblemRef[] {
  if (count <= 0) return [];

  const scored: Scored[] = problems.map((problem, index) => ({
    problem,
    index,
    priority: priorityOf(problem, map, now),
  }));

  scored.sort(
    (a, b) =>
      b.priority - a.priority ||
      a.problem.difficulty - b.problem.difficulty ||
      a.index - b.index,
  );

  const ordered: ProblemRef[] = [];
  const pool = scored.slice();
  let previousTags: string[] = [];

  while (pool.length > 0) {
    let pickIndex = 0;
    if (previousTags.length > 0) {
      const alternative = pool.findIndex(
        (entry) => !sharesTag(entry.problem.misconceptionTags, previousTags),
      );
      if (alternative !== -1) pickIndex = alternative;
    }

    const [chosen] = pool.splice(pickIndex, 1);
    ordered.push(chosen.problem);
    previousTags = chosen.problem.misconceptionTags;
  }

  return ordered.slice(0, count);
}
