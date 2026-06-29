import { ProblemKey } from '../types';

// Difficulty band 5. Superposition of two point-charge fields on a line. At the
// midpoint x = 0.20 m the +8.0 microcoulomb charge (0.20 m to the left) pushes the
// field to the right, and the -3.0 microcoulomb charge (0.20 m to the right) pulls
// the field toward itself, also to the right, so the two add. k = 8.99e9,
// E1 = 1.80e6 N/C, E2 = 6.74e5 N/C, E_net = 2.47e6 N/C. Targets subtracting the two
// (treating opposite signs as opposing fields) and the inverse-square error.
export const effFieldCollinearNet: ProblemKey = {
  problemId: 'eff-field-collinear-net',
  statement:
    'A +8.0 microcoulomb charge sits at x = 0 and a -3.0 microcoulomb charge sits at x = 0.40 m. Find the magnitude of the net electric field at x = 0.20 m, the point halfway between them. Use k = 8.99e9 N m^2/C^2.',
  correctSolution: [
    'Both source charges are r = 0.20 m from the field point, so r^2 = 0.040 m^2.',
    'Field from the +8.0 microcoulomb charge points away from it, to the right: E_1 = (8.99e9)(8.0e-6) / 0.040 = 1.80e6 N/C.',
    'Field from the -3.0 microcoulomb charge points toward it, also to the right: E_2 = (8.99e9)(3.0e-6) / 0.040 = 6.74e5 N/C.',
    'Both fields point the same way, so add them: E_net = 1.80e6 + 6.74e5 = 2.47e6 N/C, directed to the right.',
  ],
  finalAnswer: '2.47e6 N/C',
  rubric:
    'Full credit requires each point-charge field with the distance squared, recognizing that between a positive and a negative charge the two fields point the same way (away from the + and toward the -), and adding to a net near 2.47e6 N/C. Catch subtracting the two as if opposite signs meant opposing fields, and dividing by r instead of r squared.',
  flaws: [
    {
      misconceptionId: 'superposition-direction-error',
      signature:
        'Subtracts the two fields because the charges have opposite signs (about 1.12e6 N/C) instead of adding the same-direction fields.',
    },
    {
      misconceptionId: 'inverse-square-error',
      signature: 'Divides each field by r instead of r squared, getting a net near 4.94e5 N/C.',
    },
  ],
};
