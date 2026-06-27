import { describe, it, expect } from 'vitest';
import { parseQuantity, answersAgree, verifyProblem, type IndependentSolve } from './verifyProblem';
import type { SynthesisCandidate } from './types';

function baseCandidate(overrides: Partial<SynthesisCandidate> = {}): SynthesisCandidate {
  return {
    problemId: 'syn:test',
    statement:
      'A 3.0 microcoulomb charge sits 2.0 m from point P. Find the field at P, then the force on a 1.0 C charge placed there.',
    skillIds: ['coulomb', 'field-to-force'],
    principleIds: ['coulomb-field', 'field-to-force'],
    misconceptionTags: ['inverse-square-error'],
    difficultyBand: 3,
    correctSolution: ['E = k q / r^2', 'F = q E'],
    finalAnswer: '6.74e3 N/C',
    rubric: 'Award credit for computing the field, then the force.',
    flaws: [
      { misconceptionId: 'inverse-square-error', signature: 'divides by r not r^2', wrongAnswer: '1.35e4 N/C' },
    ],
    ...overrides,
  };
}

const agreeingSolve: IndependentSolve = async () => '6.74e3 N/C';
const disagreeingSolve: IndependentSolve = async () => '9.99e9 N/C';

describe('parseQuantity', () => {
  it('parses scientific notation with a unit', () => {
    expect(parseQuantity('2.25e6 N/C')).toEqual({ value: 2.25e6, unit: 'N/C' });
  });

  it('parses a signed decimal with no unit', () => {
    expect(parseQuantity('-3.0')).toEqual({ value: -3, unit: '' });
  });

  it('parses zero with a unit', () => {
    expect(parseQuantity('0 N/C')).toEqual({ value: 0, unit: 'N/C' });
  });

  it('returns null when no leading number parses', () => {
    expect(parseQuantity('abc')).toBeNull();
  });
});

describe('answersAgree', () => {
  it('treats scientific and decimal forms of the same value as equal', () => {
    expect(answersAgree('6.74e3 N/C', '6740 N/C')).toBe(true);
  });

  it('rejects values that differ beyond the tolerance', () => {
    expect(answersAgree('1.35e4 N/C', '6.74e3 N/C')).toBe(false);
  });

  it('rejects a unit mismatch', () => {
    expect(answersAgree('5 m', '5 s')).toBe(false);
  });

  it('accepts agreement when one side has no unit', () => {
    expect(answersAgree('5', '5 N')).toBe(true);
  });

  it('treats two zeros as agreeing', () => {
    expect(answersAgree('0 N/C', '0 N/C')).toBe(true);
  });
});

describe('verifyProblem', () => {
  it('passes a well formed two principle candidate whose re-solve agrees', async () => {
    const result = await verifyProblem(baseCandidate(), agreeingSolve);
    expect(result).toEqual({ ok: true });
  });

  it('fails when only one principle is chained', async () => {
    const result = await verifyProblem(baseCandidate({ principleIds: ['coulomb-field'] }), agreeingSolve);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasons).toContain('must chain at least two principles');
    }
  });

  it('fails when the independent re-solve disagrees with the stated answer', async () => {
    const result = await verifyProblem(baseCandidate(), disagreeingSolve);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasons).toContain('independent re-solve disagreed with the stated answer');
    }
  });

  it('fails when a flaw wrongAnswer equals the correct answer', async () => {
    const candidate = baseCandidate({
      flaws: [{ misconceptionId: 'inverse-square-error', signature: 'x', wrongAnswer: '6.74e3 N/C' }],
    });
    const result = await verifyProblem(candidate, agreeingSolve);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasons).toContain('flaw inverse-square-error does not produce a distinct wrong answer');
    }
  });

  it('fails when two flaws produce duplicate wrong answers', async () => {
    const candidate = baseCandidate({
      flaws: [
        { misconceptionId: 'inverse-square-error', signature: 'divides by r', wrongAnswer: '1.35e4 N/C' },
        { misconceptionId: 'unit-confusion', signature: 'wrong unit step', wrongAnswer: '13500 N/C' },
      ],
    });
    const result = await verifyProblem(candidate, agreeingSolve);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasons).toContain('flaws produce duplicate wrong answers');
    }
  });

  it('passes when flaws produce pairwise distinct wrong answers', async () => {
    const candidate = baseCandidate({
      flaws: [
        { misconceptionId: 'inverse-square-error', signature: 'divides by r', wrongAnswer: '1.35e4 N/C' },
        { misconceptionId: 'halves-field', signature: 'halves the field', wrongAnswer: '3.37e3 N/C' },
      ],
    });
    const result = await verifyProblem(candidate, agreeingSolve);
    expect(result).toEqual({ ok: true });
  });

  it('fails when the final answer is not a parseable quantity', async () => {
    const result = await verifyProblem(baseCandidate({ finalAnswer: 'no number here' }), agreeingSolve);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasons).toContain('final answer is not a parseable quantity');
    }
  });

  it('fails when no misconception flaws are declared', async () => {
    const result = await verifyProblem(baseCandidate({ flaws: [] }), agreeingSolve);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reasons).toContain('must declare at least one misconception flaw');
    }
  });
});
