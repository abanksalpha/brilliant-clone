import { describe, it, expect } from 'vitest';
import { validateLessonModule } from '../schema';
import electricFieldFieldLines from './electric-field-field-lines';
import fieldPointChargeNc from '../problems/eff-field-point-charge-nc.json';
import fieldSolveDistance from '../problems/eff-field-solve-distance.json';
import fieldFromForce from '../problems/eff-field-from-force.json';
import fieldCollinearNet from '../problems/eff-field-collinear-net.json';
import fieldNullPoint from '../problems/eff-field-null-point.json';
import fieldPerpBisector from '../problems/eff-field-perp-bisector.json';
import fieldThenForce from '../problems/eff-field-then-force.json';
import fieldProbeInvariance from '../problems/eff-field-probe-invariance.json';
import fieldDistanceRatio from '../problems/eff-field-distance-ratio.json';
import fieldTwoPositiveNet from '../problems/eff-field-two-positive-net.json';

// Validates the lesson 3 module against the schema and confirms every problemId it
// references has a client Problem JSON on disk. The module and its JSONs are
// imported directly because the orchestrator has not yet registered them in the
// content index.

const PROBLEM_JSONS = [
  fieldPointChargeNc,
  fieldSolveDistance,
  fieldFromForce,
  fieldCollinearNet,
  fieldNullPoint,
  fieldPerpBisector,
  fieldThenForce,
  fieldProbeInvariance,
  fieldDistanceRatio,
  fieldTwoPositiveNet,
];

const jsonIds = new Set(PROBLEM_JSONS.map((problem) => problem.problemId));

function referencedIds(): string[] {
  return [
    ...electricFieldFieldLines.workedSequence.map((item) => item.problemId),
    ...electricFieldFieldLines.independentProblemIds,
  ];
}

describe('electric-field-field-lines module', () => {
  it('passes validateLessonModule with no errors', () => {
    expect(validateLessonModule(electricFieldFieldLines)).toEqual([]);
  });

  it('is lesson 3 with the field skill id and the right prerequisite', () => {
    expect(electricFieldFieldLines.lessonId).toBe('electric-field-field-lines');
    expect(electricFieldFieldLines.lessonNumber).toBe(3);
    expect(electricFieldFieldLines.prerequisites).toEqual(['charging-conductors-insulators']);
  });

  it('reviews the two prior lessons in Phase 1, most recent first', () => {
    expect(electricFieldFieldLines.reviewSkillIds).toEqual([
      'charging-conductors-insulators',
      'coulombs-law',
    ]);
  });

  it('has a client JSON for every referenced problemId', () => {
    const referenced = referencedIds();
    expect(referenced.length).toBeGreaterThan(0);
    for (const id of referenced) {
      expect(jsonIds.has(id), id).toBe(true);
    }
  });

  it('carries an analogical worked pair, then a completion, then a skeleton', () => {
    const sequence = electricFieldFieldLines.workedSequence;
    const worked = sequence.filter((item) => item.mode === 'worked');
    expect(worked.length).toBe(2);
    const group = worked[0].analogyGroup;
    expect(group).toBeTruthy();
    expect(worked.every((item) => item.analogyGroup === group)).toBe(true);
    for (const item of worked) {
      expect((item.solutionSteps?.length ?? 0) > 0, item.problemId).toBe(true);
      expect((item.selfExplainPrompt?.length ?? 0) > 0, item.problemId).toBe(true);
    }
    const completion = sequence.find((item) => item.mode === 'completion');
    expect(completion).toBeDefined();
    expect((completion?.prefilledSteps?.length ?? 0) > 0).toBe(true);
    expect(sequence.some((item) => item.mode === 'skeleton')).toBe(true);
  });

  it('lists three independent problems', () => {
    expect(electricFieldFieldLines.independentProblemIds.length).toBe(3);
  });

  it('keeps every referenced JSON tagged with the field skill and free of any answer key', () => {
    const referenced = new Set(referencedIds());
    for (const problem of PROBLEM_JSONS) {
      if (!referenced.has(problem.problemId)) continue;
      expect(problem.skillIds, problem.problemId).toContain('electric-field-field-lines');
      expect(problem.misconceptionTags.length, problem.problemId).toBeGreaterThan(0);
      expect(problem, problem.problemId).not.toHaveProperty('solution');
      expect(problem, problem.problemId).not.toHaveProperty('answer');
      expect(problem, problem.problemId).not.toHaveProperty('finalAnswer');
      expect(problem, problem.problemId).not.toHaveProperty('correctSolution');
    }
  });
});
