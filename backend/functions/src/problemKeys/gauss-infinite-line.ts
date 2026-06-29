import { ProblemKey } from '../types';

// Difficulty band 4. A Gaussian cylinder around a long wire gives E (2 pi r L) =
// lambda L / epsilon_0, so E = 2 k lambda / r. With lambda = 5.0e-8 C/m and r = 0.080
// m, E = 1.12e4 N/C. k = 8.99e9. Targets using an inverse-square fall off and dropping
// the factor of 2.
export const gaussInfiniteLine: ProblemKey = {
  problemId: 'gauss-infinite-line',
  statement:
    'A very long straight wire carries a uniform linear charge density of 5.0e-8 C/m. Find the magnitude of the electric field 0.080 m from the wire. Use k = 8.99e9 N m^2/C^2.',
  correctSolution: [
    'Pick a Gaussian cylinder of radius r and length L around the wire. By symmetry the flux is through the curved side only, E (2 pi r L).',
    'The enclosed charge is lambda L, so E (2 pi r L) = lambda L / epsilon_0, which gives E = 2 k lambda / r (it falls off as one over r).',
    'Substitute: E = 2 (8.99e9)(5.0e-8) / 0.080 = 1.12e4 N/C.',
  ],
  finalAnswer: '1.12e4 N/C',
  rubric:
    'Full credit requires E = 2 k lambda / r = about 1.12e4 N/C, falling off as one over r. Catch using an inverse-square fall off 2 k lambda / r^2 (about 1.4e5 N/C) and dropping the factor of 2 (about 5.6e3 N/C).',
  flaws: [
    {
      misconceptionId: 'line-uses-inverse-square',
      signature: 'Uses 2 k lambda / r^2 instead of one over r, giving about 1.4e5 N/C.',
    },
    {
      misconceptionId: 'line-omits-factor-2',
      signature: 'Drops the factor of 2, using k lambda / r (about 5.6e3 N/C).',
    },
  ],
};
