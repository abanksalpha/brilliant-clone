import { PROBLEMS, getProblemById, getProblemsForLesson } from './index';
import { MISCONCEPTIONS, getMisconception } from '../misconceptions';
import { PRINCIPLES } from '../principles';

// Keys that would leak a grading key into the public bundle. The real answers
// live on the server, so none of these may appear anywhere in a problem object.
const BANNED_KEYS = new Set(['answer', 'solution', 'correct', 'finalanswer']);

function collectKeys(value: unknown, found: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, found);
  } else if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      found.push(key);
      collectKeys(child, found);
    }
  }
  return found;
}

describe('public problem catalog', () => {
  it('ships the force problem under coulombs-law and the field problems under field skills', () => {
    expect(getProblemsForLesson('coulombs-law').map((problem) => problem.problemId)).toEqual([
      'cl-coulomb-force-two-charges',
    ]);
    expect(getProblemsForLesson('electric-field-field-lines').map((problem) => problem.problemId)).toEqual([
      'cl-field-point-charge',
    ]);
    expect(
      getProblemsForLesson('electric-fields-of-charge-distributions')
        .map((problem) => problem.problemId)
        .sort(),
    ).toEqual(['cl-midpoint-field-potential', 'cl-two-charge-superposition']);
  });

  it('returns no problems for an unknown lesson', () => {
    expect(getProblemsForLesson('missing-lesson')).toHaveLength(0);
  });

  it('keeps every problemId unique', () => {
    const ids = PROBLEMS.map((problem) => problem.problemId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('references only catalogued misconception tags', () => {
    const known = new Set(MISCONCEPTIONS.map((misconception) => misconception.id));
    for (const problem of PROBLEMS) {
      for (const tag of problem.misconceptionTags) {
        expect(known.has(tag), `${problem.problemId} -> ${tag}`).toBe(true);
      }
    }
  });

  it('keeps difficulty between 1 and 5', () => {
    for (const problem of PROBLEMS) {
      expect(problem.difficulty, problem.problemId).toBeGreaterThanOrEqual(1);
      expect(problem.difficulty, problem.problemId).toBeLessThanOrEqual(5);
    }
  });

  it('never leaks an answer key to the client', () => {
    for (const problem of PROBLEMS) {
      for (const key of collectKeys(problem)) {
        expect(BANNED_KEYS.has(key.toLowerCase()), `${problem.problemId} has key ${key}`).toBe(
          false,
        );
      }
    }
  });
});

describe('problem and misconception lookups', () => {
  it('finds a problem by id and returns undefined for a miss', () => {
    expect(getProblemById('cl-field-point-charge')?.title).toBe('Field from a point charge');
    expect(getProblemById('missing-problem')).toBeUndefined();
  });

  it('exposes the catalogued misconceptions', () => {
    expect(MISCONCEPTIONS.map((misconception) => misconception.id).sort()).toEqual([
      'capacitor-combination-swap',
      'conductor-interior-charge',
      'current-consumed',
      'equipotential-work',
      'field-potential-conflation',
      'field-requires-test-charge',
      'flux-shape-dependence',
      'induced-current-direction',
      'inverse-square-error',
      'magnetic-force-does-work',
      'potential-as-vector',
      'superposition-magnitude-add',
    ]);
  });

  it('finds a misconception by id and returns undefined for a miss', () => {
    expect(getMisconception('inverse-square-error')?.shortLabel).toBe('uses 1/r not 1/r squared');
    expect(getMisconception('missing')).toBeUndefined();
  });
});

describe('problem taxonomy and difficulty model', () => {
  it('gives every problem a nonempty skillIds that includes its home lessonId', () => {
    for (const problem of PROBLEMS) {
      expect(problem.skillIds.length, problem.problemId).toBeGreaterThan(0);
      expect(problem.skillIds, problem.problemId).toContain(problem.lessonId);
    }
  });

  it('labels kind single or synthesis in step with the skill count', () => {
    for (const problem of PROBLEMS) {
      expect(['single', 'synthesis'], problem.problemId).toContain(problem.kind);
      const expected = problem.skillIds.length >= 2 ? 'synthesis' : 'single';
      expect(problem.kind, problem.problemId).toBe(expected);
    }
  });

  it('references only catalogued principles', () => {
    const known = new Set(PRINCIPLES.map((principle) => principle.id));
    for (const problem of PROBLEMS) {
      for (const id of problem.principleIds) {
        expect(known.has(id), `${problem.problemId} -> ${id}`).toBe(true);
      }
    }
  });

  it('references only catalogued misconceptions on the new shape', () => {
    const known = new Set(MISCONCEPTIONS.map((misconception) => misconception.id));
    for (const problem of PROBLEMS) {
      for (const tag of problem.misconceptionTags) {
        expect(known.has(tag), `${problem.problemId} -> ${tag}`).toBe(true);
      }
    }
  });

  it('keeps difficultyBand an integer between 1 and 5', () => {
    for (const problem of PROBLEMS) {
      expect(Number.isInteger(problem.difficultyBand), problem.problemId).toBe(true);
      expect(problem.difficultyBand, problem.problemId).toBeGreaterThanOrEqual(1);
      expect(problem.difficultyBand, problem.problemId).toBeLessThanOrEqual(5);
    }
  });

  it('describes difficultyFeatures with the five typed fields', () => {
    for (const problem of PROBLEMS) {
      const features = problem.difficultyFeatures;
      expect(Number.isInteger(features.steps), problem.problemId).toBe(true);
      expect(typeof features.symbolic, problem.problemId).toBe('boolean');
      expect(typeof features.calculus, problem.problemId).toBe('boolean');
      expect(typeof features.multiPart, problem.problemId).toBe('boolean');
      expect(typeof features.hasTrap, problem.problemId).toBe('boolean');
    }
  });

  it('names a valid provenance for every problem', () => {
    for (const problem of PROBLEMS) {
      expect(['authored', 'variant', 'synthesis'], problem.problemId).toContain(problem.provenance);
    }
  });

  it('keeps four authored problems split across coulombs-law and the field skills', () => {
    expect(PROBLEMS).toHaveLength(4);
    const skills = PROBLEMS.flatMap((problem) => problem.skillIds).sort();
    expect(skills).toEqual([
      'coulombs-law',
      'electric-field-field-lines',
      'electric-fields-of-charge-distributions',
      'electric-fields-of-charge-distributions',
    ]);
  });
});
