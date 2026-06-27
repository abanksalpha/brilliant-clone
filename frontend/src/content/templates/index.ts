import type { Problem, ProblemKind } from '../problemSchema';

// The public half of the seed templates. This module renders the prompt and
// metadata a student sees and draws fresh numeric variants client-side. It
// MUST mirror the backend templates (backend/functions/src/templates) exactly:
// same templateId, same paramSpec, same statement text, and the same variant id
// format, so the numbers a student sees match the numbers the backend grades.
// Answers never live here. At grade time the backend re-derives the key from the
// variant problemId, so there is no correct value, solution, finalAnswer, or
// buggyPath anywhere in this file.

export type ParamRange = { min: number; max: number; step: number };
export type ParamSpec = Record<string, ParamRange>;
export type VariantParams = Record<string, number>;

export type PublicSeedTemplate = {
  templateId: string;
  skillIds: string[];
  principleIds: string[];
  misconceptionTags: string[];
  kind: ProblemKind;
  difficultyBand: number;
  difficultyFeatures: {
    steps: number;
    symbolic: boolean;
    calculus: boolean;
    multiPart: boolean;
    hasTrap: boolean;
  };
  paramSpec: ParamSpec;
  renderStatement: (p: VariantParams) => string;
};

// Plain decimal with floating point rounding noise removed, mirroring the
// backend so statements and variant ids match byte for byte. Throws rather than
// emitting a fabricated value.
function plain(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error(`cannot format a non-finite value: ${value}`);
  }
  return String(Math.round(value * 1e9) / 1e9);
}

// The charge magnitude expressed in microcoulomb (the word, never the symbol).
function microcoulomb(qCoulombs: number): string {
  return plain(qCoulombs * 1e6);
}

// A short human title per template. Kept beside the templates (not on the public
// type) and looked up without a fallback so an untitled template throws.
const TEMPLATE_TITLES: Record<string, string> = {
  'cl-coulomb-force-two-charges': 'Force between two point charges',
  'cl-coulomb-force-collinear': 'Net force at the midpoint',
  'cl-field-point-charge': 'Field from a point charge',
  'cl-midpoint-field-potential': 'Field at a dipole midpoint',
  'cl-two-charge-superposition': 'Net field between two charges',
};

