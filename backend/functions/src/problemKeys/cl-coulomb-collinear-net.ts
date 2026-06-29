import { ProblemKey } from '../types';

// Difficulty band 5. Superposition of two Coulomb forces along a line. The middle
// +3.0 microcoulomb charge is pushed right by the +6.0 microcoulomb charge (0.20 m
// away) and left by the +2.0 microcoulomb charge (0.30 m away), so the net is the
// difference. k = 8.99e9 N m^2/C^2. Targets adding opposite forces and the
// inverse-square error.
export const clCoulombCollinearNet: ProblemKey = {
  problemId: 'cl-coulomb-collinear-net',
  statement:
    'Three charges lie on the x axis: a +6.0 microcoulomb charge at the origin, a +3.0 microcoulomb charge at x = 0.20 m, and a +2.0 microcoulomb charge at x = 0.50 m. Find the magnitude of the net electric force on the +3.0 microcoulomb charge. Use k = 8.99e9 N m^2/C^2.',
  correctSolution: [
    'The middle +3.0 microcoulomb charge is pushed by each of the others. The +6.0 microcoulomb charge is 0.20 m to its left and pushes it right; the +2.0 microcoulomb charge is 0.30 m to its right and pushes it left.',
    'Force from the +6.0 microcoulomb charge: F_1 = k (6.0e-6)(3.0e-6) / (0.20)^2 = 4.05 N, directed right.',
    'Force from the +2.0 microcoulomb charge: F_2 = k (2.0e-6)(3.0e-6) / (0.30)^2 = 0.599 N, directed left.',
    'The two forces point in opposite directions, so subtract: F_net = 4.05 - 0.599 = 3.45 N, directed right (toward the +2.0 microcoulomb charge).',
  ],
  finalAnswer: '3.45 N',
  rubric:
    'Full credit requires each pairwise Coulomb force with the correct distance squared, recognizing the two forces on the middle charge point in opposite directions, and subtracting to a net near 3.45 N. Catch adding the magnitudes as if they pointed the same way, and dividing by r instead of r squared.',
  flaws: [
    {
      misconceptionId: 'superposition-direction-error',
      signature:
        'Adds the two opposite-pointing forces as if they pointed the same way (about 4.64 N) instead of subtracting them.',
    },
    {
      misconceptionId: 'inverse-square-error',
      signature:
        'Divides each force by r instead of r squared, getting a net of about 0.629 N.',
    },
  ],
};
