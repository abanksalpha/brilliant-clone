import { ProblemKey } from '../types';

// Difficulty band 4. Field on the axis of a rod, a distance a beyond its near end:
// E = k Q / (a (a + L)). With Q = 5.0e-9 C, L = 0.20 m, a = 0.10 m, E = 1.50e3 N/C.
// k = 8.99e9. Targets treating the rod as a point charge at its near end, and
// treating it as a point charge at its center.
export const efcdRodEndAxis: ProblemKey = {
  problemId: 'efcd-rod-end-axis',
  statement:
    "A straight rod of length 0.20 m carries a uniformly distributed charge of +5.0 nC. Find the magnitude of the electric field at a point on the rod's axis, 0.10 m beyond its near end. Use k = 8.99e9 N m^2/C^2.",
  correctSolution: [
    'Every piece points along the axis, so integrate dE = k lambda ds / s^2 (lambda = Q / L) from s = a to s = a + L.',
    'The integral gives E = k lambda (1/a - 1/(a + L)) = k Q / (a (a + L)).',
    'List the givens: Q = 5.0e-9 C, L = 0.20 m, a = 0.10 m, so a (a + L) = (0.10)(0.30) = 0.030 m^2.',
    'Substitute: E = (8.99e9)(5.0e-9) / 0.030 = 1.50e3 N/C, along the axis away from the rod.',
  ],
  finalAnswer: '1.50e3 N/C',
  rubric:
    'Full credit requires E = k Q / (a (a + L)), giving about 1.50e3 N/C. Catch treating the rod as a point charge at its near end (k Q / a^2, about 4.5e3 N/C) and as a point charge at its center a distance a + L/2 away (about 1.12e3 N/C).',
  flaws: [
    {
      misconceptionId: 'distribution-as-point',
      signature:
        'Treats the rod as a point charge at its near end, using k Q / a^2 (about 4.5e3 N/C).',
    },
    {
      misconceptionId: 'rod-end-uses-center',
      signature:
        'Treats the rod as a point charge at its center, using k Q / (a + L/2)^2 (about 1.12e3 N/C).',
    },
  ],
};
