import { describe, expect, it } from 'vitest';
import {
  DAILY_XP_GOAL,
  EMPTY_PROGRESS,
  XP_PER_LESSON,
  XP_PER_PROBLEM,
  XP_PER_QUESTION,
  awardProblemXp,
  calculateStreakDays,
  getLessonPhase,
  markLessonCompleted,
  markProblemSetComplete,
  markQuestionAnswered,
  normalizeProgress,
  setLessonPhase,
  xpEarnedToday,
  type DashboardProgress,
} from './dashboardProgress';

const FIXED_NOW = new Date('2026-06-23T15:00:00');
const STAMP = '2026-06-23';

describe('daily XP', () => {
  it('awards no XP for answering an in-lesson question (questions are instructional now)', () => {
    // Questions still record (dedup), but their XP was redistributed to problems.
    expect(XP_PER_QUESTION).toBe(0);
    const first = markQuestionAnswered(EMPTY_PROGRESS, 'coulombs-law', 7, FIXED_NOW);
    expect(first.awardedXp).toBe(0);
    expect(first.nextProgress.answeredQuestionIds).toContain('coulombs-law:7');
    expect(xpEarnedToday(first.nextProgress, FIXED_NOW)).toBe(0);
  });

  it('awards no XP for completing a lesson (the completion bonus was redistributed)', () => {
    expect(XP_PER_LESSON).toBe(0);
    const completed = markLessonCompleted(EMPTY_PROGRESS, 'coulombs-law', FIXED_NOW);
    expect(xpEarnedToday(completed, FIXED_NOW)).toBe(0);
  });

  it('reports zero XP earned on a day with no awards', () => {
    const completed = markLessonCompleted(EMPTY_PROGRESS, 'coulombs-law', FIXED_NOW);
    const nextDay = new Date('2026-06-24T09:00:00');
    expect(xpEarnedToday(completed, nextDay)).toBe(0);
  });
});

