import { describe, it, expect } from 'vitest';
import { generateVariant } from './generateVariant';
import { getProblemKey } from './problemKeys';
import { clFieldPointCharge } from './problemKeys/cl-field-point-charge';

describe('generateVariant', () => {
  it('derives the golden cl-field-point-charge variant', () => {
    const key = generateVariant('cl-field-point-charge', { q: 3.0e-6, r: 2.0 });
    expect(key.problemId).toBe('v1:cl-field-point-charge:q=0.000003;r=2');
    expect(key.finalAnswer).toBe('6.74e3 N/C');
    expect(key.flaws).toHaveLength(1);
    expect(key.flaws[0].misconceptionId).toBe('inverse-square-error');
    expect(key.flaws[0].signature).toContain('1.35e4');
  });

  it('throws on an out-of-range parameter and does not clamp', () => {
    expect(() => generateVariant('cl-field-point-charge', { q: 3.0e-6, r: 50 })).toThrow();
    expect(() => generateVariant('cl-field-point-charge', { q: 1.0e-3, r: 2.0 })).toThrow();
  });

  it('throws on a missing parameter', () => {
    expect(() => generateVariant('cl-field-point-charge', { q: 3.0e-6 })).toThrow();
  });

  it('throws on an unknown template', () => {
    expect(() => generateVariant('not-a-template', { q: 1, r: 1 })).toThrow();
  });
});

describe('getProblemKey', () => {
  it('derives a v1 variant key from its id and matches a direct call', () => {
    const fromId = getProblemKey('v1:cl-field-point-charge:q=0.000003;r=2');
    const direct = generateVariant('cl-field-point-charge', { q: 3.0e-6, r: 2.0 });
    expect(fromId).toEqual(direct);
    expect(fromId.finalAnswer).toBe('6.74e3 N/C');
  });

  it('still returns the static key for a plain id', () => {
    expect(getProblemKey('cl-field-point-charge')).toEqual(clFieldPointCharge);
  });

  it('throws on an unknown plain id', () => {
    expect(() => getProblemKey('does-not-exist')).toThrow();
  });
});
