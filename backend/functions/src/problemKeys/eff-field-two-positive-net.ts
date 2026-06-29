import { ProblemKey } from '../types';

// Difficulty band 5. Superposition of two like-charge fields on a line. At the
// midpoint x = 0.30 m both charges are 0.30 m away, so r^2 = 0.090 m^2. The +3.0
// microcoulomb charge pushes the field right and the +12.0 microcoulomb charge
// pushes it left, so they oppose and subtract. k = 8.99e9, E1 = 3.00e5 N/C,
// E2 = 1.20e6 N/C, E_net = 8.99e5 N/C toward the smaller charge. Targets adding the
// opposing fields and the inverse-square error.
export const effFieldTwoPositiveNet: ProblemKey = {
  problemId: 'eff-field-two-positive-net',
  statement:
    'A +3.0 microcoulomb charge sits at x = 0 and a +12.0 microcoulomb charge sits at x = 0.60 m. Find the magnitude of the net electric field at x = 0.30 m, the midpoint between them. Use k = 8.99e9 N m^2/C^2.',
  correctSolution: [
    'Both charges are r = 0.30 m from the midpoint, so r^2 = 0.090 m^2.',
    'Field from the +3.0 microcoulomb charge points right, away from it: E_1 = (8.99e9)(3.0e-6) / 0.090 = 3.00e5 N/C.',
    'Field from the +12.0 microcoulomb charge points left, away from it: E_2 = (8.99e9)(12.0e-6) / 0.090 = 1.20e6 N/C.',
    'The two fields point in opposite directions, so subtract: E_net = 1.20e6 - 3.00e5 = 8.99e5 N/C, directed toward the smaller charge.',
  ],
  finalAnswer: '8.99e5 N/C',
  rubric:
    'Full credit requires each point-charge field with the distance squared, recognizing that between two positive charges the two fields point in opposite directions, and subtracting to a net near 8.99e5 N/C directed toward the smaller charge. Catch adding the two opposing fields and dividing by r instead of r squared.',
  flaws: [
    {
      misconceptionId: 'superposition-direction-error',
      signature:
        'Adds the two opposing fields as if they pointed the same way (about 1.50e6 N/C) instead of subtracting them.',
    },
    {
      misconceptionId: 'inverse-square-error',
      signature: 'Divides each field by r instead of r squared, getting a net near 2.70e5 N/C.',
    },
  ],
};
