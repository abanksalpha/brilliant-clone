import { ProblemKey } from '../types';

// Difficulty band 5. Two equal +3.0 microcoulomb charges and a +1.0 microcoulomb
// test charge off the line, so the net force needs vector components. Each source
// is sqrt(0.08) = 0.283 m away; the x components cancel by symmetry and the y
// components add to about 0.48 N straight up. k = 8.99e9 N m^2/C^2. Targets adding
// magnitudes as scalars and the inverse-square error.
export const clCoulombNet2d: ProblemKey = {
  problemId: 'cl-coulomb-net-2d',
  statement:
    'A +3.0 microcoulomb charge sits at the origin and a +3.0 microcoulomb charge sits at (0.40 m, 0). Find the magnitude of the net electric force on a +1.0 microcoulomb charge placed at (0.20 m, 0.20 m). Use k = 8.99e9 N m^2/C^2.',
  correctSolution: [
    'Each source charge is the same distance from the test point: r = sqrt((0.20)^2 + (0.20)^2) = 0.283 m, so r^2 = 0.080 m^2.',
    'Each force magnitude: F = k (3.0e-6)(1.0e-6) / 0.080 = 0.337 N.',
    'Resolve into components. The two charges sit symmetric distances left and right of the test point, so their x components are equal and opposite and cancel, while their y components both point in the +y direction.',
    'Each y component is F times (0.20 / 0.283) = 0.337 (0.707) = 0.238 N.',
    'Net force: F_net = 2 (0.238 N) = 0.48 N, directed straight up.',
  ],
  finalAnswer: '0.48 N',
  rubric:
    'Full credit requires the equal distances r = 0.283 m, each force k q_1 q_2 / r^2, resolving into components, cancelling the x components by symmetry, and adding the y components to a net near 0.48 N. Catch adding the magnitudes as scalars and dividing by r instead of r squared.',
  flaws: [
    {
      misconceptionId: 'superposition-magnitude-add',
      signature:
        'Adds the two force magnitudes as scalars (about 0.674 N) instead of adding them as vectors and letting the x components cancel.',
    },
    {
      misconceptionId: 'inverse-square-error',
      signature: 'Divides each force by r instead of r squared, giving a net of about 0.135 N.',
    },
  ],
};
