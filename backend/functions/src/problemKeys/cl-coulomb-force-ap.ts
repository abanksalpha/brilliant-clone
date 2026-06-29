import { ProblemKey } from '../types';

// Difficulty band 4. Coulomb law force between two point charges given in
// nanocoulomb at a separation given in centimeters, so the unit conversions are
// part of the work. k = 8.99e9 N m^2/C^2, q1 = 45e-9 C, q2 = 28e-9 C, r = 0.030 m.
// Targets the inverse-square error (dividing by r, not r^2).
export const clCoulombForceAp: ProblemKey = {
  problemId: 'cl-coulomb-force-ap',
  statement:
    'Two small spheres carry charges of +45 nanocoulomb and -28 nanocoulomb and are held 3.0 cm apart. Find the magnitude of the electric force between them. Use k = 8.99e9 N m^2/C^2.',
  correctSolution: [
    'Identify the governing relation: Coulomb law gives the force magnitude F = k q_1 q_2 / r^2, using the charge magnitudes.',
    'Convert to base units: q_1 = 45e-9 C, q_2 = 28e-9 C, and r = 3.0 cm = 0.030 m.',
    'Square the separation: r^2 = (0.030 m)^2 = 9.0e-4 m^2.',
    'Substitute and compute: F = (8.99e9)(45e-9)(28e-9) / 9.0e-4 = 1.26e-2 N. The charges have opposite signs, so the force is attractive.',
  ],
  finalAnswer: '1.26e-2 N',
  rubric:
    'Full credit requires Coulomb law F = k q_1 q_2 / r^2 with the separation converted to meters and squared in the denominator, correct substitution, and a magnitude near 1.26e-2 N (the opposite signs only make the force attractive). The single error to catch is dividing by r instead of r squared.',
  flaws: [
    {
      misconceptionId: 'inverse-square-error',
      signature:
        'Uses F = k q_1 q_2 / r with the linear distance in the denominator (which gives about 3.78e-4 N) instead of dividing by r squared.',
    },
  ],
};
