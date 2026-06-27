import { ProblemKey } from '../types';

// Difficulty 2. Single point charge, straight application of the inverse square law.
// k = 8.99e9 N m^2/C^2, q = 3.0e-6 C, r = 2.0 m.
export const clFieldPointCharge: ProblemKey = {
  problemId: 'cl-field-point-charge',
  statement:
    'Find the magnitude of the electric field at a point 2.0 m from a +3.0 microcoulomb point charge. Use k = 8.99e9 N m^2/C^2.',
  correctSolution: [
    'Identify the governing relation: the electric field magnitude of a point charge is E = k q / r^2.',
    'List the givens: k = 8.99e9 N m^2/C^2, q = 3.0e-6 C, r = 2.0 m.',
    'Square the distance: r^2 = (2.0 m)^2 = 4.0 m^2.',
    'Substitute and compute: E = (8.99e9)(3.0e-6) / 4.0 = 6.74e3 N/C.',
  ],
  finalAnswer: '6.74e3 N/C',
  rubric:
    'Full credit requires using the inverse square law E = k q / r^2 with r squared in the denominator, correct substitution of k, q, and r, and a final magnitude near 6.74e3 N/C. The single error to catch is dividing by r instead of r^2.',
  flaws: [
    {
      misconceptionId: 'inverse-square-error',
      signature:
        'Uses E = k q / r with the linear distance in the denominator (which gives about 1.35e4 N/C) instead of dividing by r squared.',
    },
  ],
};
