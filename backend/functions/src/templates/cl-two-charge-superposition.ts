import { SeedTemplate, VariantParams } from '../types';

// Coulomb constant, k = 8.99e9 N m^2/C^2.
const K = 8.99e9;

// Scientific notation with 3 significant figures and no plus sign on the
// exponent. Throws rather than emitting a fabricated value.
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

// Difficulty band 3. Two equal positive charges a distance d apart. The net
// field at the midpoint cancels by symmetry, so the correct magnitude is zero.
// The buggy path adds the two magnitudes as scalars instead of vector summing.
export const clTwoChargeSuperposition: SeedTemplate = {
  templateId: 'cl-two-charge-superposition',
  skillIds: ['electric-fields-of-charge-distributions'],
  principleIds: ['superposition', 'field-concept'],
  difficultyBand: 3,
  paramSpec: {
    q: { min: 2.0e-6, max: 8.0e-6, step: 1.0e-6 },
    d: { min: 0.4, max: 1.0, step: 0.1 },
  },
  renderStatement: (p: VariantParams): string =>
    `Two +${microcoulomb(p.q)} microcoulomb charges sit ${plain(p.d)} m apart. Find the magnitude of the net electric field at the midpoint between them. Use k = 8.99e9 N m^2/C^2.`,
  solve: (p: VariantParams) => {
    const half = p.d / 2;
    return {
      correctSolution: [
        `Set up the geometry: the two equal +${microcoulomb(p.q)} microcoulomb charges are symmetric about the midpoint, each a distance r = ${plain(half)} m away.`,
        'Each charge produces a field of magnitude k q / r^2 at the midpoint, but the two field vectors point in opposite directions (each points away from its own source charge).',
        'Because the charges are equal and equidistant, the two vectors have equal magnitude and opposite direction, so they cancel.',
        'Net field at the midpoint: E_net = 0 N/C.',
      ],
      finalAnswer: '0 N/C',
    };
  },
  rubric:
    'Full credit requires recognizing that the electric field is a vector and that the two equal, opposite vectors cancel by symmetry, giving a net magnitude of zero. Treat any nonzero magnitude, especially adding the two magnitudes as scalars, as the superposition error.',
  flaws: [
    {
      misconceptionId: 'superposition-magnitude-add',
      buggyPath: (p: VariantParams): string => {
        const half = p.d / 2;
        const Ew = (2 * K * p.q) / (half * half);
        return `Adds the two field magnitudes (about ${sci3(Ew)} N/C) instead of vector summing them to zero.`;
      },
    },
  ],
};
