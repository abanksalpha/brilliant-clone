import { SeedTemplate, VariantParams } from '../types';

// Coulomb constant, k = 8.99e9 N m^2/C^2.
const K = 8.99e9;

// Scientific notation with 3 significant figures and no plus sign on the
// exponent, for example 2.25e6. Throws rather than emitting a fabricated value.
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

// Difficulty band 4. A dipole: equal and opposite charges separated by d. At the
// midpoint both field vectors point the same way and add, while the potential is
// zero. Separates students who conflate the scalar potential with the vector
// field. Each charge is half = d/2 from the midpoint, so E = 2 k q / (d/2)^2.
export const clMidpointFieldPotential: SeedTemplate = {
  templateId: 'cl-midpoint-field-potential',
  skillIds: ['electric-fields-of-charge-distributions'],
  principleIds: ['field-concept', 'energy-potential'],
  difficultyBand: 4,
  paramSpec: {
    q: { min: 2.0e-6, max: 8.0e-6, step: 1.0e-6 },
    d: { min: 0.2, max: 0.8, step: 0.1 },
  },
  renderStatement: (p: VariantParams): string =>
    `A +${microcoulomb(p.q)} microcoulomb charge and a -${microcoulomb(p.q)} microcoulomb charge are ${plain(p.d)} m apart. Find the magnitude of the electric field at the exact midpoint between them. Use k = 8.99e9 N m^2/C^2.`,
  solve: (p: VariantParams) => {
    const half = p.d / 2;
    const E = (2 * K * p.q) / (half * half);
    return {
      correctSolution: [
        `Set up the geometry: the +${microcoulomb(p.q)} microcoulomb and -${microcoulomb(p.q)} microcoulomb charges are symmetric about the midpoint, each a distance r = ${plain(half)} m away.`,
        'At the midpoint the field from the positive charge points away from it (toward the negative charge), and the field from the negative charge points toward it (also toward the negative charge), so both vectors point the same way.',
        'Because the two field vectors point the same way, their magnitudes add: E_net = 2 k q / r^2.',
        `Compute: E_net = 2 (8.99e9)(${microcoulomb(p.q)}e-6) / (${plain(half)})^2 = ${sci3(E)} N/C. The potential is zero at the midpoint, but the field is not.`,
      ],
      finalAnswer: `${sci3(E)} N/C`,
    };
  },
  rubric:
    'Full credit requires recognizing that at the midpoint the two field vectors point the same way (from the positive toward the negative charge) and therefore add to E = 2 k q / r^2. A zero potential at the midpoint does not make the field zero. Treat a conclusion of E = 0 justified by the zero potential as the conflation error.',
  flaws: [
    {
      misconceptionId: 'field-potential-conflation',
      buggyPath: (): string =>
        'Concludes E = 0 at the midpoint because the potential is zero there, when the two field vectors actually add to a nonzero magnitude.',
    },
  ],
};
