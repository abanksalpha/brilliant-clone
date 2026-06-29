import { describe, it, expect } from 'vitest';
import type { ProblemKey } from '../types';
import { effFieldPointChargeNc } from './eff-field-point-charge-nc';
import { effFieldSolveDistance } from './eff-field-solve-distance';
import { effFieldFromForce } from './eff-field-from-force';
import { effFieldCollinearNet } from './eff-field-collinear-net';
import { effFieldNullPoint } from './eff-field-null-point';
import { effFieldPerpBisector } from './eff-field-perp-bisector';
import { effFieldThenForce } from './eff-field-then-force';
import { effFieldProbeInvariance } from './eff-field-probe-invariance';
import { effFieldDistanceRatio } from './eff-field-distance-ratio';
import { effFieldTwoPositiveNet } from './eff-field-two-positive-net';

// Golden tests for the lesson 3 (Electric Field & Field Lines) authored keys.
// Mirrors problemKeys.test.ts: for each key we independently recompute the physics
// from the givens and assert the stated finalAnswer matches within 2 percent, then
// recompute each declared misconception's wrong answer and assert it is distinct
// from the correct one (so the mistake is diagnosable) and from the other flaws.
// These keys are not yet in the registry index (the orchestrator wires that), so
// they are imported directly here.

const K = 8.99e9;

// The keys under test, resolved locally rather than through getProblemKey.
const KEYS: Record<string, ProblemKey> = {
  [effFieldPointChargeNc.problemId]: effFieldPointChargeNc,
  [effFieldSolveDistance.problemId]: effFieldSolveDistance,
  [effFieldFromForce.problemId]: effFieldFromForce,
  [effFieldCollinearNet.problemId]: effFieldCollinearNet,
  [effFieldNullPoint.problemId]: effFieldNullPoint,
  [effFieldPerpBisector.problemId]: effFieldPerpBisector,
  [effFieldThenForce.problemId]: effFieldThenForce,
  [effFieldProbeInvariance.problemId]: effFieldProbeInvariance,
  [effFieldDistanceRatio.problemId]: effFieldDistanceRatio,
  [effFieldTwoPositiveNet.problemId]: effFieldTwoPositiveNet,
};

function key(id: string): ProblemKey {
  const found = KEYS[id];
  if (!found) throw new Error(`no key for ${id}`);
  return found;
}

// Pull the leading numeric magnitude out of a finalAnswer like "1.08e5 N/C".
function leadingNumber(text: string): number {
  const match = text.match(/-?\d[\d.]*(e-?\d+)?/i);
  if (!match) throw new Error(`no number found in "${text}"`);
  return Number(match[0]);
}

type FlawCase = { misconceptionId: string; wrong: number };
type KeyCase = { id: string; correct: number; flaws: FlawCase[] };

// eff-field-perp-bisector helpers: two equal sources, point off the line.
const rPerp = Math.sqrt(0.2 * 0.2 + 0.2 * 0.2);
const ePerpEach = (K * 4.0e-6) / (rPerp * rPerp);
const ePerpEachLinear = (K * 4.0e-6) / rPerp;

// eff-field-probe-invariance helper: the field the first probe measures.
const eProbe = 0.05 / 1.0e-6;

