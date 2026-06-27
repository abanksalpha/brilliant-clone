import { describe, it, expect } from 'vitest';
import { getTemplate, serializeVariantId, parseVariantId } from './index';

describe('serializeVariantId and parseVariantId', () => {
  it('round trips params and sorts keys ascending', () => {
    const templateId = 'cl-field-point-charge';
    const params = { q: 3.0e-6, r: 2.0 };
    const id = serializeVariantId(templateId, params);
    expect(id).toBe('v1:cl-field-point-charge:q=0.000003;r=2');
    expect(parseVariantId(id)).toEqual({ templateId, params });
  });

  it('sorts keys regardless of insertion order', () => {
    const id = serializeVariantId('cl-midpoint-field-potential', { q: 5.0e-6, d: 0.4 });
    expect(id).toBe('v1:cl-midpoint-field-potential:d=0.4;q=0.000005');
    expect(parseVariantId(id)).toEqual({
      templateId: 'cl-midpoint-field-potential',
      params: { d: 0.4, q: 5.0e-6 },
    });
  });

  it('throws when the id does not start with the v1 prefix', () => {
    expect(() => parseVariantId('cl-field-point-charge')).toThrow();
    expect(() => parseVariantId('v2:cl-field-point-charge:q=0.000003')).toThrow();
  });

  it('throws on a malformed id', () => {
    expect(() => parseVariantId('v1:cl-field-point-charge')).toThrow();
    expect(() => parseVariantId('v1:cl-field-point-charge:q')).toThrow();
    expect(() => parseVariantId('v1:cl-field-point-charge:q=abc')).toThrow();
    expect(() => parseVariantId('v1:cl-field-point-charge:=5')).toThrow();
    expect(() => parseVariantId('v1::q=1')).toThrow();
  });
});

describe('getTemplate', () => {
  it('throws on an unknown template id', () => {
    expect(() => getTemplate('not-a-template')).toThrow('unknown template: not-a-template');
  });

  it('returns each registered template', () => {
    expect(getTemplate('cl-coulomb-force-two-charges').templateId).toBe('cl-coulomb-force-two-charges');
    expect(getTemplate('cl-coulomb-force-collinear').templateId).toBe('cl-coulomb-force-collinear');
    expect(getTemplate('cl-field-point-charge').templateId).toBe('cl-field-point-charge');
    expect(getTemplate('cl-midpoint-field-potential').templateId).toBe('cl-midpoint-field-potential');
    expect(getTemplate('cl-two-charge-superposition').templateId).toBe('cl-two-charge-superposition');
  });

  it('tags the Coulomb force templates with the coulombs-law skill', () => {
    expect(getTemplate('cl-coulomb-force-two-charges').skillIds).toEqual(['coulombs-law']);
    expect(getTemplate('cl-coulomb-force-collinear').skillIds).toEqual(['coulombs-law']);
  });

  it('tags the field templates with their field skills, not coulombs-law', () => {
    expect(getTemplate('cl-field-point-charge').skillIds).toEqual(['electric-field-field-lines']);
    expect(getTemplate('cl-midpoint-field-potential').skillIds).toEqual([
      'electric-fields-of-charge-distributions',
    ]);
    expect(getTemplate('cl-two-charge-superposition').skillIds).toEqual([
      'electric-fields-of-charge-distributions',
    ]);
  });
});

describe('template solve hits its golden value', () => {
  it('cl-field-point-charge q=3.0e-6 r=2.0 gives 6.74e3 N/C', () => {
    const solved = getTemplate('cl-field-point-charge').solve({ q: 3.0e-6, r: 2.0 });
    expect(solved.finalAnswer).toBe('6.74e3 N/C');
    expect(solved.correctSolution.length).toBeGreaterThan(0);
  });

  it('cl-midpoint-field-potential q=5.0e-6 d=0.40 gives 2.25e6 N/C', () => {
    const solved = getTemplate('cl-midpoint-field-potential').solve({ q: 5.0e-6, d: 0.4 });
    expect(solved.finalAnswer).toBe('2.25e6 N/C');
    expect(solved.correctSolution.length).toBeGreaterThan(0);
  });

  it('cl-two-charge-superposition nets to 0 N/C by symmetry', () => {
    const solved = getTemplate('cl-two-charge-superposition').solve({ q: 4.0e-6, d: 0.6 });
    expect(solved.finalAnswer).toBe('0 N/C');
    expect(solved.correctSolution.length).toBeGreaterThan(0);
  });

  it('cl-coulomb-force-two-charges q1=2.0e-6 q2=3.0e-6 r=0.10 gives 5.39e0 N', () => {
    const solved = getTemplate('cl-coulomb-force-two-charges').solve({ q1: 2.0e-6, q2: 3.0e-6, r: 0.1 });
    expect(solved.finalAnswer).toBe('5.39e0 N');
    expect(solved.correctSolution.length).toBeGreaterThan(0);
  });

  it('cl-coulomb-force-collinear a=1.0e-6 b=5.0e-6 q=2.0e-6 d=0.40 nets to 1.80e0 N', () => {
    const solved = getTemplate('cl-coulomb-force-collinear').solve({
      a: 1.0e-6,
      b: 5.0e-6,
      q: 2.0e-6,
      d: 0.4,
    });
    expect(solved.finalAnswer).toBe('1.80e0 N');
    expect(solved.correctSolution.length).toBeGreaterThan(0);
  });
});

