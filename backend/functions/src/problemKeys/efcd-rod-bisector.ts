import { ProblemKey } from '../types';

// Difficulty band 5. Field on the perpendicular bisector of a finite rod: only the
// perpendicular component survives, E = k Q / (y sqrt(y^2 + (L/2)^2)). With Q =
// 8.0e-9 C, L = 0.20 m, y = 0.060 m, E = 1.03e4 N/C. k = 8.99e9. Targets treating
// the rod as a point charge at distance y, and using y^2 + (L/2)^2 instead of
// y sqrt(y^2 + (L/2)^2) in the denominator.
export const efcdRodBisector: ProblemKey = {
  problemId: 'efcd-rod-bisector',
  statement:
    'A straight rod of length 0.20 m carries a uniformly distributed charge of +8.0 nC. Find the magnitude of the electric field at a point 0.060 m from the rod on its perpendicular bisector. Use k = 8.99e9 N m^2/C^2.',
  correctSolution: [
    'By symmetry only the perpendicular component survives; the components along the rod cancel.',
    'With dq = lambda dx (lambda = Q / L) and each piece a distance sqrt(y^2 + x^2) away, the perpendicular component integrates to E = k Q / (y sqrt(y^2 + (L/2)^2)).',
    'List the givens: Q = 8.0e-9 C, L = 0.20 m, y = 0.060 m, so L/2 = 0.10 m and y^2 + (L/2)^2 = 0.0136 m^2.',
    'Substitute: E = (8.99e9)(8.0e-9) / (0.060 * sqrt(0.0136)), which gives E = 1.03e4 N/C perpendicular to the rod.',
  ],
  finalAnswer: '1.03e4 N/C',
  rubric:
    'Full credit requires E = k Q / (y sqrt(y^2 + (L/2)^2)), giving about 1.03e4 N/C. Catch treating the rod as a point charge at distance y (k Q / y^2, about 2.0e4 N/C) and using y^2 + (L/2)^2 in the denominator instead of y sqrt(y^2 + (L/2)^2) (about 5.3e3 N/C).',
  flaws: [
    {
      misconceptionId: 'distribution-as-point',
      signature:
        'Treats the rod as a point charge at distance y, using k Q / y^2 (about 2.0e4 N/C).',
    },
    {
      misconceptionId: 'rod-bisector-geometry-error',
      signature:
        'Divides by y^2 + (L/2)^2 instead of y sqrt(y^2 + (L/2)^2), giving about 5.3e3 N/C.',
    },
  ],
};
