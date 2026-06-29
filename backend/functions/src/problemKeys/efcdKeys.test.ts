import { describe, it, expect } from 'vitest';
import type { ProblemKey } from '../types';
import { efcdRingAxis } from './efcd-ring-axis';
import { efcdArcCenter } from './efcd-arc-center';
import { efcdRodBisector } from './efcd-rod-bisector';
import { efcdInfiniteLine } from './efcd-infinite-line';
import { efcdDiskAxis } from './efcd-disk-axis';
import { efcdRodEndAxis } from './efcd-rod-end-axis';
import { efcdQuarterArcCenter } from './efcd-quarter-arc-center';

// Golden tests for the lesson 4 (Electric Fields of Charge Distributions) authored
// keys. Mirrors effKeys.test.ts: each key's finalAnswer is checked against the
// physics recomputed from the givens within 2 percent, and each declared
// misconception's wrong answer is recomputed and required to be distinct from the
// correct value and from the other flaws.

const K = 8.99e9;

const KEYS: Record<string, ProblemKey> = {
  [efcdRingAxis.problemId]: efcdRingAxis,
  [efcdArcCenter.problemId]: efcdArcCenter,
  [efcdRodBisector.problemId]: efcdRodBisector,
  [efcdInfiniteLine.problemId]: efcdInfiniteLine,
  [efcdDiskAxis.problemId]: efcdDiskAxis,
  [efcdRodEndAxis.problemId]: efcdRodEndAxis,
  [efcdQuarterArcCenter.problemId]: efcdQuarterArcCenter,
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

// efcd-arc-center: a semicircle, lambda = Q / (pi R).
const arcLambda = 6.0e-9 / (Math.PI * 0.05);
// efcd-disk-axis: infinite-sheet leading factor and the geometry factor.
const diskSheet = 2 * Math.PI * K * 2.0e-7;
const diskFactor = 1 - 0.05 / Math.sqrt(0.05 * 0.05 + 0.1 * 0.1);
const diskPointQ = 2.0e-7 * Math.PI * 0.1 * 0.1;
// efcd-quarter-arc-center: a quarter circle, lambda = 2 Q / (pi R); one component.
const quarterLambda = (2 * 4.0e-9) / (Math.PI * 0.04);
const quarterComponent = (K * quarterLambda) / 0.04;

const CASES: KeyCase[] = [
  {
    id: 'efcd-ring-axis',
    correct: (K * 5.0e-9 * 0.15) / Math.pow(0.15 * 0.15 + 0.1 * 0.1, 1.5),
    flaws: [
      { misconceptionId: 'distribution-as-point', wrong: (K * 5.0e-9) / (0.15 * 0.15) },
      { misconceptionId: 'forgot-component-projection', wrong: (K * 5.0e-9) / (0.15 * 0.15 + 0.1 * 0.1) },
    ],
  },
  {
    id: 'efcd-arc-center',
    correct: (2 * K * arcLambda) / 0.05,
    flaws: [
      { misconceptionId: 'distribution-as-point', wrong: (K * 6.0e-9) / (0.05 * 0.05) },
      { misconceptionId: 'arc-omits-factor-2', wrong: (K * arcLambda) / 0.05 },
    ],
  },
  {
    id: 'efcd-rod-bisector',
    correct: (K * 8.0e-9) / (0.06 * Math.sqrt(0.06 * 0.06 + 0.1 * 0.1)),
    flaws: [
      { misconceptionId: 'distribution-as-point', wrong: (K * 8.0e-9) / (0.06 * 0.06) },
      { misconceptionId: 'rod-bisector-geometry-error', wrong: (K * 8.0e-9) / (0.06 * 0.06 + 0.1 * 0.1) },
    ],
  },
  {
    id: 'efcd-infinite-line',
    correct: (2 * K * 4.0e-8) / 0.1,
    flaws: [
      { misconceptionId: 'line-uses-inverse-square', wrong: (2 * K * 4.0e-8) / (0.1 * 0.1) },
      { misconceptionId: 'line-omits-factor-2', wrong: (K * 4.0e-8) / 0.1 },
    ],
  },
  {
    id: 'efcd-disk-axis',
    correct: diskSheet * diskFactor,
    flaws: [
      { misconceptionId: 'disk-as-infinite-sheet', wrong: diskSheet },
      { misconceptionId: 'distribution-as-point', wrong: (K * diskPointQ) / (0.05 * 0.05) },
    ],
  },
  {
    id: 'efcd-rod-end-axis',
    correct: (K * 5.0e-9) / (0.1 * 0.3),
    flaws: [
      { misconceptionId: 'distribution-as-point', wrong: (K * 5.0e-9) / (0.1 * 0.1) },
      { misconceptionId: 'rod-end-uses-center', wrong: (K * 5.0e-9) / (0.2 * 0.2) },
    ],
  },
  {
    id: 'efcd-quarter-arc-center',
    correct: Math.SQRT2 * quarterComponent,
    flaws: [
      { misconceptionId: 'quarter-arc-omits-component', wrong: quarterComponent },
      { misconceptionId: 'distribution-as-point', wrong: (K * 4.0e-9) / (0.04 * 0.04) },
    ],
  },
];

describe('lesson 4 authored keys hit their golden values', () => {
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
        const rel = Math.abs(flaw.wrong - testCase.correct) / Math.abs(testCase.correct);
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

describe('every lesson 4 key is fully formed', () => {
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
