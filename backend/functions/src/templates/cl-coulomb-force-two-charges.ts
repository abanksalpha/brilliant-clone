import { SeedTemplate, VariantParams } from '../types';

// Coulomb constant, k = 8.99e9 N m^2/C^2.
const K = 8.99e9;

// Scientific notation with 3 significant figures and no plus sign on the
// exponent, for example 5.39e0. Throws rather than emitting a fabricated value.
function sci3(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error(`cannot format a non-finite value: ${value}`);
  }
  return value.toExponential(2).replace('e+', 'e');
}

// Plain decimal with floating point rounding noise removed, for readable
// statements and steps (for example 2, 0.1, 0.04).
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

// Difficulty band 2. The straight Coulomb's law force between two point charges,
// F = k q1 q2 / r^2.
export const clCoulombForceTwoCharges: SeedTemplate = {
  templateId: 'cl-coulomb-force-two-charges',
  skillIds: ['coulombs-law'],
  principleIds: ['coulomb-force'],
  difficultyBand: 2,
  paramSpec: {
    q1: { min: 1.0e-6, max: 9.0e-6, step: 0.5e-6 },
    q2: { min: 1.0e-6, max: 9.0e-6, step: 0.5e-6 },
    r: { min: 0.1, max: 0.5, step: 0.05 },
  },
  renderStatement: (p: VariantParams): string =>
    `Two point charges, +${microcoulomb(p.q1)} microcoulomb and +${microcoulomb(p.q2)} microcoulomb, are ${plain(p.r)} m apart. Find the magnitude of the electric force between them. Use k = 8.99e9 N m^2/C^2.`,
  solve: (p: VariantParams) => {
    const r2 = p.r * p.r;
    const F = (K * p.q1 * p.q2) / r2;
    return {
      correctSolution: [
        "Identify the governing relation: Coulomb's law gives the force magnitude F = k q1 q2 / r^2.",
        `List the givens: k = 8.99e9 N m^2/C^2, q1 = ${microcoulomb(p.q1)}e-6 C, q2 = ${microcoulomb(p.q2)}e-6 C, r = ${plain(p.r)} m.`,
        `Square the distance: r^2 = (${plain(p.r)} m)^2 = ${plain(r2)} m^2.`,
        `Substitute and compute: F = (8.99e9)(${microcoulomb(p.q1)}e-6)(${microcoulomb(p.q2)}e-6) / ${plain(r2)} = ${sci3(F)} N.`,
      ],
      finalAnswer: `${sci3(F)} N`,
    };
  },
  rubric:
    "Full credit requires Coulomb's law F = k q1 q2 / r^2 with r squared in the denominator, correct substitution of k, q1, q2, and r, and the correct magnitude. The single error to catch is dividing by r instead of r squared.",
  flaws: [
    {
      misconceptionId: 'inverse-square-error',
      buggyPath: (p: VariantParams): string => {
        const Fw = (K * p.q1 * p.q2) / p.r;
        return `Uses F = k q1 q2 / r (about ${sci3(Fw)} N) instead of dividing by r squared.`;
      },
    },
  ],
};
