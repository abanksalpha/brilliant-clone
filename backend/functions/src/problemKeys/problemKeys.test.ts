import { describe, it, expect } from 'vitest';
import { getProblemKey } from './index';

// Golden tests for the lesson 1 authored keys. Mirrors the seed template golden
// suite (templates.test.ts): for each key we independently recompute the physics
// from the givens and assert the stated finalAnswer matches, then recompute each
// declared misconception's wrong answer and assert it is distinct from the correct
// one (so the mistake is diagnosable). The grader tolerates rounding, so a 2
// percent band is used for the correct value and a strictly larger gap is required
// for every flaw.

const K = 8.99e9;
const deg = (d: number) => (d * Math.PI) / 180;

// Pull the leading numeric magnitude out of a finalAnswer like "1.26e-2 N".
function leadingNumber(text: string): number {
  const match = text.match(/-?\d[\d.]*(e-?\d+)?/i);
  if (!match) throw new Error(`no number found in "${text}"`);
  return Number(match[0]);
}

type FlawCase = { misconceptionId: string; wrong: number };
type KeyCase = { id: string; correct: number; flaws: FlawCase[] };

// cl-coulomb-net-2d helpers: two equal sources, test charge off the line.
const r2d = Math.sqrt(0.2 * 0.2 + 0.2 * 0.2);
const f2d = (K * 3.0e-6 * 1.0e-6) / (r2d * r2d);
const f2dLinear = (K * 3.0e-6 * 1.0e-6) / r2d;

const CASES: KeyCase[] = [
  {
    id: 'cl-coulomb-force-ap',
    correct: (K * 45e-9 * 28e-9) / (0.03 * 0.03),
    flaws: [{ misconceptionId: 'inverse-square-error', wrong: (K * 45e-9 * 28e-9) / 0.03 }],
  },
  {
    id: 'cl-coulomb-collinear-net',
    correct: (K * 6.0e-6 * 3.0e-6) / (0.2 * 0.2) - (K * 2.0e-6 * 3.0e-6) / (0.3 * 0.3),
    flaws: [
      {
        misconceptionId: 'superposition-direction-error',
        wrong: (K * 6.0e-6 * 3.0e-6) / (0.2 * 0.2) + (K * 2.0e-6 * 3.0e-6) / (0.3 * 0.3),
      },
      {
        misconceptionId: 'inverse-square-error',
        wrong: (K * 6.0e-6 * 3.0e-6) / 0.2 - (K * 2.0e-6 * 3.0e-6) / 0.3,
      },
    ],
  },
  {
    id: 'cl-coulomb-equilibrium',
    correct: 0.3 / 3,
    flaws: [
      { misconceptionId: 'equilibrium-sqrt-omitted', wrong: 0.3 / 5 },
      { misconceptionId: 'equilibrium-reference-error', wrong: 0.3 - 0.3 / 3 },
    ],
  },
  {
    id: 'cl-coulomb-scaling',
    correct: 0.08 * 9,
    flaws: [
      { misconceptionId: 'inverse-square-error', wrong: 0.08 * 3 },
      { misconceptionId: 'force-distance-direction-error', wrong: 0.08 / 9 },
    ],
  },
  {
    id: 'cl-field-and-force',
    correct: 5.0e-6 * 6.0e4,
    flaws: [{ misconceptionId: 'field-force-conflation', wrong: 6.0e4 }],
  },
  {
    id: 'cl-coulomb-net-2d',
    correct: 2 * f2d * (0.2 / r2d),
    flaws: [
      { misconceptionId: 'superposition-magnitude-add', wrong: 2 * f2d },
      { misconceptionId: 'inverse-square-error', wrong: 2 * f2dLinear * (0.2 / r2d) },
    ],
  },
  {
    // Four equal charges on a 0.10 m square; net on one corner lies along the
    // diagonal: F_side*sqrt(2) + F_diag, with F_diag = F_side/2.
    id: 'cl-coulomb-square-corner-net',
    correct: (K * 2.0e-6 * 2.0e-6) / (0.1 * 0.1) * (Math.SQRT2 + 0.5),
    flaws: [
      // Scalar sum of all three magnitudes: F_side + F_side + F_side/2 = 2.5 F_side.
      { misconceptionId: 'superposition-magnitude-add', wrong: 2.5 * ((K * 2.0e-6 * 2.0e-6) / (0.1 * 0.1)) },
      // Divides by r not r^2 throughout, then vector-sums along the diagonal.
      { misconceptionId: 'inverse-square-error', wrong: 1.5 * ((K * 2.0e-6 * 2.0e-6) / 0.1) * Math.SQRT2 },
    ],
  },
  {
    // Three equal charges on a 0.20 m equilateral triangle; net on one vertex is
    // sqrt(3) F along the symmetry axis (each force projects as F cos 30).
    id: 'cl-coulomb-triangle-net',
    correct: Math.sqrt(3) * ((K * 5.0e-6 * 5.0e-6) / (0.2 * 0.2)),
    flaws: [
      { misconceptionId: 'superposition-magnitude-add', wrong: 2 * ((K * 5.0e-6 * 5.0e-6) / (0.2 * 0.2)) },
      {
        misconceptionId: 'superposition-direction-error',
        wrong: 2 * ((K * 5.0e-6 * 5.0e-6) / (0.2 * 0.2)) * Math.cos(deg(60)),
      },
    ],
  },
  {
    // Inverse problem: F_net = F_left - F_right fixes the unknown right charge.
    // Q = (F_left - F_net) d^2 / (k q0), in coulombs (finalAnswer is "2.0e-6 C").
    id: 'cl-coulomb-solve-charge',
    correct: ((K * 3.0e-6 * 8.0e-6) / (0.2 * 0.2) - 4.05) * (0.2 * 0.2) / (K * 3.0e-6),
    flaws: [
      // Adds the forces instead of subtracting them.
      {
        misconceptionId: 'superposition-direction-error',
        wrong: ((K * 3.0e-6 * 8.0e-6) / (0.2 * 0.2) + 4.05) * (0.2 * 0.2) / (K * 3.0e-6),
      },
      // Drops the square on the distance when isolating Q.
      {
        misconceptionId: 'inverse-square-error',
        wrong: ((K * 3.0e-6 * 8.0e-6) / (0.2 * 0.2) - 4.05) * 0.2 / (K * 3.0e-6),
      },
    ],
  },
  {
    // Optimization: F = k q (Q - q) / r^2 is maximized at q = Q/2 = 6.0e-6 C.
    id: 'cl-coulomb-charge-split-max',
    correct: 12e-6 / 2,
    flaws: [
      // Loads the whole charge onto one part (q = Q), which gives zero force.
      { misconceptionId: 'optimization-endpoint-error', wrong: 12e-6 },
    ],
  },
  {
    id: 'mech-forces-incline',
    correct: 2.0 * 9.8 * Math.sin(deg(30)),
    flaws: [{ misconceptionId: 'incline-component-error', wrong: 2.0 * 9.8 * Math.cos(deg(30)) }],
  },
  {
    id: 'mech-energy-fall',
    correct: Math.sqrt(2 * 9.8 * 1.2),
    flaws: [
      { misconceptionId: 'energy-omits-sqrt', wrong: 2 * 9.8 * 1.2 },
      { misconceptionId: 'energy-factor-error', wrong: Math.sqrt(9.8 * 1.2) },
    ],
  },
  {
    id: 'mech-kinematics-drop',
    correct: 0.5 * 9.8 * 3.0 * 3.0,
    flaws: [
      { misconceptionId: 'kinematics-omits-half', wrong: 9.8 * 3.0 * 3.0 },
      { misconceptionId: 'kinematics-linear-time', wrong: 0.5 * 9.8 * 3.0 },
    ],
  },
];

