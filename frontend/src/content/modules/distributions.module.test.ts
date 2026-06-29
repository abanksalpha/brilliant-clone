import { describe, it, expect } from 'vitest';
import { validateLessonModule } from '../schema';
import electricFieldsOfChargeDistributions from './electric-fields-of-charge-distributions';
import ringAxis from '../problems/efcd-ring-axis.json';
import arcCenter from '../problems/efcd-arc-center.json';
import rodBisector from '../problems/efcd-rod-bisector.json';
import infiniteLine from '../problems/efcd-infinite-line.json';
import diskAxis from '../problems/efcd-disk-axis.json';
import rodEndAxis from '../problems/efcd-rod-end-axis.json';
import quarterArcCenter from '../problems/efcd-quarter-arc-center.json';

// Validates the lesson 4 module against the schema and confirms every problemId it
// references has a client Problem JSON on disk, mirroring the lesson 3 module test.

const PROBLEM_JSONS = [ringAxis, arcCenter, rodBisector, infiniteLine, diskAxis, rodEndAxis, quarterArcCenter];
const jsonIds = new Set(PROBLEM_JSONS.map((problem) => problem.problemId));

function referencedIds(): string[] {
  return [
    ...electricFieldsOfChargeDistributions.workedSequence.map((item) => item.problemId),
    ...electricFieldsOfChargeDistributions.independentProblemIds,
  ];
}

describe('electric-fields-of-charge-distributions module', () => {
  it('passes validateLessonModule with no errors', () => {
    expect(validateLessonModule(electricFieldsOfChargeDistributions)).toEqual([]);
  });

  it('is lesson 4 with the distributions skill id and the right prerequisite', () => {
    expect(electricFieldsOfChargeDistributions.lessonId).toBe('electric-fields-of-charge-distributions');
    expect(electricFieldsOfChargeDistributions.lessonNumber).toBe(4);
    expect(electricFieldsOfChargeDistributions.prerequisites).toEqual(['electric-field-field-lines']);
  });

  it('reviews the two prior field lessons in Phase 1, most recent first', () => {
    expect(electricFieldsOfChargeDistributions.reviewSkillIds).toEqual([
      'electric-field-field-lines',
      'charging-conductors-insulators',
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
    const sequence = electricFieldsOfChargeDistributions.workedSequence;
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

  it('opens the inquiry with two interactive field screens', () => {
    const screens = electricFieldsOfChargeDistributions.inquiry.screens ?? [];
    expect(screens.map((screen) => screen.id)).toEqual(['rod-superposition', 'ring-center']);
    for (const screen of screens) {
      expect(screen.kind).toBe('field');
    }
  });

  it('lists three independent problems', () => {
    expect(electricFieldsOfChargeDistributions.independentProblemIds.length).toBe(3);
  });

  it('keeps every referenced JSON tagged with the distributions skill and free of any answer key', () => {
    const referenced = new Set(referencedIds());
    for (const problem of PROBLEM_JSONS) {
      if (!referenced.has(problem.problemId)) continue;
      expect(problem.skillIds, problem.problemId).toContain('electric-fields-of-charge-distributions');
      expect(problem.misconceptionTags.length, problem.problemId).toBeGreaterThan(0);
      expect(problem, problem.problemId).not.toHaveProperty('solution');
      expect(problem, problem.problemId).not.toHaveProperty('answer');
      expect(problem, problem.problemId).not.toHaveProperty('finalAnswer');
      expect(problem, problem.problemId).not.toHaveProperty('correctSolution');
    }
  });
});
