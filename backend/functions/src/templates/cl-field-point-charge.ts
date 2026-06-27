import { SeedTemplate, VariantParams } from '../types';

// Coulomb constant, k = 8.99e9 N m^2/C^2.
const K = 8.99e9;

// Scientific notation with 3 significant figures and no plus sign on the
// exponent, for example 6.74e3. Throws rather than emitting a fabricated value.
function sci3(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error(`cannot format a non-finite value: ${value}`);
  }
  return value.toExponential(2).replace('e+', 'e');
}

// Plain decimal with floating point rounding noise removed, for readable
// statements and steps (for example 2, 0.04, 6.25).
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

// Difficulty band 2. Single point charge, straight application of the inverse
// square law E = k q / r^2.
export const clFieldPointCharge: SeedTemplate = {
  templateId: 'cl-field-point-charge',
  skillIds: ['electric-field-field-lines'],
  principleIds: ['field-concept'],
  difficultyBand: 2,
  paramSpec: {
    q: { min: 1.0e-6, max: 9.0e-6, step: 0.5e-6 },
    r: { min: 1.0, max: 5.0, step: 0.5 },
  },
  renderStatement: (p: VariantParams): string =>
    `Find the magnitude of the electric field at a point ${plain(p.r)} m from a +${microcoulomb(p.q)} microcoulomb point charge. Use k = 8.99e9 N m^2/C^2.`,
  solve: (p: VariantParams) => {
    const r2 = p.r * p.r;
    const E = (K * p.q) / r2;
    return {
      correctSolution: [
        'Identify the governing relation: the electric field magnitude of a point charge is E = k q / r^2.',
        `List the givens: k = 8.99e9 N m^2/C^2, q = ${microcoulomb(p.q)}e-6 C, r = ${plain(p.r)} m.`,
        `Square the distance: r^2 = (${plain(p.r)} m)^2 = ${plain(r2)} m^2.`,
        `Substitute and compute: E = (8.99e9)(${microcoulomb(p.q)}e-6) / ${plain(r2)} = ${sci3(E)} N/C.`,
      ],
      finalAnswer: `${sci3(E)} N/C`,
    };
  },
  rubric:
    'Full credit requires using the inverse square law E = k q / r^2 with r squared in the denominator, correct substitution of k, q, and r, and the correct magnitude. The single error to catch is dividing by r instead of r squared.',
  flaws: [
    {
      misconceptionId: 'inverse-square-error',
      buggyPath: (p: VariantParams): string => {
        const Ew = (K * p.q) / p.r;
        return `Uses E = k q / r (about ${sci3(Ew)} N/C) instead of dividing by r squared.`;
      },
    },
  ],
};
