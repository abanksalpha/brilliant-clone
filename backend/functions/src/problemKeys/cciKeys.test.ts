import { describe, it, expect } from 'vitest';
import { ProblemKey } from '../types';
import { cciShareIdenticalSpheres } from './cci-share-identical-spheres';
import { cciShareUnequalSpheres } from './cci-share-unequal-spheres';
import { cciShareThreeSpheres } from './cci-share-three-spheres';
import { cciShareThenForce } from './cci-share-then-force';
import { cciShareOppositeSigns } from './cci-share-opposite-signs';
import { cciFieldOutsideSphere } from './cci-field-outside-sphere';
import { cciShellOuterField } from './cci-shell-outer-field';
import { cciSpherePotential } from './cci-sphere-potential';
import { cciShellSurfaceCharges } from './cci-shell-surface-charges';
import { cciSurfaceChargeDensity } from './cci-surface-charge-density';

// Golden tests for the lesson 2 (Charging, Conductors & Insulators) authored
// keys. These keys are not registered in the problemKeys index yet (the
// orchestrator wires that afterward), so each module is imported DIRECTLY here.
// For every key we independently recompute the physics from the givens and assert
// the stated finalAnswer matches in its own units, then recompute each declared
// misconception's wrong answer and assert it is distinct from the correct one and
// from the other flaws (so each mistake is diagnosable). The grader tolerates
// rounding, so a 2 percent band is used for the correct value and a strictly
// larger gap is required for every flaw.

const K = 8.99e9;

// Pull the leading numeric magnitude out of a finalAnswer like "1.44e-5 N" or
// "+4.0 nC". The leading optional sign and unit suffix are ignored.
function leadingNumber(text: string): number {
  const match = text.match(/-?\d[\d.]*(e-?\d+)?/i);
  if (!match) throw new Error(`no number found in "${text}"`);
  return Number(match[0]);
}

type FlawCase = { misconceptionId: string; wrong: number };
type KeyCase = { key: ProblemKey; correct: number; flaws: FlawCase[] };

// Each correct/wrong value is computed in the SAME units as the key's stated
// finalAnswer (charge cases in nC, force in N, field in N/C, potential in V,
// density in C/m^2), since the comparisons are relative and unit independent.
const CASES: KeyCase[] = [
  {
    key: cciShareIdenticalSpheres,
    correct: 8.0 / 2,
    flaws: [{ misconceptionId: 'charge-sharing-omitted', wrong: 8.0 }],
  },
  {
    key: cciShareUnequalSpheres,
    correct: (2 / 3) * 9.0,
    flaws: [{ misconceptionId: 'charge-sharing-equal-split', wrong: 9.0 / 2 }],
  },
  {
    key: cciShareThreeSpheres,
    correct: 12 / 2 / 2,
    flaws: [
      { misconceptionId: 'charge-shared-three-ways', wrong: 12 / 3 },
      { misconceptionId: 'charge-sharing-single-step', wrong: 12 / 2 },
    ],
  },
  {
    key: cciShareThenForce,
    correct: (K * 4.0e-9 * 4.0e-9) / (0.1 * 0.1),
    flaws: [
      { misconceptionId: 'charge-sharing-omitted', wrong: (K * 6.0e-9 * 2.0e-9) / (0.1 * 0.1) },
      { misconceptionId: 'inverse-square-error', wrong: (K * 4.0e-9 * 4.0e-9) / 0.1 },
    ],
  },
  {
    key: cciShareOppositeSigns,
    correct: (16 + -4) / 2,
    flaws: [
      { misconceptionId: 'charge-sign-ignored', wrong: (16 + 4) / 2 },
      { misconceptionId: 'charge-sum-not-averaged', wrong: 16 + -4 },
    ],
  },
  {
    key: cciFieldOutsideSphere,
    correct: (K * 8.0e-9) / (0.05 * 0.05),
    flaws: [
      { misconceptionId: 'inverse-square-error', wrong: (K * 8.0e-9) / 0.05 },
      { misconceptionId: 'radius-diameter-confusion', wrong: (K * 8.0e-9) / (0.1 * 0.1) },
    ],
  },
  {
    key: cciShellOuterField,
    correct: (K * 5.0e-9) / (0.4 * 0.4),
    flaws: [
      { misconceptionId: 'conductor-double-counts-charge', wrong: (K * 10.0e-9) / (0.4 * 0.4) },
      { misconceptionId: 'inverse-square-error', wrong: (K * 5.0e-9) / 0.4 },
    ],
  },
  {
    key: cciSpherePotential,
    correct: (K * 4.0e-9) / 0.2,
    flaws: [
      { misconceptionId: 'potential-uses-r-squared', wrong: (K * 4.0e-9) / (0.2 * 0.2) },
      { misconceptionId: 'radius-diameter-confusion', wrong: (K * 4.0e-9) / 0.4 },
    ],
  },
  {
    key: cciShellSurfaceCharges,
    correct: 10 - 7,
    flaws: [
      { misconceptionId: 'shell-ignores-inner-surface', wrong: 10 },
      { misconceptionId: 'shell-induction-sign-error', wrong: 10 - -7 },
    ],
  },
  {
    key: cciSurfaceChargeDensity,
    correct: 6.0e-9 / (4 * Math.PI * 0.1 * 0.1),
    flaws: [
      { misconceptionId: 'density-omits-4pi', wrong: 6.0e-9 / (0.1 * 0.1) },
      { misconceptionId: 'density-uses-volume', wrong: 6.0e-9 / ((4 / 3) * Math.PI * 0.1 * 0.1 * 0.1) },
    ],
  },
];

