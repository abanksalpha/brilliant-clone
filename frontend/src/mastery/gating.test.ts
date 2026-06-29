import { describe, expect, it } from 'vitest';
import { canAccessLesson } from './gating';
import type { MasteryMap, MisconceptionMastery, ProblemRef } from './types';

const now = new Date('2026-01-01T00:00:00.000Z');

function masteredEntry(): MisconceptionMastery {
  return { caught: 3, missed: 0, lastSeenISO: now.toISOString(), strength: 1 };
}

function weakEntry(): MisconceptionMastery {
  return { caught: 0, missed: 2, lastSeenISO: now.toISOString(), strength: 0.1 };
}

const priorProblems: ProblemRef[] = [
  { problemId: 'p1', lessonId: 'L1', misconceptionTags: ['a', 'b'], difficulty: 1 },
  { problemId: 'p2', lessonId: 'L1', misconceptionTags: ['b'], difficulty: 2 },
];

describe('canAccessLesson', () => {
  it('unlocks the first lesson when there is nothing prior', () => {
    const gate = canAccessLesson({
      masteryMap: {},
      priorLessonProblems: [],
      isFirstLesson: true,
      peekAhead: false,
      now,
    });

    expect(gate.unlocked).toBe(true);
    expect(gate.reason).toBe('first');
  });

  it('unlocks the first lesson regardless of mastery of the prior problems', () => {
    const gate = canAccessLesson({
      masteryMap: { a: weakEntry(), b: weakEntry() },
      priorLessonProblems: priorProblems,
      isFirstLesson: true,
      peekAhead: false,
      now,
    });

    expect(gate.unlocked).toBe(true);
    expect(gate.reason).toBe('first');
  });

  it('peekAhead overrides a locked state', () => {
    const map: MasteryMap = { a: masteredEntry(), b: weakEntry() };

    const gate = canAccessLesson({
      masteryMap: map,
      priorLessonProblems: priorProblems,
      isFirstLesson: false,
      peekAhead: true,
      now,
    });

    expect(gate.unlocked).toBe(true);
    expect(gate.reason).toBe('peek');
    // peek bypasses the gate but reports the true (not yet mastered) state.
    expect(gate.mastered).toBe(false);
  });

  it('locks a later lesson when the prior lesson is not mastered', () => {
    const map: MasteryMap = { a: masteredEntry(), b: weakEntry() };

    const gate = canAccessLesson({
      masteryMap: map,
      priorLessonProblems: priorProblems,
      isFirstLesson: false,
      peekAhead: false,
      now,
    });

    expect(gate).toEqual({ unlocked: false, mastered: false, reason: 'locked' });
  });

  it('unlocks a later lesson when the prior lesson is mastered', () => {
    const map: MasteryMap = { a: masteredEntry(), b: masteredEntry() };

    const gate = canAccessLesson({
      masteryMap: map,
      priorLessonProblems: priorProblems,
      isFirstLesson: false,
      peekAhead: false,
      now,
    });

    expect(gate).toEqual({ unlocked: true, mastered: true, reason: 'mastered' });
  });
});
