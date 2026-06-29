import { describe, it, expect } from 'vitest';
import { validateLessonModule } from '../schema';
import gausssLaw from './gausss-law';
import sphereOutside from '../problems/gauss-sphere-outside.json';
import infiniteSheet from '../problems/gauss-infinite-sheet.json';
import conductorSurface from '../problems/gauss-conductor-surface.json';
import solidSphereInside from '../problems/gauss-solid-sphere-inside.json';
import twoSheets from '../problems/gauss-two-sheets.json';
import infiniteLine from '../problems/gauss-infinite-line.json';
import shellInside from '../problems/gauss-shell-inside.json';

// Validates the lesson 6 module against the schema and confirms every problemId it
// references has a client Problem JSON on disk, mirroring the lesson 5 module test.

const PROBLEM_JSONS = [
  sphereOutside,
  infiniteSheet,
  conductorSurface,
  solidSphereInside,
  twoSheets,
  infiniteLine,
  shellInside,
];
const jsonIds = new Set(PROBLEM_JSONS.map((problem) => problem.problemId));

function referencedIds(): string[] {
  return [
    ...gausssLaw.workedSequence.map((item) => item.problemId),
    ...gausssLaw.independentProblemIds,
  ];
}

describe("gauss's-law module", () => {
  it('passes validateLessonModule with no errors', () => {
    expect(validateLessonModule(gausssLaw)).toEqual([]);
  });

  it('is lesson 6 with the gauss skill id and the right prerequisite', () => {
    expect(gausssLaw.lessonId).toBe('gausss-law');
    expect(gausssLaw.lessonNumber).toBe(6);
    expect(gausssLaw.prerequisites).toEqual(['electric-flux']);
  });

  it('reviews the two prior field lessons in Phase 1, most recent first', () => {
    expect(gausssLaw.reviewSkillIds).toEqual(['electric-flux', 'electric-fields-of-charge-distributions']);
  });

  it('has a client JSON for every referenced problemId', () => {
    const referenced = referencedIds();
    expect(referenced.length).toBeGreaterThan(0);
    for (const id of referenced) {
      expect(jsonIds.has(id), id).toBe(true);
    }
  });

  it('carries an analogical worked pair, then a completion, then a skeleton', () => {
    const sequence = gausssLaw.workedSequence;
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

  it('opens the inquiry with two interactive gauss screens', () => {
    const screens = gausssLaw.inquiry.screens ?? [];
    expect(screens.map((screen) => screen.id)).toEqual(['charge-inside', 'charge-outside']);
    for (const screen of screens) {
      expect(screen.kind).toBe('gauss');
    }
  });

  it('lists three independent problems', () => {
    expect(gausssLaw.independentProblemIds.length).toBe(3);
  });

  it('keeps every referenced JSON tagged with the gauss skill and free of any answer key', () => {
    const referenced = new Set(referencedIds());
    for (const problem of PROBLEM_JSONS) {
      if (!referenced.has(problem.problemId)) continue;
      expect(problem.skillIds, problem.problemId).toContain('gausss-law');
      expect(problem.misconceptionTags.length, problem.problemId).toBeGreaterThan(0);
      expect(problem, problem.problemId).not.toHaveProperty('solution');
      expect(problem, problem.problemId).not.toHaveProperty('answer');
      expect(problem, problem.problemId).not.toHaveProperty('finalAnswer');
      expect(problem, problem.problemId).not.toHaveProperty('correctSolution');
    }
  });
});
