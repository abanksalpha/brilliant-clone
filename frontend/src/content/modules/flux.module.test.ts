import { describe, it, expect } from 'vitest';
import { validateLessonModule } from '../schema';
import electricFlux from './electric-flux';
import flatTilted from '../problems/flux-flat-tilted.json';
import solveAngle from '../problems/flux-solve-angle.json';
import cubeUniform from '../problems/flux-cube-uniform.json';
import pointChargeEnclosed from '../problems/flux-point-charge-enclosed.json';
import netEnclosedCharges from '../problems/flux-net-enclosed-charges.json';
import diskTilted from '../problems/flux-disk-tilted.json';
import hemisphereUniform from '../problems/flux-hemisphere-uniform.json';

// Validates the lesson 5 module against the schema and confirms every problemId it
// references has a client Problem JSON on disk, mirroring the lesson 4 module test.

const PROBLEM_JSONS = [
  flatTilted,
  solveAngle,
  cubeUniform,
  pointChargeEnclosed,
  netEnclosedCharges,
  diskTilted,
  hemisphereUniform,
];
const jsonIds = new Set(PROBLEM_JSONS.map((problem) => problem.problemId));

function referencedIds(): string[] {
  return [
    ...electricFlux.workedSequence.map((item) => item.problemId),
    ...electricFlux.independentProblemIds,
  ];
}

describe('electric-flux module', () => {
  it('passes validateLessonModule with no errors', () => {
    expect(validateLessonModule(electricFlux)).toEqual([]);
  });

  it('is lesson 5 with the flux skill id and the right prerequisite', () => {
    expect(electricFlux.lessonId).toBe('electric-flux');
    expect(electricFlux.lessonNumber).toBe(5);
    expect(electricFlux.prerequisites).toEqual(['electric-fields-of-charge-distributions']);
  });

  it('reviews the two prior field lessons in Phase 1, most recent first', () => {
    expect(electricFlux.reviewSkillIds).toEqual([
      'electric-fields-of-charge-distributions',
      'electric-field-field-lines',
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
    const sequence = electricFlux.workedSequence;
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

  it('opens the inquiry with two interactive flux screens', () => {
    const screens = electricFlux.inquiry.screens ?? [];
    expect(screens.map((screen) => screen.id)).toEqual(['plate-tilt', 'box-closed']);
    for (const screen of screens) {
      expect(screen.kind).toBe('flux');
    }
  });

  it('lists three independent problems', () => {
    expect(electricFlux.independentProblemIds.length).toBe(3);
  });

  it('authors all copy in canonical ASCII notation, never "naught", raw glyphs, or em dashes', () => {
    const blob = JSON.stringify(electricFlux) + JSON.stringify(PROBLEM_JSONS);
    expect(blob).not.toMatch(/naught/i);
    expect(blob).not.toMatch(/\u2014/);
    // Greek and math are authored by name in ASCII (epsilon, theta, Phi, m^2);
    // the shared renderer makes the glyphs, so no raw glyph should reach source.
    expect(blob).not.toMatch(/[\u03b5\u03b8\u03a6\u03c3\u03bb\u03c1\u03c9\u03a9\u03c0\u00b2\u00b3\u207b\u221a\u00d7\u00b7\u2080\u2081\u2082]/);
  });

  it('promotes each Learn slide key equation to its own displayed line', () => {
    const [slide1, slide2] = electricFlux.explanationSlides;
    expect(slide1.body).toContain('\n\nPhi = E A cos(theta)\n\n');
    expect(slide2.body).toContain('\n\nPhi = Q_enc / epsilon_0\n\n');
  });

  it('keeps every referenced JSON tagged with the flux skill and free of any answer key', () => {
    const referenced = new Set(referencedIds());
    for (const problem of PROBLEM_JSONS) {
      if (!referenced.has(problem.problemId)) continue;
      expect(problem.skillIds, problem.problemId).toContain('electric-flux');
      expect(problem.misconceptionTags.length, problem.problemId).toBeGreaterThan(0);
      expect(problem, problem.problemId).not.toHaveProperty('solution');
      expect(problem, problem.problemId).not.toHaveProperty('answer');
      expect(problem, problem.problemId).not.toHaveProperty('finalAnswer');
      expect(problem, problem.problemId).not.toHaveProperty('correctSolution');
    }
  });
});
