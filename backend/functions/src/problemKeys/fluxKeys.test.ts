import { describe, it, expect } from 'vitest';
import type { ProblemKey } from '../types';
import { fluxFlatTilted } from './flux-flat-tilted';
import { fluxSolveAngle } from './flux-solve-angle';
import { fluxCubeUniform } from './flux-cube-uniform';
import { fluxPointChargeEnclosed } from './flux-point-charge-enclosed';
import { fluxNetEnclosedCharges } from './flux-net-enclosed-charges';
import { fluxDiskTilted } from './flux-disk-tilted';
import { fluxHemisphereUniform } from './flux-hemisphere-uniform';

// Golden tests for the lesson 5 (Electric Flux) authored keys. Mirrors effKeys.test
// and efcdKeys.test: each key's finalAnswer is recomputed from the givens and checked
// within 2 percent, and each declared misconception's wrong answer is recomputed and
// required to be distinct from the correct value and from the other flaws.

const K = 8.99e9;
const EPS0 = 8.85e-12;
const deg = (d: number) => (d * Math.PI) / 180;

const KEYS: Record<string, ProblemKey> = {
  [fluxFlatTilted.problemId]: fluxFlatTilted,
  [fluxSolveAngle.problemId]: fluxSolveAngle,
  [fluxCubeUniform.problemId]: fluxCubeUniform,
  [fluxPointChargeEnclosed.problemId]: fluxPointChargeEnclosed,
  [fluxNetEnclosedCharges.problemId]: fluxNetEnclosedCharges,
  [fluxDiskTilted.problemId]: fluxDiskTilted,
  [fluxHemisphereUniform.problemId]: fluxHemisphereUniform,
};

function key(id: string): ProblemKey {
  const found = KEYS[id];
  if (!found) throw new Error(`no key for ${id}`);
  return found;
}

function leadingNumber(text: string): number {
  const match = text.match(/-?\d[\d.]*(e-?\d+)?/i);
  if (!match) throw new Error(`no number found in "${text}"`);
  return Number(match[0]);
}

type FlawCase = { misconceptionId: string; wrong: number };
type KeyCase = { id: string; correct: number; flaws: FlawCase[] };

const diskArea = Math.PI * 0.1 * 0.1;
const hemiArea = Math.PI * 0.05 * 0.05;

const CASES: KeyCase[] = [
  {
    id: 'flux-flat-tilted',
    correct: 300 * 0.04 * Math.cos(deg(30)),
    flaws: [
      { misconceptionId: 'flux-ignores-angle', wrong: 300 * 0.04 },
      { misconceptionId: 'flux-uses-sin', wrong: 300 * 0.04 * Math.sin(deg(30)) },
    ],
  },
  {
    id: 'flux-solve-angle',
    correct: 60,
    flaws: [
      { misconceptionId: 'flux-ignores-angle', wrong: 0 },
      { misconceptionId: 'flux-uses-sin', wrong: 30 },
    ],
  },
  {
    id: 'flux-cube-uniform',
    correct: 0,
    flaws: [
      { misconceptionId: 'flux-closed-empty-nonzero', wrong: 300 * 0.1 * 0.1 },
      { misconceptionId: 'flux-sums-face-magnitudes', wrong: 2 * 300 * 0.1 * 0.1 },
    ],
  },
  {
    id: 'flux-point-charge-enclosed',
    correct: 5.0e-9 / EPS0,
    flaws: [
      { misconceptionId: 'flux-uses-coulomb-constant', wrong: K * 5.0e-9 },
      { misconceptionId: 'flux-half-surface', wrong: 5.0e-9 / (2 * EPS0) },
    ],
  },
  {
    id: 'flux-net-enclosed-charges',
    correct: 10.0e-9 / EPS0,
    flaws: [
      { misconceptionId: 'flux-includes-external', wrong: 16.0e-9 / EPS0 },
      { misconceptionId: 'flux-uses-coulomb-constant', wrong: K * 10.0e-9 },
    ],
  },
  {
    id: 'flux-disk-tilted',
    correct: 500 * diskArea * Math.cos(deg(30)),
    flaws: [
      { misconceptionId: 'flux-ignores-angle', wrong: 500 * diskArea },
      { misconceptionId: 'flux-uses-sin', wrong: 500 * diskArea * Math.sin(deg(30)) },
    ],
  },
  {
    id: 'flux-hemisphere-uniform',
    correct: 400 * hemiArea,
    flaws: [
      { misconceptionId: 'flux-uses-curved-area', wrong: 400 * 2 * hemiArea },
      { misconceptionId: 'flux-radius-diameter', wrong: 400 * Math.PI * 0.1 * 0.1 },
    ],
  },
];

describe('lesson 5 authored keys hit their golden values', () => {
  for (const testCase of CASES) {
    it(`${testCase.id} states a finalAnswer matching the recomputed physics`, () => {
      const stated = leadingNumber(key(testCase.id).finalAnswer);
      expect(Math.abs(stated - testCase.correct)).toBeLessThanOrEqual(Math.abs(testCase.correct) * 0.02 + 1e-12);
      expect(key(testCase.id).correctSolution.length).toBeGreaterThan(0);
    });
  }
});

describe('each declared misconception yields a distinct wrong answer', () => {
  for (const testCase of CASES) {
    it(`${testCase.id} carries one diagnosable flaw per misconception`, () => {
      const entry = key(testCase.id);
      expect(entry.flaws.map((flaw) => flaw.misconceptionId).sort()).toEqual(
        testCase.flaws.map((flaw) => flaw.misconceptionId).sort(),
      );

      const distinctWrong = new Set<number>();
      for (const flaw of testCase.flaws) {
        const denom = Math.abs(testCase.correct) < 1e-12 ? 1 : Math.abs(testCase.correct);
        const rel = Math.abs(flaw.wrong - testCase.correct) / denom;
        expect(rel, `${testCase.id}:${flaw.misconceptionId}`).toBeGreaterThan(0.02);
        distinctWrong.add(Number(flaw.wrong.toPrecision(3)));

        const declared = entry.flaws.find((item) => item.misconceptionId === flaw.misconceptionId);
        expect(declared, `${testCase.id}:${flaw.misconceptionId}`).toBeDefined();
        expect((declared?.signature.length ?? 0) > 0).toBe(true);
      }
      expect(distinctWrong.size).toBe(testCase.flaws.length);
    });
  }
});

describe('every lesson 5 key is fully formed', () => {
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
