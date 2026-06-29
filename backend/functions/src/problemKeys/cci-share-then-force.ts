import { ProblemKey } from '../types';

// Difficulty band 5, synthesis of charge sharing and Coulomb law. Two identical
// spheres carrying +6.0 nC and +2.0 nC share to (6 + 2)/2 = +4.0 nC each, then at
// r = 0.10 m the force is F = k (4.0e-9)^2 / (0.10)^2 = 1.44e-5 N. k = 8.99e9.
// Targets skipping the sharing step and the inverse-square error.
export const cciShareThenForce: ProblemKey = {
  problemId: 'cci-share-then-force',
  statement:
    'Two identical small metal spheres carry +6.0 nC and +2.0 nC. They are briefly touched together, then placed 0.10 m apart. Find the magnitude of the electric force between them. Use k = 8.99e9 N m^2/C^2.',
  correctSolution: [
    'Share the charge first: identical spheres in contact split their total evenly, so each carries (6.0 nC + 2.0 nC) / 2 = +4.0 nC.',
    'Choose the relation for the separated spheres: Coulomb law F = k q_1 q_2 / r^2 with q_1 = q_2 = 4.0e-9 C and r = 0.10 m.',
    'Square the separation: r^2 = (0.10 m)^2 = 0.010 m^2.',
    'Substitute and compute: F = (8.99e9)(4.0e-9)(4.0e-9) / 0.010 = 1.44e-5 N (repulsive, since both are positive).',
  ],
  finalAnswer: '1.44e-5 N',
  rubric:
    'Full credit requires sharing the charge to +4.0 nC on each sphere before applying Coulomb law F = k q_1 q_2 / r^2 with the separation squared, giving about 1.44e-5 N. Catch using the original +6.0 nC and +2.0 nC without sharing, and dividing by r instead of r squared.',
  flaws: [
    {
      misconceptionId: 'charge-sharing-omitted',
      signature:
        'Uses the original +6.0 nC and +2.0 nC in Coulomb law without sharing first, giving about 1.08e-5 N.',
    },
    {
      misconceptionId: 'inverse-square-error',
      signature:
        'Divides by r instead of r squared after sharing, giving about 1.44e-6 N.',
    },
  ],
};
