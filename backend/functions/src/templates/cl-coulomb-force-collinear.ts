import { SeedTemplate, VariantParams } from '../types';

// Coulomb constant, k = 8.99e9 N m^2/C^2.
const K = 8.99e9;

// Scientific notation with 3 significant figures and no plus sign on the
// exponent, for example 1.80e0. Throws rather than emitting a fabricated value.
function sci3(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error(`cannot format a non-finite value: ${value}`);
  }
  return value.toExponential(2).replace('e+', 'e');
}

// Plain decimal with floating point rounding noise removed.
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

// Difficulty band 3. Superposition of forces along a line: a positive charge at
// the midpoint between two unequal positive charges feels two opposite pushes,
// so the net magnitude is the difference, not the sum. The b range sits strictly
// above the a range, so the net is always nonzero and points toward the smaller
// charge.
export const clCoulombForceCollinear: SeedTemplate = {
  templateId: 'cl-coulomb-force-collinear',
  skillIds: ['coulombs-law'],
  principleIds: ['coulomb-force', 'superposition'],
  difficultyBand: 3,
  paramSpec: {
    a: { min: 1.0e-6, max: 3.0e-6, step: 0.5e-6 },
    b: { min: 5.0e-6, max: 9.0e-6, step: 0.5e-6 },
    q: { min: 1.0e-6, max: 4.0e-6, step: 0.5e-6 },
    d: { min: 0.2, max: 0.8, step: 0.1 },
  },
  renderStatement: (p: VariantParams): string =>
    `A +${microcoulomb(p.a)} microcoulomb charge and a +${microcoulomb(p.b)} microcoulomb charge are ${plain(p.d)} m apart. A +${microcoulomb(p.q)} microcoulomb charge sits at the midpoint between them. Find the magnitude of the net electric force on the midpoint charge. Use k = 8.99e9 N m^2/C^2.`,
  solve: (p: VariantParams) => {
    const half = p.d / 2;
    const half2 = half * half;
    const Fa = (K * p.q * p.a) / half2;
    const Fb = (K * p.q * p.b) / half2;
    const net = Fb - Fa;
    return {
      correctSolution: [
        'Each outer charge repels the positive midpoint charge, so the two forces point in opposite directions along the line.',
        `Find the distance from each outer charge to the midpoint: ${plain(p.d)} / 2 = ${plain(half)} m.`,
        `Force from the +${microcoulomb(p.a)} microcoulomb charge: F_a = k q a / (d/2)^2 = ${sci3(Fa)} N.`,
        `Force from the +${microcoulomb(p.b)} microcoulomb charge: F_b = k q b / (d/2)^2 = ${sci3(Fb)} N.`,
        `The two forces oppose, so the net magnitude is the difference: F_b - F_a = ${sci3(net)} N, directed toward the smaller charge.`,
      ],
      finalAnswer: `${sci3(net)} N`,
    };
  },
  rubric:
    'Full credit requires seeing that the two forces on the midpoint charge point in opposite directions, so the net magnitude is the difference k q (b - a) / (d/2)^2, not the sum. The single error to catch is adding the two magnitudes as if the forces pointed the same way.',
  flaws: [
    {
      misconceptionId: 'superposition-magnitude-add',
      buggyPath: (p: VariantParams): string => {
        const half2 = (p.d / 2) * (p.d / 2);
        const sum = (K * p.q * p.a) / half2 + (K * p.q * p.b) / half2;
        return `Adds the two opposite-pointing forces (about ${sci3(sum)} N) instead of subtracting them.`;
      },
    },
  ],
};