describe('lesson 2 authored keys hit their golden values', () => {
  for (const testCase of CASES) {
    it(`${testCase.key.problemId} states a finalAnswer matching the recomputed physics`, () => {
      const stated = leadingNumber(testCase.key.finalAnswer);
      expect(Math.abs(stated - testCase.correct)).toBeLessThanOrEqual(
        Math.abs(testCase.correct) * 0.02 + 1e-12,
      );
      expect(testCase.key.correctSolution.length).toBeGreaterThan(0);
    });
  }
});

describe('each declared misconception yields a distinct wrong answer', () => {
  for (const testCase of CASES) {
    it(`${testCase.key.problemId} carries one diagnosable flaw per misconception`, () => {
      const key = testCase.key;

      // The key declares exactly the misconceptions modelled here.
      expect(key.flaws.map((flaw) => flaw.misconceptionId).sort()).toEqual(
        testCase.flaws.map((flaw) => flaw.misconceptionId).sort(),
      );

      const distinctWrong = new Set<number>();
      for (const flaw of testCase.flaws) {
        const rel = Math.abs(flaw.wrong - testCase.correct) / Math.abs(testCase.correct);
        // A real misconception lands well outside the rounding band.
        expect(rel, `${key.problemId}:${flaw.misconceptionId}`).toBeGreaterThan(0.02);
        distinctWrong.add(Number(flaw.wrong.toPrecision(3)));

        const declared = key.flaws.find((entry) => entry.misconceptionId === flaw.misconceptionId);
        expect(declared, `${key.problemId}:${flaw.misconceptionId}`).toBeDefined();
        expect((declared?.signature.length ?? 0) > 0).toBe(true);
      }

      // The wrong answers are also distinct from one another.
      expect(distinctWrong.size).toBe(testCase.flaws.length);
    });
  }
});

describe('every lesson 2 key is fully formed', () => {
  for (const testCase of CASES) {
    it(`${testCase.key.problemId} carries a statement, rubric, and final answer`, () => {
      const key = testCase.key;
      expect(key.problemId.startsWith('cci-')).toBe(true);
      expect(key.statement.length).toBeGreaterThan(0);
      expect(key.rubric.length).toBeGreaterThan(0);
      expect(key.finalAnswer.length).toBeGreaterThan(0);
    });
  }
});