describe('per-problem XP', () => {
  // A full coulombs-law run: 3 Review + 2 Apply-completion + 6 Solve = 11 graded
  // problems, each paying XP_PER_PROBLEM on its first solve. The ids are
  // deliberately mixed (review, apply, and generated `syn:`) to prove the award
  // keys on arbitrary problem ids, not the `lessonId:step` question ledger.
  const FULL_LESSON_GRADED_IDS = [
    'coulombs-law:review:0',
    'coulombs-law:review:1',
    'coulombs-law:review:2',
    'coulombs-law:apply:0',
    'coulombs-law:apply:1',
    'syn:s1',
    'syn:s2',
    'syn:s3',
    'syn:s4',
    'syn:s5',
    'syn:s6',
  ];

  // Mirror recordProblemResult: award XP for the solve, then record the solve in
  // problemAttempts so the dedup sees the prior solved state on any re-solve.
  function solveProblem(progress: DashboardProgress, problemId: string, at = FIXED_NOW): DashboardProgress {
    const { nextProgress } = awardProblemXp(progress, problemId, true, at);
    return {
      ...nextProgress,
      problemAttempts: {
        ...nextProgress.problemAttempts,
        [problemId]: {
          attempts: (nextProgress.problemAttempts[problemId]?.attempts ?? 0) + 1,
          hintsUsed: nextProgress.problemAttempts[problemId]?.hintsUsed ?? 0,
          solvedISO: nextProgress.problemAttempts[problemId]?.solvedISO ?? at.toISOString(),
        },
      },
    };
  }

  it('is worth 50 XP', () => {
    expect(XP_PER_PROBLEM).toBe(50);
  });

  it('awards XP_PER_PROBLEM on a first solve, into both the running total and today', () => {
    const result = awardProblemXp(EMPTY_PROGRESS, 'cl-coulomb-force-ap', true, FIXED_NOW);
    expect(result.awardedXp).toBe(XP_PER_PROBLEM);
    expect(result.nextProgress.questionXp).toBe(XP_PER_PROBLEM);
    expect(result.nextProgress.dailyXp[STAMP]).toBe(XP_PER_PROBLEM);
  });

  it('awards nothing when the result is not a solve, returning the same object', () => {
    const result = awardProblemXp(EMPTY_PROGRESS, 'cl-coulomb-force-ap', false, FIXED_NOW);
    expect(result.awardedXp).toBe(0);
    expect(result.nextProgress).toBe(EMPTY_PROGRESS);
  });

  it('does not re-award XP when an already-solved problem is solved again', () => {
    const solved: DashboardProgress = {
      ...EMPTY_PROGRESS,
      problemAttempts: {
        'cl-coulomb-force-ap': { attempts: 1, hintsUsed: 0, solvedISO: '2026-06-23T10:00:00.000Z' },
      },
    };
    const result = awardProblemXp(solved, 'cl-coulomb-force-ap', true, FIXED_NOW);
    expect(result.awardedXp).toBe(0);
    expect(result.nextProgress).toBe(solved);
  });

  it('keys on arbitrary ids: a generated syn: id and a review id each earn their own award', () => {
    const first = awardProblemXp(EMPTY_PROGRESS, 'syn:1a2b3c4d', true, FIXED_NOW);
    expect(first.awardedXp).toBe(XP_PER_PROBLEM);
    const second = awardProblemXp(first.nextProgress, 'coulombs-law:review:0', true, FIXED_NOW);
    expect(second.awardedXp).toBe(XP_PER_PROBLEM);
    expect(second.nextProgress.questionXp).toBe(XP_PER_PROBLEM * 2);
    expect(second.nextProgress.dailyXp[STAMP]).toBe(XP_PER_PROBLEM * 2);
  });

  it('sums a full coulombs-law lesson (11 graded solves) to ~550 with no re-solve farming', () => {
    let progress: DashboardProgress = EMPTY_PROGRESS;
    for (const id of FULL_LESSON_GRADED_IDS) {
      progress = solveProblem(progress, id);
    }

    expect(FULL_LESSON_GRADED_IDS).toHaveLength(11);
    expect(progress.questionXp).toBe(550);
    expect(xpEarnedToday(progress, FIXED_NOW)).toBe(550);

    // Re-solving any problem in the set farms no extra XP.
    const reSolved = solveProblem(progress, 'syn:s1');
    expect(reSolved.questionXp).toBe(550);
    expect(xpEarnedToday(reSolved, FIXED_NOW)).toBe(550);

    // 550 clears the 500 daily goal, so the day counts toward the streak.
    expect(calculateStreakDays(reSolved, FIXED_NOW)).toBe(1);
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

  it('ignores qualifying days in the future (clock skew or tampered data)', () => {
    // A day after "today" must not anchor a streak on its own...
    expect(calculateStreakDays(fromCompletions('2026-06-24'), NOW)).toBe(0);
    expect(calculateStreakDays(streakInput({ goalDays: ['2026-06-24'] }), NOW)).toBe(0);
    // ...nor pad a real streak earned today.
    expect(calculateStreakDays(fromCompletions('2026-06-23', '2026-06-24'), NOW)).toBe(1);
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

describe('lesson phase position', () => {
  it('exposes an empty lessonPhase on EMPTY_PROGRESS', () => {
    expect(EMPTY_PROGRESS.lessonPhase).toEqual({});
  });

  it('defaults to the start for a lesson never opened', () => {
    expect(getLessonPhase(EMPTY_PROGRESS, 'coulombs-law')).toEqual({ phase: 0, within: 0 });
  });

  it('round-trips a saved phase through set then get', () => {
    const saved = setLessonPhase(EMPTY_PROGRESS, 'coulombs-law', 3, 2);
    expect(getLessonPhase(saved, 'coulombs-law')).toEqual({ phase: 3, within: 2 });
  });

  it('clamps phase to 0..4 and within to a non-negative integer', () => {
    const high = setLessonPhase(EMPTY_PROGRESS, 'coulombs-law', 9, -4);
    expect(getLessonPhase(high, 'coulombs-law')).toEqual({ phase: 4, within: 0 });

    const low = setLessonPhase(EMPTY_PROGRESS, 'coulombs-law', -1, 1.9);
    expect(getLessonPhase(low, 'coulombs-law')).toEqual({ phase: 0, within: 1 });
  });

  it('is idempotent: an unchanged position returns the same object', () => {
    const saved = setLessonPhase(EMPTY_PROGRESS, 'coulombs-law', 2, 1);
    expect(setLessonPhase(saved, 'coulombs-law', 2, 1)).toBe(saved);
  });

  it('preserves lessonPhase when a lesson is completed', () => {
    const withPhase = setLessonPhase(EMPTY_PROGRESS, 'coulombs-law', 4, 0);
    const completed = markLessonCompleted(withPhase, 'coulombs-law', FIXED_NOW);
    expect(completed.lessonPhase).toEqual({ 'coulombs-law': { phase: 4, within: 0 } });
  });

  it('normalizes lessonPhase: defaults empty, clamps, and drops malformed entries', () => {
    expect(normalizeProgress({}).lessonPhase).toEqual({});

    const normalized = normalizeProgress({
      lessonPhase: {
        'coulombs-law': { phase: 9, within: -2 },
        'charging-conductors-insulators': { phase: 2, within: 1 },
        bad: { phase: 'x', within: 0 },
        alsoBad: 7,
      },
    }).lessonPhase;

    expect(normalized).toEqual({
      'coulombs-law': { phase: 4, within: 0 },
      'charging-conductors-insulators': { phase: 2, within: 1 },
    });
  });
});

describe('generated set persistence', () => {
  // A cached generated problem carries the public Problem fields the builders
  // produce. The normalizer only requires problemId, prompt, title, and a finite
  // difficultyBand; the rest are kept verbatim, so a realistic shape round-trips.
  const generatedProblem = {
    problemId: 'syn:1a2b3c4d',
    lessonId: 'coulombs-law',
    unitId: 'electricity',
    skillIds: ['coulombs-law'],
    principleIds: ['coulomb-force', 'coulomb-superposition'],
    misconceptionTags: [],
    kind: 'synthesis',
    difficulty: 5,
    difficultyBand: 5,
    difficultyFeatures: { steps: 4, symbolic: false, calculus: false, multiPart: false, hasTrap: true },
    provenance: 'synthesis',
    title: 'Review: synthesis',
    prompt: 'Two point charges sit on the x axis; find the net force on a third.',
    gradeId: 'syn:1a2b3c4d',
    targetMisconceptionNodeIds: ['mc:1a2b3c4d'],
  };

  it('exposes an empty generatedSets on EMPTY_PROGRESS', () => {
    expect(EMPTY_PROGRESS.generatedSets).toEqual({});
  });

  it('round-trips a valid generated set through normalizeProgress', () => {
    const generatedSets = { 'coulombs-law:review': [generatedProblem] };

    const restored = normalizeProgress({ ...EMPTY_PROGRESS, generatedSets });

    expect(restored.generatedSets).toEqual(generatedSets);
  });

  it('round-trips a generated problem that carries a planSlotIndex', () => {
    const withSlot = { ...generatedProblem, planSlotIndex: 2 };
    const generatedSets = { 'coulombs-law:review:v8': [withSlot] };

    const restored = normalizeProgress({ ...EMPTY_PROGRESS, generatedSets });

    expect(restored.generatedSets['coulombs-law:review:v8']).toEqual([withSlot]);
    expect(restored.generatedSets['coulombs-law:review:v8'][0].planSlotIndex).toBe(2);
  });

  it('drops a generated set whose item has a present but non-integer planSlotIndex', () => {
    const restored = normalizeProgress({
      ...EMPTY_PROGRESS,
      generatedSets: {
        valid: [{ ...generatedProblem, planSlotIndex: 0 }],
        fractionalSlot: [{ ...generatedProblem, planSlotIndex: 1.5 }],
        stringSlot: [{ ...generatedProblem, planSlotIndex: 'two' }],
      },
    });

    expect(restored.generatedSets).toEqual({ valid: [{ ...generatedProblem, planSlotIndex: 0 }] });
  });

  it('drops malformed generated set entries: a non-array, or an array with a bad item', () => {
    const restored = normalizeProgress({
      ...EMPTY_PROGRESS,
      generatedSets: {
        valid: [generatedProblem],
        notAnArray: { problemId: 'syn:x', prompt: 'p', title: 't', difficultyBand: 4 },
        badBand: [{ problemId: 'syn:x', prompt: 'p', title: 't', difficultyBand: 'high' }],
        missingTitle: [{ problemId: 'syn:x', prompt: 'p', difficultyBand: 4 }],
        notAnObjectItem: ['nope'],
      },
    });

    expect(restored.generatedSets).toEqual({ valid: [generatedProblem] });
  });

  it('defaults generatedSets to an empty map for legacy docs and non-object input', () => {
    const legacy = normalizeProgress({
      completedLessonIds: [],
      completionDates: {},
      lastOpenedLessonId: null,
      answeredQuestionIds: [],
      questionXp: 0,
      dailyXp: {},
    });
    expect(legacy.generatedSets).toEqual({});

    expect(normalizeProgress({ ...EMPTY_PROGRESS, generatedSets: 'nope' }).generatedSets).toEqual({});
  });
});

describe('generated plan persistence', () => {
  // A cached plan carries the public ProblemPlan fields the planner produces. The
  // normalizer requires a finite slotIndex and string title/description; valid
  // entries are kept verbatim so a save then load round-trips exactly.
  const plan = [
    { slotIndex: 0, title: 'Net force from two charges', description: 'Two point charges on a line; find the net force.' },
    { slotIndex: 1, title: 'Charge at equilibrium', description: 'Place a third charge where the net force is zero.' },
  ];

  it('exposes an empty generatedPlans on EMPTY_PROGRESS', () => {
    expect(EMPTY_PROGRESS.generatedPlans).toEqual({});
  });

  it('round-trips a valid generated plan through normalizeProgress', () => {
    const generatedPlans = { 'coulombs-law:review:v6': plan };

    const restored = normalizeProgress({ ...EMPTY_PROGRESS, generatedPlans });

    expect(restored.generatedPlans).toEqual(generatedPlans);
  });

  it('survives serialize then normalize alongside its set, keyed the same', () => {
    const generatedPlans = { 'coulombs-law:solve:v6': plan };
    const restored = normalizeProgress({ ...EMPTY_PROGRESS, generatedPlans });
    expect(restored.generatedPlans['coulombs-law:solve:v6']).toEqual(plan);
  });

  it('drops malformed generated plan entries: a non-array, or an array with a bad item', () => {
    const restored = normalizeProgress({
      ...EMPTY_PROGRESS,
      generatedPlans: {
        valid: plan,
        notAnArray: { slotIndex: 0, title: 't', description: 'd' },
        badSlotIndex: [{ slotIndex: 'first', title: 't', description: 'd' }],
        missingDescription: [{ slotIndex: 0, title: 't' }],
        missingTitle: [{ slotIndex: 0, description: 'd' }],
        notAnObjectItem: ['nope'],
      },
    });

    expect(restored.generatedPlans).toEqual({ valid: plan });
  });

  it('defaults generatedPlans to an empty map for legacy docs and non-object input', () => {
    const legacy = normalizeProgress({
      completedLessonIds: [],
      completionDates: {},
      lastOpenedLessonId: null,
      answeredQuestionIds: [],
      questionXp: 0,
      dailyXp: {},
    });
    expect(legacy.generatedPlans).toEqual({});

    expect(normalizeProgress({ ...EMPTY_PROGRESS, generatedPlans: 'nope' }).generatedPlans).toEqual({});
  });
});
