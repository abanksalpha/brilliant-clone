import { ProblemKey } from '../types';

// Difficulty band 5. Inverse Coulomb problem: a measured net force on a target
// charge fixes the unknown magnitude of one source. Both sources are positive and
// 0.20 m from the origin charge on opposite sides, so the net is the difference
// F_left - F_right. With F_left = 5.39 N and F_net = 4.05 N, F_right = 1.34 N gives
// Q = F_right (0.20)^2 / [k (3.0e-6)] = 2.0e-6 C. k = 8.99e9 N m^2/C^2. Targets
// adding instead of subtracting the forces and dropping the square on the distance.
export const clCoulombSolveCharge: ProblemKey = {
  problemId: 'cl-coulomb-solve-charge',
  statement:
    'On the x axis, a +8.0 microcoulomb charge is fixed at x = -0.20 m and a second positive charge of unknown magnitude is fixed at x = +0.20 m. A +3.0 microcoulomb charge at the origin then feels a net electric force of 4.05 N in the +x direction. Find the magnitude of the unknown charge. Use k = 8.99e9 N m^2/C^2.',
  correctSolution: [
    'Both source charges are positive, so each repels the +3.0 microcoulomb charge at the origin. The +8.0 microcoulomb charge on the left pushes it in the +x direction; the unknown charge on the right pushes it in the -x direction.',
    'The net force along x is the difference of the two pushes: F_net = F_left - F_right.',
    'Compute the known push: F_left = k (3.0e-6)(8.0e-6) / (0.20)^2 = 5.39 N. Then F_right = F_left - F_net = 5.39 - 4.05 = 1.34 N.',
    'The unknown push is F_right = k (3.0e-6) Q / (0.20)^2, so Q = F_right (0.20)^2 / [k (3.0e-6)] = (1.34)(0.040) / (2.70e4) = 2.0e-6 C.',
    'The unknown charge is 2.0e-6 C, or 2.0 microcoulomb.',
  ],
  finalAnswer: '2.0e-6 C',
  rubric:
    'Full credit requires recognizing both positive sources repel the origin charge in opposite directions, writing the net as F_left - F_right, computing F_left = k (3.0e-6)(8.0e-6)/(0.20)^2 = 5.39 N, solving F_right = 1.34 N, and isolating Q = F_right (0.20)^2 / [k (3.0e-6)] = 2.0e-6 C. Catch adding the forces instead of subtracting and dropping the square on the distance when solving for Q.',
  flaws: [
    {
      misconceptionId: 'superposition-direction-error',
      signature:
        'Adds the two forces instead of subtracting (F_right = F_left + F_net), giving an unknown charge of about 1.4e-5 C.',
    },
    {
      misconceptionId: 'inverse-square-error',
      signature: 'Uses the distance instead of its square when isolating Q, giving about 1.0e-5 C.',
    },
  ],
};
