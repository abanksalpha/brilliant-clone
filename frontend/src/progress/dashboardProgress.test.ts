import { describe, expect, it } from 'vitest';
import {
  EMPTY_PROGRESS,
  XP_PER_LESSON,
  XP_PER_QUESTION,
  markLessonCompleted,
  markQuestionAnswered,
  normalizeProgress,
  xpEarnedToday,
} from './dashboardProgress';

const FIXED_NOW = new Date('2026-06-23T15:00:00');
const STAMP = '2026-06-23';

describe('daily XP', () => {
  it('records daily XP for newly answered questions and never double-counts', () => {
    const first = markQuestionAnswered(EMPTY_PROGRESS, 'coulombs-law', 7, FIXED_NOW);
    expect(first.awardedXp).toBe(XP_PER_QUESTION);
    expect(xpEarnedToday(first.nextProgress, FIXED_NOW)).toBe(XP_PER_QUESTION);

    const repeat = markQuestionAnswered(first.nextProgress, 'coulombs-law', 7, FIXED_NOW);
    expect(repeat.awardedXp).toBe(0);
    expect(xpEarnedToday(repeat.nextProgress, FIXED_NOW)).toBe(XP_PER_QUESTION);
  });

  it('adds lesson completion XP to the daily total', () => {
    const completed = markLessonCompleted(EMPTY_PROGRESS, 'coulombs-law', FIXED_NOW);
    expect(xpEarnedToday(completed, FIXED_NOW)).toBe(XP_PER_LESSON);
    expect(completed.dailyXp[STAMP]).toBe(XP_PER_LESSON);
  });
});

describe('normalizeProgress', () => {
  it('drops malformed daily XP entries when normalizing cloud data', () => {
    const restored = normalizeProgress({
      completedLessonIds: [],
      completionDates: {},
      lastOpenedLessonId: null,
      answeredQuestionIds: [],
      questionXp: 0,
      dailyXp: { [STAMP]: 30, bad: 'nope', negative: -5 },
    });

    expect(restored.dailyXp).toEqual({ [STAMP]: 30 });
  });

  it('returns empty progress for non-object input', () => {
    expect(normalizeProgress(null)).toEqual(EMPTY_PROGRESS);
    expect(normalizeProgress(undefined)).toEqual(EMPTY_PROGRESS);
    expect(normalizeProgress('nope')).toEqual(EMPTY_PROGRESS);
  });
});
