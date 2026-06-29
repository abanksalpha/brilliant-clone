import { PROBLEMS, getProblemById, getProblemsForLesson } from './index';
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
  it('groups Coulomb and field problems under their home lesson skills', () => {
    expect(getProblemsForLesson('coulombs-law').map((problem) => problem.problemId).sort()).toEqual([
      'cl-coulomb-charge-split-max',
      'cl-coulomb-collinear-net',
      'cl-coulomb-equilibrium',
      'cl-coulomb-force-ap',
      'cl-coulomb-force-two-charges',
      'cl-coulomb-net-2d',
      'cl-coulomb-scaling',
      'cl-coulomb-solve-charge',
      'cl-coulomb-square-corner-net',
      'cl-coulomb-triangle-net',
      'cl-field-and-force',
    ]);
    expect(
      getProblemsForLesson('electric-field-field-lines')
        .map((problem) => problem.problemId)
        .sort(),
    ).toEqual([
      'cl-field-point-charge',
      'eff-field-collinear-net',
      'eff-field-distance-ratio',
      'eff-field-from-force',
      'eff-field-null-point',
      'eff-field-perp-bisector',
      'eff-field-point-charge-nc',
      'eff-field-probe-invariance',
      'eff-field-solve-distance',
      'eff-field-then-force',
      'eff-field-two-positive-net',
    ]);
    expect(
      getProblemsForLesson('electric-fields-of-charge-distributions')
        .map((problem) => problem.problemId)
        .sort(),
    ).toEqual([
      'cl-midpoint-field-potential',
      'cl-two-charge-superposition',
      'efcd-arc-center',
      'efcd-disk-axis',
      'efcd-infinite-line',
      'efcd-quarter-arc-center',
      'efcd-ring-axis',
      'efcd-rod-bisector',
      'efcd-rod-end-axis',
    ]);
    expect(
      getProblemsForLesson('electric-flux')
        .map((problem) => problem.problemId)
        .sort(),
    ).toEqual([
      'flux-cube-uniform',
      'flux-disk-tilted',
      'flux-flat-tilted',
      'flux-hemisphere-uniform',
      'flux-net-enclosed-charges',
      'flux-point-charge-enclosed',
      'flux-solve-angle',
    ]);
    expect(
      getProblemsForLesson('gausss-law')
        .map((problem) => problem.problemId)
        .sort(),
    ).toEqual([
      'gauss-conductor-surface',
      'gauss-infinite-line',
      'gauss-infinite-sheet',
      'gauss-shell-inside',
      'gauss-solid-sphere-inside',
      'gauss-sphere-outside',
      'gauss-two-sheets',
    ]);
  });

  it('files each mechanics review seed under its own mechanics skill', () => {
    expect(getProblemsForLesson('mechanics-forces').map((problem) => problem.problemId)).toEqual([
      'mech-forces-incline',
    ]);
    expect(getProblemsForLesson('mechanics-energy').map((problem) => problem.problemId)).toEqual([
      'mech-energy-fall',
    ]);
    expect(getProblemsForLesson('mechanics-kinematics').map((problem) => problem.problemId)).toEqual([
      'mech-kinematics-drop',
    ]);
  });

  it('returns no problems for an unknown lesson', () => {
    expect(getProblemsForLesson('missing-lesson')).toHaveLength(0);
  });

  it('keeps every problemId unique', () => {
    const ids = PROBLEMS.map((problem) => problem.problemId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('tags every problem with at least one misconception tag', () => {
    for (const problem of PROBLEMS) {
      expect(problem.misconceptionTags.length, problem.problemId).toBeGreaterThan(0);
      for (const tag of problem.misconceptionTags) {
        expect(typeof tag, problem.problemId).toBe('string');
        expect(tag.length, problem.problemId).toBeGreaterThan(0);
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

describe('problem lookups', () => {
  it('finds a problem by id and returns undefined for a miss', () => {
    expect(getProblemById('cl-field-point-charge')?.title).toBe('Field from a point charge');
    expect(getProblemById('missing-problem')).toBeUndefined();
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
      expect(['authored', 'synthesis'], problem.problemId).toContain(problem.provenance);
    }
  });

  it('keeps the six Phase 5 independent problems at the AP-Classroom bands', () => {
    const independentIds = [
      'cl-coulomb-net-2d',
      'cl-coulomb-equilibrium',
      'cl-coulomb-square-corner-net',
      'cl-coulomb-triangle-net',
      'cl-coulomb-solve-charge',
      'cl-coulomb-charge-split-max',
    ];
    for (const id of independentIds) {
      const problem = getProblemById(id);
      expect(problem, id).toBeDefined();
      expect(problem!.difficultyBand, id).toBeGreaterThanOrEqual(4);
      expect(problem!.difficultyBand, id).toBeLessThanOrEqual(5);
    }
  });

  it('authors the three mechanics review seeds as band 4 single-skill problems', () => {
    for (const id of ['mech-forces-incline', 'mech-energy-fall', 'mech-kinematics-drop']) {
      const problem = getProblemById(id);
      expect(problem, id).toBeDefined();
      expect(problem!.kind, id).toBe('single');
      expect(problem!.difficultyBand, id).toBe(4);
      expect(problem!.skillIds.length, id).toBe(1);
    }
  });
});
