import { describe, expect, it } from 'vitest';
import { getProblemsForLesson } from '../content/problems';
import { EMPTY_PROGRESS, type DashboardProgress } from './dashboardProgress';
import { countCompletedProblemSets, isProblemSetComplete } from './problemSetStatus';

function solvedAttempts(lessonId: string): DashboardProgress['problemAttempts'] {
  const attempts: DashboardProgress['problemAttempts'] = {};
  for (const problem of getProblemsForLesson(lessonId)) {
    attempts[problem.problemId] = { attempts: 1, hintsUsed: 0, solvedISO: '2026-01-01T00:00:00.000Z' };
  }
  return attempts;
}

describe('isProblemSetComplete', () => {
  it('is false with no progress', () => {
    expect(isProblemSetComplete(EMPTY_PROGRESS, 'coulombs-law')).toBe(false);
  });

  it('is true via the explicit completedProblemSetIds marker', () => {
    const progress = { ...EMPTY_PROGRESS, completedProblemSetIds: ['coulombs-law'] };
    expect(isProblemSetComplete(progress, 'coulombs-law')).toBe(true);
  });

  it('is false when authored problems are solved but the set was not finished', () => {
    // Solving authored problems (e.g. in the lesson or elsewhere) must not mark
    // the set complete; only finishing the composed set sets the marker.
    const progress = { ...EMPTY_PROGRESS, problemAttempts: solvedAttempts('coulombs-law') };
    expect(isProblemSetComplete(progress, 'coulombs-law')).toBe(false);
  });

  it('is false for an unknown lesson or null', () => {
    expect(isProblemSetComplete(EMPTY_PROGRESS, 'not-a-lesson')).toBe(false);
    expect(isProblemSetComplete(EMPTY_PROGRESS, null)).toBe(false);
  });
});

describe('countCompletedProblemSets', () => {
  it('is zero with no progress', () => {
    expect(countCompletedProblemSets(EMPTY_PROGRESS)).toBe(0);
  });

  it('counts the leading prefix of finished sets', () => {
    const first = { ...EMPTY_PROGRESS, completedProblemSetIds: ['coulombs-law'] };
    expect(countCompletedProblemSets(first)).toBe(1);
  });

  it('stops at the first incomplete set rather than counting later ones', () => {
    const onlySecond = {
      ...EMPTY_PROGRESS,
      completedProblemSetIds: ['charging-conductors-insulators'],
    };
    expect(countCompletedProblemSets(onlySecond)).toBe(0);
  });
});
