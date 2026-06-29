import { describe, it, expect } from 'vitest';
import type { ProblemKey } from '../types';
import { gaussSphereOutside } from './gauss-sphere-outside';
import { gaussInfiniteSheet } from './gauss-infinite-sheet';
import { gaussConductorSurface } from './gauss-conductor-surface';
import { gaussSolidSphereInside } from './gauss-solid-sphere-inside';
import { gaussTwoSheets } from './gauss-two-sheets';
import { gaussInfiniteLine } from './gauss-infinite-line';
import { gaussShellInside } from './gauss-shell-inside';

// Golden tests for the lesson 6 (Gauss's Law) authored keys. Mirrors the other key
// golden suites: each key's finalAnswer is recomputed from the givens within 2
// percent, and each declared misconception's wrong answer is recomputed and required
// to be distinct from the correct value and from the other flaws.

const K = 8.99e9;
const EPS0 = 8.85e-12;

const KEYS: Record<string, ProblemKey> = {
  [gaussSphereOutside.problemId]: gaussSphereOutside,
  [gaussInfiniteSheet.problemId]: gaussInfiniteSheet,
  [gaussConductorSurface.problemId]: gaussConductorSurface,
  [gaussSolidSphereInside.problemId]: gaussSolidSphereInside,
  [gaussTwoSheets.problemId]: gaussTwoSheets,
  [gaussInfiniteLine.problemId]: gaussInfiniteLine,
  [gaussShellInside.problemId]: gaussShellInside,
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

const CASES: KeyCase[] = [
  {
    id: 'gauss-sphere-outside',
    correct: (K * 8.0e-9) / (0.2 * 0.2),
    flaws: [
      { misconceptionId: 'gauss-surface-not-distance', wrong: (K * 8.0e-9) / (0.1 * 0.1) },
      { misconceptionId: 'inverse-square-error', wrong: (K * 8.0e-9) / 0.2 },
    ],
  },
  {
    id: 'gauss-infinite-sheet',
    correct: 4.0e-8 / (2 * EPS0),
    flaws: [
      { misconceptionId: 'sheet-uses-conductor-formula', wrong: 4.0e-8 / EPS0 },
      { misconceptionId: 'sheet-uses-coulomb', wrong: K * 4.0e-8 },
    ],
  },
  {
    id: 'gauss-conductor-surface',
    correct: 5.0e-8 / EPS0,
    flaws: [
      { misconceptionId: 'conductor-uses-sheet-formula', wrong: 5.0e-8 / (2 * EPS0) },
      { misconceptionId: 'conductor-uses-coulomb', wrong: K * 5.0e-8 },
    ],
  },
  {
    id: 'gauss-solid-sphere-inside',
    correct: (K * 12.0e-9 * 0.05) / Math.pow(0.1, 3),
    flaws: [
      { misconceptionId: 'inside-uses-point', wrong: (K * 12.0e-9) / (0.05 * 0.05) },
      { misconceptionId: 'inside-assumes-zero', wrong: 0 },
    ],
  },
  {
    id: 'gauss-two-sheets',
    correct: 3.0e-8 / EPS0,
    flaws: [
      { misconceptionId: 'between-uses-single-sheet', wrong: 3.0e-8 / (2 * EPS0) },
      { misconceptionId: 'between-double-counts', wrong: (2 * 3.0e-8) / EPS0 },
    ],
  },
  {
    id: 'gauss-infinite-line',
    correct: (2 * K * 5.0e-8) / 0.08,
    flaws: [
      { misconceptionId: 'line-uses-inverse-square', wrong: (2 * K * 5.0e-8) / (0.08 * 0.08) },
      { misconceptionId: 'line-omits-factor-2', wrong: (K * 5.0e-8) / 0.08 },
    ],
  },
  {
    id: 'gauss-shell-inside',
    correct: 0,
    flaws: [
      { misconceptionId: 'inside-uses-point', wrong: (K * 6.0e-9) / (0.04 * 0.04) },
      { misconceptionId: 'inside-uses-surface', wrong: (K * 6.0e-9) / (0.1 * 0.1) },
    ],
  },
];

describe('lesson 6 authored keys hit their golden values', () => {
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

describe('every lesson 6 key is fully formed', () => {
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
