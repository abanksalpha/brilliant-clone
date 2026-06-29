import { ProblemKey } from '../types';

// Difficulty band 4. Field at the center of a uniformly charged semicircular arc:
// only the component along the symmetry axis survives, E = 2 k lambda / R with
// lambda = Q / (pi R). With Q = 6.0e-9 C, R = 0.050 m, lambda = 3.82e-8 C/m and
// E = 1.37e4 N/C. k = 8.99e9. Targets treating the arc as a point charge at
// distance R, and dropping the factor of 2 from integrating sin over 0 to pi.
export const efcdArcCenter: ProblemKey = {
  problemId: 'efcd-arc-center',
  statement:
    'A semicircular arc of radius 0.050 m carries a uniformly distributed charge of +6.0 nC. Find the magnitude of the electric field at the center of the arc. Use k = 8.99e9 N m^2/C^2.',
  correctSolution: [
    'At the center the components along the arc cancel and only the component along the symmetry axis survives, dE_axis = dE sin(theta).',
    'Each piece is a distance R away with dq = lambda R d theta, so E = integral of (k lambda / R) sin(theta) d theta from 0 to pi.',
    'The integral of sin over 0 to pi is 2, so E = 2 k lambda / R, with lambda = Q / (pi R) = 6.0e-9 / (pi)(0.050) = 3.82e-8 C/m.',
    'Substitute: E = 2 (8.99e9)(3.82e-8) / 0.050 = 1.37e4 N/C, along the symmetry axis.',
  ],
  finalAnswer: '1.37e4 N/C',
  rubric:
    'Full credit requires E = 2 k lambda / R with lambda = Q / (pi R), giving about 1.37e4 N/C. Catch treating the arc as a point charge at distance R (k Q / R^2, about 2.16e4 N/C) and dropping the factor of 2 from the integral (k lambda / R, about 6.9e3 N/C).',
  flaws: [
    {
      misconceptionId: 'distribution-as-point',
      signature:
        'Treats the arc as a point charge at distance R, using k Q / R^2 (about 2.16e4 N/C).',
    },
    {
      misconceptionId: 'arc-omits-factor-2',
      signature:
        'Drops the factor of 2 from integrating sin over 0 to pi, giving k lambda / R (about 6.9e3 N/C).',
    },
  ],
};