const CASES: KeyCase[] = [
  {
    id: 'eff-field-point-charge-nc',
    correct: (K * 30e-9) / (0.05 * 0.05),
    flaws: [{ misconceptionId: 'inverse-square-error', wrong: (K * 30e-9) / 0.05 }],
  },
  {
    id: 'eff-field-solve-distance',
    correct: Math.sqrt((K * 2.0e-6) / 5.0e5),
    flaws: [{ misconceptionId: 'field-solve-omits-sqrt', wrong: (K * 2.0e-6) / 5.0e5 }],
  },
  {
    id: 'eff-field-from-force',
    correct: 0.18 / 2.0e-6,
    flaws: [
      { misconceptionId: 'field-force-conflation', wrong: 0.18 },
      { misconceptionId: 'field-defining-ratio-inverted', wrong: 0.18 * 2.0e-6 },
    ],
  },
  {
    id: 'eff-field-collinear-net',
    correct: (K * 8.0e-6) / 0.04 + (K * 3.0e-6) / 0.04,
    flaws: [
      {
        misconceptionId: 'superposition-direction-error',
        wrong: (K * 8.0e-6) / 0.04 - (K * 3.0e-6) / 0.04,
      },
      { misconceptionId: 'inverse-square-error', wrong: (K * 8.0e-6) / 0.2 + (K * 3.0e-6) / 0.2 },
    ],
  },
  {
    id: 'eff-field-null-point',
    correct: 0.6 / 3,
    flaws: [
      { misconceptionId: 'null-point-sqrt-omitted', wrong: 0.6 / 5 },
      { misconceptionId: 'null-point-reference-error', wrong: 0.6 - 0.6 / 3 },
    ],
  },
  {
    id: 'eff-field-perp-bisector',
    correct: 2 * ePerpEach * (0.2 / rPerp),
    flaws: [
      { misconceptionId: 'superposition-magnitude-add', wrong: 2 * ePerpEach },
      { misconceptionId: 'inverse-square-error', wrong: 2 * ePerpEachLinear * (0.2 / rPerp) },
    ],
  },
  {
    id: 'eff-field-then-force',
    correct: 2.0e-6 * ((K * 6.0e-6) / (0.3 * 0.3)),
    flaws: [
      { misconceptionId: 'inverse-square-error', wrong: 2.0e-6 * ((K * 6.0e-6) / 0.3) },
      { misconceptionId: 'field-force-conflation', wrong: (K * 6.0e-6) / (0.3 * 0.3) },
    ],
  },
  {
    id: 'eff-field-probe-invariance',
    correct: 3.0e-6 * eProbe,
    flaws: [
      { misconceptionId: 'field-scales-with-probe', wrong: 3.0e-6 * (3 * eProbe) },
      { misconceptionId: 'field-probe-force-unchanged', wrong: 0.05 },
    ],
  },
  {
    id: 'eff-field-distance-ratio',
    correct: 9.0e5 / 9,
    flaws: [
      { misconceptionId: 'inverse-square-error', wrong: 9.0e5 / 3 },
      { misconceptionId: 'field-distance-direction-error', wrong: 9.0e5 * 9 },
    ],
  },
  {
    id: 'eff-field-two-positive-net',
    correct: (K * 12.0e-6) / 0.09 - (K * 3.0e-6) / 0.09,
    flaws: [
      {
        misconceptionId: 'superposition-direction-error',
        wrong: (K * 12.0e-6) / 0.09 + (K * 3.0e-6) / 0.09,
      },
      { misconceptionId: 'inverse-square-error', wrong: (K * 12.0e-6) / 0.3 - (K * 3.0e-6) / 0.3 },
    ],
  },
];

describe('lesson 3 authored keys hit their golden values', () => {
  for (const testCase of CASES) {
    it(`${testCase.id} states a finalAnswer matching the recomputed physics`, () => {
      const stated = leadingNumber(key(testCase.id).finalAnswer);
      expect(Math.abs(stated - testCase.correct)).toBeLessThanOrEqual(
        Math.abs(testCase.correct) * 0.02 + 1e-12,
      );
      expect(key(testCase.id).correctSolution.length).toBeGreaterThan(0);
    });
  }
});

describe('each declared misconception yields a distinct wrong answer', () => {
  for (const testCase of CASES) {
    it(`${testCase.id} carries one diagnosable flaw per misconception`, () => {
      const entry = key(testCase.id);

      // The key declares exactly the misconceptions modelled here.
      expect(entry.flaws.map((flaw) => flaw.misconceptionId).sort()).toEqual(
        testCase.flaws.map((flaw) => flaw.misconceptionId).sort(),
      );

      const distinctWrong = new Set<number>();
      for (const flaw of testCase.flaws) {
        const rel = Math.abs(flaw.wrong - testCase.correct) / Math.abs(testCase.correct);
        // A real misconception lands well outside the rounding band.
        expect(rel, `${testCase.id}:${flaw.misconceptionId}`).toBeGreaterThan(0.02);
        distinctWrong.add(Number(flaw.wrong.toPrecision(3)));

        const declared = entry.flaws.find((item) => item.misconceptionId === flaw.misconceptionId);
        expect(declared, `${testCase.id}:${flaw.misconceptionId}`).toBeDefined();
        expect((declared?.signature.length ?? 0) > 0).toBe(true);
      }

      // The wrong answers are also distinct from one another.
      expect(distinctWrong.size).toBe(testCase.flaws.length);
    });
  }
});

describe('every lesson 3 key is fully formed', () => {
  for (const testCase of CASES) {
    it(`${testCase.id} resolves to a complete key`, () => {
      const entry = key(testCase.id);
      expect(entry.problemId).toBe(testCase.id);
      expect(entry.statement.length).toBeGreaterThan(0);
      expect(entry.rubric.length).toBeGreaterThan(0);
      expect(entry.finalAnswer.length).toBeGreaterThan(0);
      expect(entry.flaws.length).toBeGreaterThan(0);
    });
  }
});
