import { ProblemKey } from '../types';

// Difficulty band 5. Field near a very long line of charge: E = 2 k lambda / r,
// falling off as one over r (not one over r squared). With lambda = 4.0e-8 C/m and
// r = 0.10 m, E = 7.19e3 N/C. k = 8.99e9. Targets using an inverse-square fall off
// and dropping the factor of 2.
export const efcdInfiniteLine: ProblemKey = {
  problemId: 'efcd-infinite-line',
  statement:
    'A very long straight line of charge has a uniform linear charge density of 4.0e-8 C/m. Find the magnitude of the electric field at a point 0.10 m from the line. Use k = 8.99e9 N m^2/C^2.',
  correctSolution: [
    'Integrating dE = k dq / s^2 along the whole line and keeping only the perpendicular component gives E = 2 k lambda / r, which falls off as one over r.',
    'List the givens: lambda = 4.0e-8 C/m and r = 0.10 m.',
    'Substitute: E = 2 (8.99e9)(4.0e-8) / 0.10 = 7.19e3 N/C, pointing radially away from the line.',
  ],
  finalAnswer: '7.19e3 N/C',
  rubric:
    'Full credit requires E = 2 k lambda / r, giving about 7.19e3 N/C, with the field falling off as one over r. Catch using an inverse-square fall off 2 k lambda / r^2 (about 7.2e4 N/C) and dropping the factor of 2 (k lambda / r, about 3.6e3 N/C).',
  flaws: [
    {
      misconceptionId: 'line-uses-inverse-square',
      signature:
        'Uses an inverse-square fall off 2 k lambda / r^2 instead of one over r, giving about 7.2e4 N/C.',
    },
    {
      misconceptionId: 'line-omits-factor-2',
      signature: 'Drops the factor of 2, using k lambda / r (about 3.6e3 N/C).',
    },
  ],
};
