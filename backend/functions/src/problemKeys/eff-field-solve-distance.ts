import { ProblemKey } from '../types';

// Difficulty band 4. The point-charge field solved for the distance:
// r = sqrt(k Q / E). Same law as the field calculation, rearranged.
// k = 8.99e9, Q = 2.0e-6 C, E = 5.0e5 N/C, r = 0.19 m. Targets solving
// E = k Q / r^2 for r and forgetting the square root.
export const effFieldSolveDistance: ProblemKey = {
  problemId: 'eff-field-solve-distance',
  statement:
    'A +2.0 microcoulomb point charge produces an electric field of magnitude 5.0e5 N/C at some distance from it. Find that distance. Use k = 8.99e9 N m^2/C^2.',
  correctSolution: [
    'Identify the relation: the field of a point charge is E = k Q / r^2, with E and Q known and r the unknown.',
    'Solve for the distance: r = sqrt(k Q / E).',
    'Substitute the givens: r = sqrt((8.99e9)(2.0e-6) / 5.0e5) = sqrt(0.036 m^2).',
    'Take the square root: r = 0.19 m.',
  ],
  finalAnswer: '0.19 m',
  rubric:
    'Full credit requires rearranging E = k Q / r^2 to r = sqrt(k Q / E), substituting correctly, and taking the square root to get a distance near 0.19 m. The error to catch is solving r = k Q / E without the square root.',
  flaws: [
    {
      misconceptionId: 'field-solve-omits-sqrt',
      signature:
        'Solves r = k Q / E without taking the square root, reporting about 0.036 m instead of its square root, 0.19 m.',
    },
  ],
};
