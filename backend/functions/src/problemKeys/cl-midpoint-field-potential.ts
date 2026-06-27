import { ProblemKey } from '../types';

// Difficulty 4. A dipole: equal and opposite charges. At the midpoint the field
// vectors point the same way and add, while the potential is zero. This separates
// students who conflate the scalar potential with the vector field.
// k = 8.99e9 N m^2/C^2, q = 5.0e-6 C, each 0.20 m from the midpoint.
export const clMidpointFieldPotential: ProblemKey = {
  problemId: 'cl-midpoint-field-potential',
  statement:
    'A +5.0 microcoulomb charge and a -5.0 microcoulomb charge are 0.40 m apart. Find the magnitude of the electric field at the exact midpoint. Use k = 8.99e9 N m^2/C^2.',
  correctSolution: [
    'Set up the geometry: the +5.0 microcoulomb and -5.0 microcoulomb charges are symmetric about the midpoint, each a distance r = 0.20 m away.',
    'At the midpoint the field from the positive charge points away from it (toward the negative charge), and the field from the negative charge points toward it (also toward the negative charge), so both vectors point the same way.',
    'Same direction means the magnitudes add: E_net = 2 k q / r^2.',
    'Compute: E_net = 2 (8.99e9)(5.0e-6) / (0.20)^2 = 2.25e6 N/C. The potential is zero at the midpoint, but the field is not.',
  ],
  finalAnswer: '2.25e6 N/C',
  rubric:
    'Full credit requires recognizing that at the midpoint the two field vectors point in the same direction (from the positive toward the negative charge) and therefore add to E = 2 k q / r^2, about 2.25e6 N/C. A zero potential at the midpoint does not make the field zero. Treat a conclusion of E = 0 justified by the zero potential as the conflation error.',
  flaws: [
    {
      misconceptionId: 'field-potential-conflation',
      signature:
        'Concludes E = 0 at the midpoint because the electric potential is zero there, conflating the scalar potential with the vector field (the field is actually 2 k q / r^2, about 2.25e6 N/C).',
    },
  ],
};
