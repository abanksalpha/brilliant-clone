import { ProblemKey } from '../types';

// Difficulty 2. Coulomb's law for the force between two point charges,
// F = k q1 q2 / r^2. Targets the inverse-square error (dividing by r, not r^2).
// k = 8.99e9 N m^2/C^2, q1 = 2.0e-6 C, q2 = 3.0e-6 C, r = 0.10 m.
export const clCoulombForceTwoCharges: ProblemKey = {
  problemId: 'cl-coulomb-force-two-charges',
  statement:
    'Two point charges, +2.0 microcoulomb and +3.0 microcoulomb, are 0.10 m apart. Find the magnitude of the electric force between them. Use k = 8.99e9 N m^2/C^2.',
  correctSolution: [
    'Identify the governing relation: Coulomb law gives the force magnitude F = k q_1 q_2 / r^2.',
    'List the givens: k = 8.99e9 N m^2/C^2, q_1 = 2.0e-6 C, q_2 = 3.0e-6 C, r = 0.10 m.',
    'Square the separation: r^2 = (0.10 m)^2 = 0.010 m^2.',
    'Substitute and compute: F = (8.99e9)(2.0e-6)(3.0e-6) / 0.010 = 5.4 N.',
  ],
  finalAnswer: '5.4 N',
  rubric:
    'Full credit requires using Coulomb law F = k q_1 q_2 / r^2 with the separation squared in the denominator, correct substitution of k, q_1, q_2, and r, and a final magnitude near 5.4 N. The single error to catch is dividing by r instead of r squared.',
  flaws: [
    {
      misconceptionId: 'inverse-square-error',
      signature:
        'Uses F = k q_1 q_2 / r with the linear distance in the denominator (which gives about 0.54 N) instead of dividing by r squared.',
    },
  ],
};
