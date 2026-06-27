import { describe, expect, it } from 'vitest';
import {
  DAILY_XP_GOAL,
  EMPTY_PROGRESS,
  XP_PER_LESSON,
  XP_PER_QUESTION,
  calculateStreakDays,
  markLessonCompleted,
  markProblemSetComplete,
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

  it('accumulates question and lesson XP into the same local day', () => {
    const q1 = markQuestionAnswered(EMPTY_PROGRESS, 'coulombs-law', 1, FIXED_NOW);
    const q2 = markQuestionAnswered(q1.nextProgress, 'coulombs-law', 2, FIXED_NOW);
    const completed = markLessonCompleted(q2.nextProgress, 'coulombs-law', FIXED_NOW);
    expect(completed.questionXp).toBe(XP_PER_QUESTION * 2);
    expect(xpEarnedToday(completed, FIXED_NOW)).toBe(XP_PER_QUESTION * 2 + XP_PER_LESSON);
  });

  it('reports zero XP earned on a day with no awards', () => {
    const completed = markLessonCompleted(EMPTY_PROGRESS, 'coulombs-law', FIXED_NOW);
    const nextDay = new Date('2026-06-24T09:00:00');
    expect(xpEarnedToday(completed, nextDay)).toBe(0);
  });
});

describe('problem-set completion', () => {
  it('marks a live set complete, is idempotent, and ignores unknown ids', () => {
    const first = markProblemSetComplete(EMPTY_PROGRESS, 'coulombs-law');
    expect(first.completedProblemSetIds).toEqual(['coulombs-law']);

    // Idempotent: a second mark returns the same object (no duplicate, no churn).
    expect(markProblemSetComplete(first, 'coulombs-law')).toBe(first);

    // A non-live id is never recorded.
    expect(markProblemSetComplete(EMPTY_PROGRESS, 'not-a-lesson').completedProblemSetIds).toEqual([]);
  });

  it('preserves completedProblemSetIds when a lesson is completed', () => {
    // Data-loss guard: markLessonCompleted builds its result explicitly, so the
    // new field must survive lesson completion rather than being dropped.
    const withSet = markProblemSetComplete(EMPTY_PROGRESS, 'coulombs-law');
    const completed = markLessonCompleted(withSet, 'coulombs-law', FIXED_NOW);
    expect(completed.completedProblemSetIds).toEqual(['coulombs-law']);
  });

  it('normalizes completedProblemSetIds: defaults empty, keeps live ids, drops junk, dedupes', () => {
    expect(normalizeProgress({}).completedProblemSetIds).toEqual([]);

    const normalized = normalizeProgress({
      completedProblemSetIds: ['coulombs-law', 'coulombs-law', 'made-up-id', 42, null],
    }).completedProblemSetIds;
    expect(normalized).toEqual(['coulombs-law']);
  });
});