export const PUBLIC_TEMPLATES: PublicSeedTemplate[] = [
  {
    templateId: 'cl-coulomb-force-two-charges',
    skillIds: ['coulombs-law'],
    principleIds: ['coulomb-force'],
    misconceptionTags: ['inverse-square-error'],
    kind: 'single',
    difficultyBand: 2,
    difficultyFeatures: { steps: 4, symbolic: false, calculus: false, multiPart: false, hasTrap: true },
    paramSpec: {
      q1: { min: 1.0e-6, max: 9.0e-6, step: 0.5e-6 },
      q2: { min: 1.0e-6, max: 9.0e-6, step: 0.5e-6 },
      r: { min: 0.1, max: 0.5, step: 0.05 },
    },
    renderStatement: (p: VariantParams): string =>
      `Two point charges, +${microcoulomb(p.q1)} microcoulomb and +${microcoulomb(p.q2)} microcoulomb, are ${plain(p.r)} m apart. Find the magnitude of the electric force between them. Use k = 8.99e9 N m^2/C^2.`,
  },
  {
    templateId: 'cl-coulomb-force-collinear',
    skillIds: ['coulombs-law'],
    principleIds: ['coulomb-force', 'superposition'],
    misconceptionTags: ['superposition-magnitude-add'],
    kind: 'single',
    difficultyBand: 3,
    difficultyFeatures: { steps: 5, symbolic: false, calculus: false, multiPart: true, hasTrap: true },
    paramSpec: {
      a: { min: 1.0e-6, max: 3.0e-6, step: 0.5e-6 },
      b: { min: 5.0e-6, max: 9.0e-6, step: 0.5e-6 },
      q: { min: 1.0e-6, max: 4.0e-6, step: 0.5e-6 },
      d: { min: 0.2, max: 0.8, step: 0.1 },
    },
    renderStatement: (p: VariantParams): string =>
      `A +${microcoulomb(p.a)} microcoulomb charge and a +${microcoulomb(p.b)} microcoulomb charge are ${plain(p.d)} m apart. A +${microcoulomb(p.q)} microcoulomb charge sits at the midpoint between them. Find the magnitude of the net electric force on the midpoint charge. Use k = 8.99e9 N m^2/C^2.`,
  },
  {
    templateId: 'cl-field-point-charge',
    skillIds: ['electric-field-field-lines'],
    principleIds: ['field-concept'],
    misconceptionTags: ['inverse-square-error'],
    kind: 'single',
    difficultyBand: 2,
    difficultyFeatures: { steps: 4, symbolic: false, calculus: false, multiPart: false, hasTrap: true },
    paramSpec: {
      q: { min: 1.0e-6, max: 9.0e-6, step: 0.5e-6 },
      r: { min: 1.0, max: 5.0, step: 0.5 },
    },
    renderStatement: (p: VariantParams): string =>
      `Find the magnitude of the electric field at a point ${plain(p.r)} m from a +${microcoulomb(p.q)} microcoulomb point charge. Use k = 8.99e9 N m^2/C^2.`,
  },
  {
    templateId: 'cl-midpoint-field-potential',
    skillIds: ['electric-fields-of-charge-distributions'],
    principleIds: ['field-concept', 'energy-potential'],
    misconceptionTags: ['field-potential-conflation'],
    kind: 'single',
    difficultyBand: 4,
    difficultyFeatures: { steps: 5, symbolic: false, calculus: false, multiPart: true, hasTrap: true },
    paramSpec: {
      q: { min: 2.0e-6, max: 8.0e-6, step: 1.0e-6 },
      d: { min: 0.2, max: 0.8, step: 0.1 },
    },
    renderStatement: (p: VariantParams): string =>
      `A +${microcoulomb(p.q)} microcoulomb charge and a -${microcoulomb(p.q)} microcoulomb charge are ${plain(p.d)} m apart. Find the magnitude of the electric field at the exact midpoint between them. Use k = 8.99e9 N m^2/C^2.`,
  },
  {
    templateId: 'cl-two-charge-superposition',
    skillIds: ['electric-fields-of-charge-distributions'],
    principleIds: ['superposition', 'field-concept'],
    misconceptionTags: ['superposition-magnitude-add'],
    kind: 'single',
    difficultyBand: 3,
    difficultyFeatures: { steps: 4, symbolic: false, calculus: false, multiPart: false, hasTrap: true },
    paramSpec: {
      q: { min: 2.0e-6, max: 8.0e-6, step: 1.0e-6 },
      d: { min: 0.4, max: 1.0, step: 0.1 },
    },
    renderStatement: (p: VariantParams): string =>
      `Two +${microcoulomb(p.q)} microcoulomb charges sit ${plain(p.d)} m apart. Find the magnitude of the net electric field at the midpoint between them. Use k = 8.99e9 N m^2/C^2.`,
  },
];

const REGISTRY: Record<string, PublicSeedTemplate> = Object.fromEntries(
  PUBLIC_TEMPLATES.map((template) => [template.templateId, template]),
);

export function getPublicTemplate(templateId: string): PublicSeedTemplate {
  const template = REGISTRY[templateId];
  if (!template) {
    throw new Error(`unknown template: ${templateId}`);
  }
  return template;
}

// Variant ids are versioned so the derivation rules can evolve without colliding
// with the existing static problem ids. Format (identical to the backend):
//   v1:<templateId>:<k>=<v>;<k>=<v>;...
// with keys sorted ascending and numbers written as plain decimals.
const VARIANT_PREFIX = 'v1:';

// Render one numeric parameter value as a plain decimal. Throws on a non-finite
// value rather than serializing something that cannot round trip.
function formatParamValue(value: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`cannot serialize a non-finite param value: ${value}`);
  }
  return String(value);
}

export function serializeVariantId(templateId: string, params: VariantParams): string {
  const pairs = Object.keys(params)
    .sort()
    .map((key) => `${key}=${formatParamValue(params[key])}`);
  return `${VARIANT_PREFIX}${templateId}:${pairs.join(';')}`;
}

