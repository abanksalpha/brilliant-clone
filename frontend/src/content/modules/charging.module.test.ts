import { describe, expect, it } from 'vitest';
import { validateLessonModule } from '../schema';
import chargingModule from './charging-conductors-insulators';
import type { Problem } from '../problemSchema';
import shareIdenticalSpheres from '../problems/cci-share-identical-spheres.json';
import shareUnequalSpheres from '../problems/cci-share-unequal-spheres.json';
import shareThreeSpheres from '../problems/cci-share-three-spheres.json';
import shareThenForce from '../problems/cci-share-then-force.json';
import shareOppositeSigns from '../problems/cci-share-opposite-signs.json';
import fieldOutsideSphere from '../problems/cci-field-outside-sphere.json';
import shellOuterField from '../problems/cci-shell-outer-field.json';
import spherePotential from '../problems/cci-sphere-potential.json';
import shellSurfaceCharges from '../problems/cci-shell-surface-charges.json';
import surfaceChargeDensity from '../problems/cci-surface-charge-density.json';

// Lesson 2 (Charging, Conductors & Insulators) is authored but not yet registered
// in content/index.ts or problems/index.ts (the orchestrator wires that in
// afterward to avoid races). So this test imports the module and its problem JSON
// files DIRECTLY, asserts the module passes validateLessonModule, and asserts
// every problemId the module references resolves to a JSON file on disk.

const CCI_PROBLEMS = [
  shareIdenticalSpheres,
  shareUnequalSpheres,
  shareThreeSpheres,
  shareThenForce,
  shareOppositeSigns,
  fieldOutsideSphere,
  shellOuterField,
  spherePotential,
  shellSurfaceCharges,
  surfaceChargeDensity,
] as unknown as Problem[];

const PROBLEMS_BY_ID = new Map(CCI_PROBLEMS.map((problem) => [problem.problemId, problem]));

function referencedIds(): string[] {
  return [
    ...chargingModule.workedSequence.map((item) => item.problemId),
    ...chargingModule.independentProblemIds,
  ];
}

describe('charging-conductors-insulators module', () => {
  it('is lesson number 2 with the expected id and prerequisite', () => {
    expect(chargingModule.lessonId).toBe('charging-conductors-insulators');
    expect(chargingModule.lessonNumber).toBe(2);
    expect(chargingModule.prerequisites).toContain('coulombs-law');
  });

  it('passes validateLessonModule with no errors', () => {
    expect(validateLessonModule(chargingModule)).toEqual([]);
  });

  it("reviews the prior lesson first in Phase 1", () => {
    expect(chargingModule.reviewSkillIds[0]).toBe('coulombs-law');
    expect(chargingModule.reviewSkillIds.length).toBeGreaterThan(0);
  });

  it('resolves every referenced problemId to an authored JSON file', () => {
    const referenced = referencedIds();
    expect(referenced.length).toBe(7);
    for (const id of referenced) {
      const problem = PROBLEMS_BY_ID.get(id);
      expect(problem, id).toBeDefined();
      expect(problem!.problemId, id).toBe(id);
    }
  });

  it('references only authored problems, all prefixed cci-', () => {
    const referenced = new Set(referencedIds());
    const authored = new Set(PROBLEMS_BY_ID.keys());
    // Phase 5 now lists three of the lesson's independent problems; the rest stay
    // authored in the catalog, so referenced is a subset of authored, not equal.
    for (const id of referenced) {
      expect(authored.has(id), id).toBe(true);
    }
    for (const id of authored) {
      expect(id.startsWith('cci-'), id).toBe(true);
    }
  });

  it('files every authored problem under the charging skill at an AP band', () => {
    for (const problem of CCI_PROBLEMS) {
      expect(problem.skillIds, problem.problemId).toContain('charging-conductors-insulators');
      expect(problem.skillIds, problem.problemId).toContain(problem.lessonId);
      expect(problem.difficultyBand, problem.problemId).toBeGreaterThanOrEqual(4);
      expect(problem.difficultyBand, problem.problemId).toBeLessThanOrEqual(5);
      expect(problem.misconceptionTags.length, problem.problemId).toBeGreaterThan(0);
      const expectedKind = problem.skillIds.length >= 2 ? 'synthesis' : 'single';
      expect(problem.kind, problem.problemId).toBe(expectedKind);
    }
  });

  it('carries an analogical worked pair, then a completion, then a skeleton rung', () => {
    const worked = chargingModule.workedSequence.filter((item) => item.mode === 'worked');
    expect(worked.length).toBeGreaterThanOrEqual(2);
    const group = worked[0].analogyGroup;
    expect(group).toBeTruthy();
    expect(worked.filter((item) => item.analogyGroup === group).length).toBe(2);
    for (const item of worked) {
      expect((item.solutionSteps?.length ?? 0) > 0, item.problemId).toBe(true);
    }
    const completion = chargingModule.workedSequence.find((item) => item.mode === 'completion');
    expect(completion?.prefilledSteps?.length ?? 0).toBeGreaterThan(0);
    expect(chargingModule.workedSequence.some((item) => item.mode === 'skeleton')).toBe(true);
  });

  it('never leaks a solution into the public problem JSON', () => {
    const banned = new Set(['answer', 'solution', 'correct', 'finalanswer', 'correctsolution']);
    for (const problem of CCI_PROBLEMS) {
      for (const key of Object.keys(problem as Record<string, unknown>)) {
        expect(banned.has(key.toLowerCase()), `${problem.problemId} has key ${key}`).toBe(false);
      }
    }
  });
});