describe('lesson 1 authored keys hit their golden values', () => {
  for (const testCase of CASES) {
    it(`${testCase.id} states a finalAnswer matching the recomputed physics`, () => {
      const key = getProblemKey(testCase.id);
      const stated = leadingNumber(key.finalAnswer);
      expect(Math.abs(stated - testCase.correct)).toBeLessThanOrEqual(
        Math.abs(testCase.correct) * 0.02 + 1e-12,
      );
      expect(key.correctSolution.length).toBeGreaterThan(0);
    });
  }
});

describe('each declared misconception yields a distinct wrong answer', () => {
  for (const testCase of CASES) {
    it(`${testCase.id} carries one diagnosable flaw per misconception`, () => {
      const key = getProblemKey(testCase.id);

      // The key declares exactly the misconceptions modelled here.
      expect(key.flaws.map((flaw) => flaw.misconceptionId).sort()).toEqual(
        testCase.flaws.map((flaw) => flaw.misconceptionId).sort(),
      );

      const distinctWrong = new Set<number>();
      for (const flaw of testCase.flaws) {
        const rel = Math.abs(flaw.wrong - testCase.correct) / Math.abs(testCase.correct);
        // A real misconception lands well outside the rounding band.
        expect(rel, `${testCase.id}:${flaw.misconceptionId}`).toBeGreaterThan(0.02);
        distinctWrong.add(Number(flaw.wrong.toPrecision(3)));

        const declared = key.flaws.find((entry) => entry.misconceptionId === flaw.misconceptionId);
        expect(declared, `${testCase.id}:${flaw.misconceptionId}`).toBeDefined();
        expect((declared?.signature.length ?? 0) > 0).toBe(true);
      }

      // The wrong answers are also distinct from one another.
      expect(distinctWrong.size).toBe(testCase.flaws.length);
    });
  }
});

describe('getProblemKey resolves every new static id without a fallback', () => {
  for (const testCase of CASES) {
    it(`resolves ${testCase.id} to a fully formed key`, () => {
      const key = getProblemKey(testCase.id);
      expect(key.problemId).toBe(testCase.id);
      expect(key.statement.length).toBeGreaterThan(0);
      expect(key.rubric.length).toBeGreaterThan(0);
      expect(key.finalAnswer.length).toBeGreaterThan(0);
    });
  }
});
