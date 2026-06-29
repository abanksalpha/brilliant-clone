import { describe, expect, it } from 'vitest';
import {
  EMPTY_PROBLEM_SESSION_STATE,
  mergeProblemSetSession,
  normalizeProblemSessions,
  removeProblemSetSession,
  selectProblemSetSession,
  type ProblemSetSession,
} from './problemSessionProgress';

function sampleSession(): ProblemSetSession {
  return {
    index: 1,
    visitedCount: 2,
    solvedProblemIds: ['p1'],
    problemIds: ['p1'],
    work: {
      p1: {
        strokes: [
          { id: 'stroke-1', points: [{ x: 1, y: 2, p: 0.5, t: 10 }] },
        ],
        viewport: { scale: 1.5, tx: 10, ty: -5 },
        phase: 'correct',
        attempts: 2,
        hints: [
          { level: 0, text: 'Start from Coulomb law.', targetLineId: null },
          { level: 1, text: 'Square the distance in the denominator.', targetLineId: 'line-2' },
        ],
        result: {
          isCorrect: true,
          transcribedSteps: ['E = kq/r^2'],
          firstErrorLineId: null,
          misconceptionId: null,
          explanation: 'Looks right.',
          correctSolution: ['Square the distance'],
        },
        recorded: true,
      },
    },
  };
}

describe('problemSessionProgress', () => {
  it('round-trips a full session through normalize', () => {
    const session = sampleSession();
    const merged = mergeProblemSetSession(EMPTY_PROBLEM_SESSION_STATE, 'coulombs-law', session);

    const restored = normalizeProblemSessions(merged);

    expect(restored['coulombs-law']).toEqual(session);
  });

  it('preserves the ordered problemIds that identify the set through normalize', () => {
    const session: ProblemSetSession = {
      index: 0,
      visitedCount: 1,
      solvedProblemIds: [],
      problemIds: ['a', 'v1:cl-field-point-charge:q=0.000003;r=2'],
      work: {},
    };
    const merged = mergeProblemSetSession(EMPTY_PROBLEM_SESSION_STATE, 'set', session);

    const restored = normalizeProblemSessions(merged);

    expect(restored.set.problemIds).toEqual([
      'a',
      'v1:cl-field-point-charge:q=0.000003;r=2',
    ]);
  });

  it('defaults a session saved before problemIds existed to an empty list', () => {
    const normalized = normalizeProblemSessions({
      set: { index: 0, visitedCount: 1, solvedProblemIds: [], work: {} },
    });

    expect(normalized.set.problemIds).toEqual([]);
  });

  it('strips undefined so the document is Firestore-safe', () => {
    const session = sampleSession();
    delete session.work.p1.result?.correctSolution;

    const merged = mergeProblemSetSession({}, 'set', session);
    const serialized = JSON.parse(JSON.stringify(merged));

    expect(serialized).toEqual(merged);
    expect('correctSolution' in (merged.set.work.p1.result ?? {})).toBe(false);
  });

  it('drops malformed sets and clamps visitedCount to at least index + 1', () => {
    const normalized = normalizeProblemSessions({
      good: { index: 3, visitedCount: 1, solvedProblemIds: ['a'], work: {} },
      brokenString: 'nope',
      brokenNull: null,
    });

    expect(Object.keys(normalized)).toEqual(['good']);
    expect(normalized.good.visitedCount).toBe(4);
    expect(normalized.good.index).toBe(3);
  });

  it('discards strokes with no valid points and coerces missing pen fields', () => {
    const normalized = normalizeProblemSessions({
      set: {
        index: 0,
        visitedCount: 1,
        solvedProblemIds: [],
        work: {
          p1: {
            strokes: [
              { id: 'empty', points: [] },
              { id: 'ok', points: [{ x: 0, y: 0 }] },
            ],
            viewport: { scale: 0, tx: 'x', ty: 4 },
            phase: 'grading',
            attempts: -2,
            // Legacy single-hint shape with the old `tier` name: it must migrate
            // to a one-element `hints` array with `level`.
            hint: { tier: 1, text: 'Re-check the exponent.', targetLineId: null },
            result: null,
            recorded: 'yes',
          },
        },
      },
    });

    const work = normalized.set.work.p1;
    expect(work.strokes).toHaveLength(1);
    expect(work.strokes[0]).toEqual({
      id: 'ok',
      points: [{ x: 0, y: 0, p: 0.5, t: 0 }],
    });
    expect(work.viewport).toEqual({ scale: 1, tx: 0, ty: 4 });
    expect(work.phase).toBe('solving');
    expect(work.attempts).toBe(0);
    expect(work.hints).toEqual([{ level: 1, text: 'Re-check the exponent.', targetLineId: null }]);
    expect(work.recorded).toBe(false);
  });

  it('selects and removes a stored session', () => {
    const state = mergeProblemSetSession({}, 'set', sampleSession());

    expect(selectProblemSetSession(state, 'set')).not.toBeNull();
    expect(selectProblemSetSession(state, 'missing')).toBeNull();

    const removed = removeProblemSetSession(state, 'set');
    expect(removed).toEqual({});
    expect(removeProblemSetSession({}, 'set')).toEqual({});
  });
});