describe('calculateStreakDays', () => {
  // Noon avoids any local-date rollover, so toLocalDateStamp(NOW) resolves to this
  // calendar date in every timezone the suite might run in.
  const NOW = new Date('2026-06-23T12:00:00');

  // Build the progress slice the streak reads. `completions` are days a lesson was
  // finished; `goalDays` reached the XP goal; `shortDays` earned XP below the goal.
  function streakInput(opts: {
    completions?: string[];
    goalDays?: string[];
    shortDays?: string[];
  }): { completionDates: Record<string, string>; dailyXp: Record<string, number> } {
    const completionDates = Object.fromEntries(
      (opts.completions ?? []).map((stamp, index) => [`lesson-${index}`, stamp]),
    );
    const dailyXp: Record<string, number> = {};
    for (const day of opts.goalDays ?? []) dailyXp[day] = DAILY_XP_GOAL;
    for (const day of opts.shortDays ?? []) dailyXp[day] = DAILY_XP_GOAL - 1;
    return { completionDates, dailyXp };
  }

  function fromCompletions(...stamps: string[]) {
    return streakInput({ completions: stamps });
  }

  it('is zero with no qualifying days', () => {
    expect(calculateStreakDays(streakInput({}), NOW)).toBe(0);
  });

  it('counts a single completion made today', () => {
    expect(calculateStreakDays(fromCompletions('2026-06-23'), NOW)).toBe(1);
  });

  it('keeps a one-day streak alive when the latest completion was yesterday', () => {
    expect(calculateStreakDays(fromCompletions('2026-06-22'), NOW)).toBe(1);
  });

  it('resets to zero once the latest completion is two or more days old', () => {
    expect(calculateStreakDays(fromCompletions('2026-06-21'), NOW)).toBe(0);
    expect(calculateStreakDays(fromCompletions('2026-06-20'), NOW)).toBe(0);
  });

  it('counts consecutive days ending today or yesterday', () => {
    expect(calculateStreakDays(fromCompletions('2026-06-22', '2026-06-23'), NOW)).toBe(2);
    expect(calculateStreakDays(fromCompletions('2026-06-21', '2026-06-22', '2026-06-23'), NOW)).toBe(3);
    // Ending yesterday still counts: today is grace, not required.
    expect(calculateStreakDays(fromCompletions('2026-06-21', '2026-06-22'), NOW)).toBe(2);
  });

  it('stops at the first gap, counting back from the latest qualifying day', () => {
    // Today and two days ago, missing yesterday: only the latest day counts.
    expect(calculateStreakDays(fromCompletions('2026-06-21', '2026-06-23'), NOW)).toBe(1);
    // A longer run with an older gap counts only the recent unbroken tail.
    expect(
      calculateStreakDays(fromCompletions('2026-06-18', '2026-06-21', '2026-06-22', '2026-06-23'), NOW),
    ).toBe(3);
  });

  it('counts two lessons finished on the same day as one streak day', () => {
    expect(calculateStreakDays(fromCompletions('2026-06-23', '2026-06-23'), NOW)).toBe(1);
  });

  it('is order independent (dates are sorted internally)', () => {
    expect(calculateStreakDays(fromCompletions('2026-06-23', '2026-06-21', '2026-06-22'), NOW)).toBe(3);
  });

  it('counts a day that reached the XP goal even without a completion', () => {
    expect(calculateStreakDays(streakInput({ goalDays: ['2026-06-23'] }), NOW)).toBe(1);
  });

  it('counts consecutive goal days, with yesterday grace', () => {
    expect(calculateStreakDays(streakInput({ goalDays: ['2026-06-22', '2026-06-23'] }), NOW)).toBe(2);
    expect(calculateStreakDays(streakInput({ goalDays: ['2026-06-21', '2026-06-22'] }), NOW)).toBe(2);
  });

  it('does not count a day whose XP fell short of the goal', () => {
    expect(calculateStreakDays(streakInput({ shortDays: ['2026-06-23'] }), NOW)).toBe(0);
    // A short day also cannot bridge two completion days.
    expect(
      calculateStreakDays(
        streakInput({ completions: ['2026-06-21', '2026-06-23'], shortDays: ['2026-06-22'] }),
        NOW,
      ),
    ).toBe(1);
  });

  it('bridges a gap between completion days with a goal day', () => {
    // Completed today and two days ago, with only the XP goal hit yesterday: the
    // goal day fills the gap so all three days are consecutive.
    expect(
      calculateStreakDays(
        streakInput({ completions: ['2026-06-21', '2026-06-23'], goalDays: ['2026-06-22'] }),
        NOW,
      ),
    ).toBe(3);
  });

  it('merges a completion and a goal hit on the same day into one streak day', () => {
    expect(
      calculateStreakDays(
        streakInput({ completions: ['2026-06-23'], goalDays: ['2026-06-23'] }),
        NOW,
      ),
    ).toBe(1);
  });

  it('counts correctly across a month boundary', () => {
    const now = new Date('2026-02-01T12:00:00');
    expect(calculateStreakDays(fromCompletions('2026-01-31', '2026-02-01'), now)).toBe(2);
  });

  it('counts correctly across a year boundary', () => {
    const now = new Date('2026-01-01T12:00:00');
    expect(calculateStreakDays(fromCompletions('2025-12-31', '2026-01-01'), now)).toBe(2);
  });

  it('counts consecutive days across the spring-forward DST boundary', () => {
    // US clocks spring forward on 2026-03-08, making that local day 23 hours. A
    // milliseconds-per-day count reads 03-08 -> 03-09 as zero days and breaks the
    // streak; calendar-day math keeps all three days consecutive in any timezone.
    const now = new Date('2026-03-09T12:00:00');
    expect(calculateStreakDays(fromCompletions('2026-03-07', '2026-03-08', '2026-03-09'), now)).toBe(3);
  });

  it('resets across DST when the latest completion is two calendar days old', () => {
    // 03-07 is two calendar days before 03-09 even though only 47 wall-clock hours
    // separate them in a spring-forward timezone.
    const now = new Date('2026-03-09T12:00:00');
    expect(calculateStreakDays(fromCompletions('2026-03-07'), now)).toBe(0);
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

describe('mastery persistence', () => {
  it('exposes empty mastery maps on EMPTY_PROGRESS', () => {
    expect(EMPTY_PROGRESS.misconceptions).toEqual({});
    expect(EMPTY_PROGRESS.problemAttempts).toEqual({});
  });

  it('round-trips misconceptions and problemAttempts through normalizeProgress', () => {
    const misconceptions = {
      'sign-error': { caught: 3, missed: 1, lastSeenISO: '2026-06-20T10:00:00.000Z', strength: 0.82 },
      'vector-direction': { caught: 0, missed: 2, lastSeenISO: '2026-06-19T08:00:00.000Z', strength: 0.21 },
    };
    const problemAttempts = {
      'cl-field-point-charge': { attempts: 2, solvedISO: '2026-06-21T09:30:00.000Z', hintsUsed: 1 },
      'cl-two-charge-superposition': { attempts: 1, hintsUsed: 0 },
    };

    const restored = normalizeProgress({
      ...EMPTY_PROGRESS,
      misconceptions,
      problemAttempts,
    });

    expect(restored.misconceptions).toEqual(misconceptions);
    expect(restored.problemAttempts).toEqual(problemAttempts);
  });

  it('defaults misconceptions and problemAttempts to empty maps for legacy docs', () => {
    const restored = normalizeProgress({
      completedLessonIds: [],
      completionDates: {},
      lastOpenedLessonId: null,
      answeredQuestionIds: [],
      questionXp: 0,
      dailyXp: {},
    });

    expect(restored.misconceptions).toEqual({});
    expect(restored.problemAttempts).toEqual({});
  });

  it('drops malformed misconception and problemAttempt entries', () => {
    const restored = normalizeProgress({
      ...EMPTY_PROGRESS,
      misconceptions: {
        valid: { caught: 1, missed: 0, lastSeenISO: '2026-06-20T10:00:00.000Z', strength: 0.5 },
        missingStrength: { caught: 1, missed: 0, lastSeenISO: '2026-06-20T10:00:00.000Z' },
        badNumber: { caught: 'x', missed: 0, lastSeenISO: '2026-06-20T10:00:00.000Z', strength: 0.5 },
        badTimestamp: { caught: 1, missed: 0, lastSeenISO: 1, strength: 0.5 },
        notAnObject: 7,
      },
      problemAttempts: {
        valid: { attempts: 2, solvedISO: '2026-06-21T09:30:00.000Z', hintsUsed: 1 },
        validNoSolved: { attempts: 1, hintsUsed: 0 },
        badSolved: { attempts: 1, hintsUsed: 0, solvedISO: 5 },
        badAttempts: { attempts: 'nope', hintsUsed: 0 },
        notAnObject: 'x',
      },
    });

    expect(restored.misconceptions).toEqual({
      valid: { caught: 1, missed: 0, lastSeenISO: '2026-06-20T10:00:00.000Z', strength: 0.5 },
    });
    expect(restored.problemAttempts).toEqual({
      valid: { attempts: 2, solvedISO: '2026-06-21T09:30:00.000Z', hintsUsed: 1 },
      validNoSolved: { attempts: 1, hintsUsed: 0 },
    });
  });

  it('defaults to empty maps when the fields are present but not objects', () => {
    const restored = normalizeProgress({
      ...EMPTY_PROGRESS,
      misconceptions: 'nope',
      problemAttempts: 42,
    });

    expect(restored.misconceptions).toEqual({});
    expect(restored.problemAttempts).toEqual({});
  });
});

describe('misconception graph persistence', () => {
  const validNode = {
    id: 'mc:1a2b3c4d',
    status: 'tracked',
    principleId: 'coulomb-superposition',
    wrongBelief: 'adds-field-magnitudes-as-scalars',
    specificNote: 'Summed the two field magnitudes instead of adding the vectors.',
    caught: 2,
    missed: 3,
    strength: 0.61,
    lastSeenISO: '2026-06-22T14:00:00.000Z',
    caughtDayStamps: ['2026-06-18', '2026-06-20', '2026-06-22'],
    createdISO: '2026-06-15T09:00:00.000Z',
  };

  it('exposes an empty misconception graph on EMPTY_PROGRESS', () => {
    expect(EMPTY_PROGRESS.misconceptionGraph).toEqual({});
  });

  it('round-trips a misconception graph node through normalizeProgress', () => {
    const misconceptionGraph = { [validNode.id]: validNode };

    const restored = normalizeProgress({ ...EMPTY_PROGRESS, misconceptionGraph });

    expect(restored.misconceptionGraph).toEqual(misconceptionGraph);
  });

  it('defaults the misconception graph to an empty map for legacy docs', () => {
    const restored = normalizeProgress({
      completedLessonIds: [],
      completionDates: {},
      lastOpenedLessonId: null,
      answeredQuestionIds: [],
      questionXp: 0,
      dailyXp: {},
    });

    expect(restored.misconceptionGraph).toEqual({});
  });

  it('drops malformed misconception graph node entries', () => {
    const restored = normalizeProgress({
      ...EMPTY_PROGRESS,
      misconceptionGraph: {
        valid: validNode,
        badStatus: { ...validNode, status: 'archived' },
        missingPrinciple: { ...validNode, principleId: undefined },
        badNumber: { ...validNode, strength: 'high' },
        badStamps: { ...validNode, caughtDayStamps: 'nope' },
        nonStringStamp: { ...validNode, caughtDayStamps: ['2026-06-18', 7] },
        notAnObject: 9,
      },
    });

    expect(restored.misconceptionGraph).toEqual({ valid: validNode });
  });

  it('defaults to an empty map when misconceptionGraph is present but not an object', () => {
    const restored = normalizeProgress({ ...EMPTY_PROGRESS, misconceptionGraph: 'nope' });

    expect(restored.misconceptionGraph).toEqual({});
  });
});