describe('buggyPath produces a wrong-answer signature', () => {
  const cases = [
    { templateId: 'cl-field-point-charge', params: { q: 3.0e-6, r: 2.0 } },
    { templateId: 'cl-midpoint-field-potential', params: { q: 5.0e-6, d: 0.4 } },
    { templateId: 'cl-two-charge-superposition', params: { q: 4.0e-6, d: 0.6 } },
    { templateId: 'cl-coulomb-force-two-charges', params: { q1: 2.0e-6, q2: 3.0e-6, r: 0.1 } },
    { templateId: 'cl-coulomb-force-collinear', params: { a: 1.0e-6, b: 5.0e-6, q: 2.0e-6, d: 0.4 } },
  ];

  it('each buggyPath returns a non-empty signature distinct from the correct final answer', () => {
    for (const testCase of cases) {
      const template = getTemplate(testCase.templateId);
      const correctFinalAnswer = template.solve(testCase.params).finalAnswer;
      expect(template.flaws.length).toBeGreaterThan(0);
      for (const flaw of template.flaws) {
        const signature = flaw.buggyPath(testCase.params);
        expect(signature.length).toBeGreaterThan(0);
        expect(signature).not.toBe(correctFinalAnswer);
      }
    }
  });

  it('cl-field-point-charge inverse-square signature mentions the linear-distance magnitude', () => {
    const flaw = getTemplate('cl-field-point-charge').flaws[0];
    expect(flaw.misconceptionId).toBe('inverse-square-error');
    expect(flaw.buggyPath({ q: 3.0e-6, r: 2.0 })).toContain('1.35e4');
  });
});

// Cross-package golden invariant: the variant id format and the statement text
// MUST stay byte-for-byte identical to the public frontend templates
// (frontend/src/content/templates/index.test.ts) so a student's numbers equal
// the graded numbers. These literals are duplicated verbatim in that file; if
// either side changes its output, exactly one of the two suites breaks.
const TEMPLATE_GOLDENS: {
  templateId: string;
  params: Record<string, number>;
  id: string;
  statement: string;
}[] = [
  {
    templateId: 'cl-coulomb-force-two-charges',
    params: { q1: 2.0e-6, q2: 3.0e-6, r: 0.1 },
    id: 'v1:cl-coulomb-force-two-charges:q1=0.000002;q2=0.000003;r=0.1',
    statement:
      'Two point charges, +2 microcoulomb and +3 microcoulomb, are 0.1 m apart. Find the magnitude of the electric force between them. Use k = 8.99e9 N m^2/C^2.',
  },
  {
    templateId: 'cl-coulomb-force-collinear',
    params: { a: 1.0e-6, b: 5.0e-6, q: 2.0e-6, d: 0.4 },
    id: 'v1:cl-coulomb-force-collinear:a=0.000001;b=0.000005;d=0.4;q=0.000002',
    statement:
      'A +1 microcoulomb charge and a +5 microcoulomb charge are 0.4 m apart. A +2 microcoulomb charge sits at the midpoint between them. Find the magnitude of the net electric force on the midpoint charge. Use k = 8.99e9 N m^2/C^2.',
  },
  {
    templateId: 'cl-field-point-charge',
    params: { q: 3.0e-6, r: 2.0 },
    id: 'v1:cl-field-point-charge:q=0.000003;r=2',
    statement:
      'Find the magnitude of the electric field at a point 2 m from a +3 microcoulomb point charge. Use k = 8.99e9 N m^2/C^2.',
  },
  {
    templateId: 'cl-midpoint-field-potential',
    params: { q: 5.0e-6, d: 0.4 },
    id: 'v1:cl-midpoint-field-potential:d=0.4;q=0.000005',
    statement:
      'A +5 microcoulomb charge and a -5 microcoulomb charge are 0.4 m apart. Find the magnitude of the electric field at the exact midpoint between them. Use k = 8.99e9 N m^2/C^2.',
  },
  {
    templateId: 'cl-two-charge-superposition',
    params: { q: 4.0e-6, d: 0.6 },
    id: 'v1:cl-two-charge-superposition:d=0.6;q=0.000004',
    statement:
      'Two +4 microcoulomb charges sit 0.6 m apart. Find the magnitude of the net electric field at the midpoint between them. Use k = 8.99e9 N m^2/C^2.',
  },
];

describe('template cross-package golden invariant (backend side)', () => {
  for (const golden of TEMPLATE_GOLDENS) {
    it(`${golden.templateId} serializes the golden id and statement`, () => {
      expect(serializeVariantId(golden.templateId, golden.params)).toBe(golden.id);
      expect(getTemplate(golden.templateId).renderStatement(golden.params)).toBe(golden.statement);
    });
  }
});
