import { describe, expect, it } from 'vitest';
import { selectAdaptiveQuiz, selectPostLessonSet } from './selectProblems';
import type { MasteryMap, MisconceptionMastery, ProblemRef } from './types';

const now = new Date('2026-01-01T00:00:00.000Z');

function ids(problems: ProblemRef[]): string[] {
  return problems.map((problem) => problem.problemId);
}

function strongEntry(): MisconceptionMastery {
  return { caught: 5, missed: 0, lastSeenISO: now.toISOString(), strength: 1 };
}

function weakEntry(): MisconceptionMastery {
  return { caught: 0, missed: 3, lastSeenISO: now.toISOString(), strength: 0.2 };
}

describe('selectPostLessonSet', () => {
  it('keeps only the lesson and orders by difficulty ascending', () => {
    const problems: ProblemRef[] = [
      { problemId: 'p1', lessonId: 'L1', misconceptionTags: [], difficulty: 3 },
      { problemId: 'p2', lessonId: 'L2', misconceptionTags: [], difficulty: 1 },
      { problemId: 'p3', lessonId: 'L1', misconceptionTags: [], difficulty: 1 },
      { problemId: 'p4', lessonId: 'L1', misconceptionTags: [], difficulty: 2 },
      { problemId: 'p5', lessonId: 'L1', misconceptionTags: [], difficulty: 1 },
    ];

    const set = selectPostLessonSet('L1', problems);

    // L2 dropped; difficulty asc; p3 before p5 preserves input order on the tie
    expect(ids(set)).toEqual(['p3', 'p5', 'p4', 'p1']);
  });

  it('returns an empty list when no problem matches the lesson', () => {
    const problems: ProblemRef[] = [
      { problemId: 'p1', lessonId: 'L2', misconceptionTags: [], difficulty: 1 },
    ];

    expect(selectPostLessonSet('L1', problems)).toEqual([]);
  });
});

describe('selectAdaptiveQuiz', () => {
  it('prioritizes problems whose misconceptions have low or no strength', () => {
    const problems: ProblemRef[] = [
      { problemId: 'known', lessonId: 'L1', misconceptionTags: ['known'], difficulty: 1 },
      { problemId: 'weak', lessonId: 'L1', misconceptionTags: ['weak'], difficulty: 1 },
      { problemId: 'unseen', lessonId: 'L1', misconceptionTags: ['unseen'], difficulty: 1 },
    ];
    const map: MasteryMap = { known: strongEntry(), weak: weakEntry() };

    const quiz = selectAdaptiveQuiz(problems, map, 3, now);

    // unseen (strength 0) first, then weak (strength 0.2), then known (strength 1)
    expect(ids(quiz)).toEqual(['unseen', 'weak', 'known']);
  });

  it('respects the requested count', () => {
    const problems: ProblemRef[] = [
      { problemId: 'known', lessonId: 'L1', misconceptionTags: ['known'], difficulty: 1 },
      { problemId: 'weak', lessonId: 'L1', misconceptionTags: ['weak'], difficulty: 1 },
      { problemId: 'unseen', lessonId: 'L1', misconceptionTags: ['unseen'], difficulty: 1 },
    ];
    const map: MasteryMap = { known: strongEntry(), weak: weakEntry() };

    const quiz = selectAdaptiveQuiz(problems, map, 2, now);

    expect(quiz).toHaveLength(2);
    expect(ids(quiz)).toEqual(['unseen', 'weak']);
  });

  it('interleaves so consecutive problems avoid sharing a tag when alternatives exist', () => {
    const problems: ProblemRef[] = [
      { problemId: 'a1', lessonId: 'L1', misconceptionTags: ['a'], difficulty: 1 },
      { problemId: 'a2', lessonId: 'L1', misconceptionTags: ['a'], difficulty: 2 },
      { problemId: 'b1', lessonId: 'L1', misconceptionTags: ['b'], difficulty: 3 },
    ];
    const map: MasteryMap = {}; // all tags unseen, equal top priority

    const quiz = selectAdaptiveQuiz(problems, map, 3, now);

    // naive priority order is [a1, a2, b1] (a1 and a2 adjacent); interleave fixes it
    expect(quiz).toHaveLength(3);
    expect(ids(quiz)).toEqual(['a1', 'b1', 'a2']);
    for (let i = 1; i < quiz.length; i += 1) {
      const shared = quiz[i].misconceptionTags.some((tag) =>
        quiz[i - 1].misconceptionTags.includes(tag),
      );
      expect(shared).toBe(false);
    }
  });

  it('keeps priority order when no alternative tag is available', () => {
    const problems: ProblemRef[] = [
      { problemId: 'a1', lessonId: 'L1', misconceptionTags: ['a'], difficulty: 1 },
      { problemId: 'a2', lessonId: 'L1', misconceptionTags: ['a'], difficulty: 2 },
    ];
    const map: MasteryMap = {};

    const quiz = selectAdaptiveQuiz(problems, map, 2, now);

    // both share tag a, no alternative, so they stay in priority order
    expect(ids(quiz)).toEqual(['a1', 'a2']);
  });

  it('returns an empty list for a non positive count', () => {
    const problems: ProblemRef[] = [
      { problemId: 'a1', lessonId: 'L1', misconceptionTags: ['a'], difficulty: 1 },
    ];

    expect(selectAdaptiveQuiz(problems, {}, 0, now)).toEqual([]);
  });
});