export function parseVariantId(id: string): { templateId: string; params: VariantParams } {
  if (typeof id !== 'string' || !id.startsWith(VARIANT_PREFIX)) {
    throw new Error(`malformed variant id (missing ${VARIANT_PREFIX} prefix): ${id}`);
  }
  const rest = id.slice(VARIANT_PREFIX.length);
  const separator = rest.indexOf(':');
  if (separator === -1) {
    throw new Error(`malformed variant id (missing template separator): ${id}`);
  }
  const templateId = rest.slice(0, separator);
  const paramSection = rest.slice(separator + 1);
  if (templateId === '') {
    throw new Error(`malformed variant id (empty template id): ${id}`);
  }
  if (paramSection === '') {
    throw new Error(`malformed variant id (no params): ${id}`);
  }

  const params: VariantParams = {};
  for (const pair of paramSection.split(';')) {
    const eq = pair.indexOf('=');
    if (eq <= 0) {
      throw new Error(`malformed variant id (bad pair "${pair}"): ${id}`);
    }
    const key = pair.slice(0, eq);
    const rawValue = pair.slice(eq + 1);
    if (rawValue === '') {
      throw new Error(`malformed variant id (empty value for "${key}"): ${id}`);
    }
    const value = Number(rawValue);
    if (!Number.isFinite(value)) {
      throw new Error(`malformed variant id (non-numeric value for "${key}"): ${id}`);
    }
    params[key] = value;
  }

  return { templateId, params };
}

// mulberry32: a tiny, fast, pure PRNG. Seeded by an integer, it returns the same
// stream every time, which keeps drawParams deterministic without Math.random.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Snap a value onto the parameter grid, removing floating point noise so it
// serializes to a clean decimal and round trips through the variant id.
function snapToGrid(value: number): number {
  return Math.round(value * 1e9) / 1e9;
}

export function drawParams(templateId: string, seed: number): VariantParams {
  const template = getPublicTemplate(templateId);
  const rng = mulberry32(seed);
  const params: VariantParams = {};
  // Sort keys so the PRNG is consumed in a stable order regardless of how the
  // paramSpec object was written.
  for (const key of Object.keys(template.paramSpec).sort()) {
    const { min, max, step } = template.paramSpec[key];
    // floor((max-min)/step) is the index of the last grid point. The +1e-9 guards
    // the floor against floating point underestimation, for example
    // (1.0 - 0.4) / 0.1 evaluates to 5.999999999999999.
    const stepCount = Math.floor((max - min) / step + 1e-9);
    const index = Math.floor(rng() * (stepCount + 1));
    params[key] = snapToGrid(min + index * step);
  }
  return params;
}

// Tolerance for the in-range check. Far smaller than any grid step, so it only
// absorbs floating point noise at the boundaries and never accepts a value that
// is genuinely off the range.
const RANGE_EPS = 1e-9;

export function generateVariantProblem(templateId: string, params: VariantParams): Problem {
  const template = getPublicTemplate(templateId);
  const title = TEMPLATE_TITLES[templateId];
  if (!title) {
    throw new Error(`no title for template: ${templateId}`);
  }

  for (const key of Object.keys(template.paramSpec)) {
    const value = params[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`missing or non-finite param "${key}" for ${templateId}`);
    }
    const { min, max } = template.paramSpec[key];
    if (value < min - RANGE_EPS || value > max + RANGE_EPS) {
      throw new Error(
        `param "${key}" out of range for ${templateId}: ${value} not in [${min}, ${max}]`,
      );
    }
  }

  return {
    problemId: serializeVariantId(templateId, params),
    lessonId: template.skillIds[0],
    unitId: 'electrostatics',
    skillIds: template.skillIds,
    principleIds: template.principleIds,
    misconceptionTags: template.misconceptionTags,
    kind: template.kind,
    difficulty: template.difficultyBand,
    difficultyBand: template.difficultyBand,
    difficultyFeatures: template.difficultyFeatures,
    provenance: 'variant',
    templateId: template.templateId,
    title,
    prompt: template.renderStatement(params),
  };
}
