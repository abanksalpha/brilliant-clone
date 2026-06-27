import { describe, it, expect } from 'vitest';
import {
  PUBLIC_TEMPLATES,
  getPublicTemplate,
  serializeVariantId,
  parseVariantId,
  drawParams,
  generateVariantProblem,
  type ParamRange,
} from './index';

// Keys that would leak a grading key into the public bundle. Answers are
// re-derived on the server, so none of these may appear in a public object.
const BANNED_KEYS = new Set(['answer', 'solution', 'correct', 'finalanswer']);

function collectKeys(value: unknown, found: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, found);
  } else if (value !== null && typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      found.push(key);
      collectKeys(child, found);
    }
  }
  return found;
}

function isOnGrid(value: number, range: ParamRange): boolean {
  if (value < range.min - 1e-9 || value > range.max + 1e-9) return false;
  const steps = (value - range.min) / range.step;
  return Math.abs(steps - Math.round(steps)) < 1e-6;
}

describe('serializeVariantId and parseVariantId', () => {
  it('round trips params, sorts keys ascending, and matches the backend string', () => {
    const templateId = 'cl-field-point-charge';
    const params = { q: 3.0e-6, r: 2.0 };
    const id = serializeVariantId(templateId, params);
    expect(id).toBe('v1:cl-field-point-charge:q=0.000003;r=2');
    expect(parseVariantId(id)).toEqual({ templateId, params });
  });

  it('sorts keys regardless of insertion order (matches the backend)', () => {
    const id = serializeVariantId('cl-midpoint-field-potential', { q: 5.0e-6, d: 0.4 });
    expect(id).toBe('v1:cl-midpoint-field-potential:d=0.4;q=0.000005');
    expect(parseVariantId(id)).toEqual({
      templateId: 'cl-midpoint-field-potential',
      params: { d: 0.4, q: 5.0e-6 },
    });
  });

  it('throws when the id is not a v1 id', () => {
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

describe('getPublicTemplate', () => {
  it('throws on an unknown template id', () => {
    expect(() => getPublicTemplate('not-a-template')).toThrow('unknown template: not-a-template');
  });

  it('returns each of the five registered templates', () => {
    expect(PUBLIC_TEMPLATES).toHaveLength(5);
    expect(getPublicTemplate('cl-coulomb-force-two-charges').templateId).toBe(
      'cl-coulomb-force-two-charges',
    );
    expect(getPublicTemplate('cl-coulomb-force-collinear').templateId).toBe(
      'cl-coulomb-force-collinear',
    );
    expect(getPublicTemplate('cl-field-point-charge').templateId).toBe('cl-field-point-charge');
    expect(getPublicTemplate('cl-midpoint-field-potential').templateId).toBe(
      'cl-midpoint-field-potential',
    );
    expect(getPublicTemplate('cl-two-charge-superposition').templateId).toBe(
      'cl-two-charge-superposition',
    );
  });

  it('tags the Coulomb force templates with the coulombs-law skill', () => {
    expect(getPublicTemplate('cl-coulomb-force-two-charges').skillIds).toEqual(['coulombs-law']);
    expect(getPublicTemplate('cl-coulomb-force-collinear').skillIds).toEqual(['coulombs-law']);
  });

  it('tags the field templates with their field skills, not coulombs-law', () => {
    expect(getPublicTemplate('cl-field-point-charge').skillIds).toEqual(['electric-field-field-lines']);
    expect(getPublicTemplate('cl-midpoint-field-potential').skillIds).toEqual([
      'electric-fields-of-charge-distributions',
    ]);
    expect(getPublicTemplate('cl-two-charge-superposition').skillIds).toEqual([
      'electric-fields-of-charge-distributions',
    ]);
  });
});

describe('renderStatement', () => {
  it('cl-field-point-charge q=3.0e-6 r=2.0 renders the exact public statement', () => {
    const statement = getPublicTemplate('cl-field-point-charge').renderStatement({
      q: 3.0e-6,
      r: 2.0,
    });
    expect(statement).toBe(
      'Find the magnitude of the electric field at a point 2 m from a +3 microcoulomb point charge. Use k = 8.99e9 N m^2/C^2.',
    );
    expect(statement).toContain('2 m');
    expect(statement).toContain('3 microcoulomb');
  });

  it('renders charges in microcoulomb as the word, never a symbol', () => {
    for (const template of PUBLIC_TEMPLATES) {
      const params = drawParams(template.templateId, 7);
      const statement = template.renderStatement(params);
      expect(statement).toContain('microcoulomb');
      expect(statement).not.toContain('\u00b5');
      expect(statement).not.toContain('\u2014');
    }
  });
});

describe('drawParams', () => {
  it('is deterministic for the same seed', () => {
    const a = drawParams('cl-field-point-charge', 123);
    const b = drawParams('cl-field-point-charge', 123);
    expect(a).toEqual(b);
  });

  it('draws on-grid, in-range params for every template', () => {
    for (const template of PUBLIC_TEMPLATES) {
      for (let seed = 0; seed < 25; seed++) {
        const params = drawParams(template.templateId, seed);
        for (const key of Object.keys(template.paramSpec)) {
          expect(isOnGrid(params[key], template.paramSpec[key]), `${template.templateId}.${key}`).toBe(
            true,
          );
        }
      }
    }
  });

  it('can yield a different draw for a different seed', () => {
    const base = JSON.stringify(drawParams('cl-field-point-charge', 123));
    const differs = Array.from({ length: 50 }, (_, i) => i).some(
      (seed) => JSON.stringify(drawParams('cl-field-point-charge', seed)) !== base,
    );
    expect(differs).toBe(true);
  });

  it('throws for an unknown template', () => {
    expect(() => drawParams('not-a-template', 1)).toThrow();
  });
});

describe('generateVariantProblem', () => {
  it('returns a public variant Problem with the right tags and no answers', () => {
    const params = drawParams('cl-field-point-charge', 123);
    const problem = generateVariantProblem('cl-field-point-charge', params);

    expect(problem.provenance).toBe('variant');
    expect(problem.templateId).toBe('cl-field-point-charge');
    expect(problem.problemId).toBe(serializeVariantId('cl-field-point-charge', params));
    expect(problem.lessonId).toBe('electric-field-field-lines');
    expect(problem.unitId).toBe('electrostatics');
    expect(problem.skillIds).toEqual(['electric-field-field-lines']);
    expect(problem.principleIds).toEqual(['field-concept']);
    expect(problem.misconceptionTags).toEqual(['inverse-square-error']);
    expect(problem.kind).toBe('single');
    expect(problem.difficultyBand).toBe(2);
    expect(problem.title.length).toBeGreaterThan(0);
    expect(problem.prompt).toBe(getPublicTemplate('cl-field-point-charge').renderStatement(params));

    for (const key of collectKeys(problem)) {
      expect(BANNED_KEYS.has(key.toLowerCase()), `leaked key ${key}`).toBe(false);
    }
  });

  it('produces a variant Problem with no leaked answer key for every template and seed', () => {
    for (const template of PUBLIC_TEMPLATES) {
      for (let seed = 0; seed < 10; seed++) {
        const params = drawParams(template.templateId, seed);
        const problem = generateVariantProblem(template.templateId, params);
        expect(problem.provenance).toBe('variant');
        expect(problem.skillIds, template.templateId).toContain(problem.lessonId);
        for (const key of collectKeys(problem)) {
          expect(BANNED_KEYS.has(key.toLowerCase()), `${template.templateId} leaked ${key}`).toBe(
            false,
          );
        }
      }
    }
  });

  it('throws for an unknown template', () => {
    expect(() => generateVariantProblem('not-a-template', { q: 3.0e-6, r: 2.0 })).toThrow();
  });

  it('throws on out-of-range params (no fallback)', () => {
    expect(() => generateVariantProblem('cl-field-point-charge', { q: 3.0e-6, r: 999 })).toThrow();
    expect(() => generateVariantProblem('cl-field-point-charge', { q: 3.0e-6, r: 0.1 })).toThrow();
  });
});

// Cross-package golden invariant: the variant id format and the statement text
// MUST stay byte-for-byte identical to the backend seed templates
// (backend/functions/src/templates/templates.test.ts) so a student's numbers
// equal the graded numbers. These literals are duplicated verbatim in that file;
// if either side changes its output, exactly one of the two suites breaks.
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

describe('template cross-package golden invariant (frontend side)', () => {
  for (const golden of TEMPLATE_GOLDENS) {
    it(`${golden.templateId} serializes the golden id and statement`, () => {
      expect(serializeVariantId(golden.templateId, golden.params)).toBe(golden.id);
      expect(getPublicTemplate(golden.templateId).renderStatement(golden.params)).toBe(
        golden.statement,
      );
    });
  }
});
