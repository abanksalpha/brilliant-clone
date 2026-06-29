import { ProblemKey } from '../types';

// Difficulty band 4. Proportional reasoning on Coulomb law: with the charges
// fixed, F is proportional to 1/r^2, so cutting the separation to one third
// multiplies the force by nine. 0.080 N becomes 0.72 N. Targets scaling by 1/r
// and inverting the direction of the dependence.
export const clCoulombScaling: ProblemKey = {
  problemId: 'cl-coulomb-scaling',
  statement:
    'Two point charges separated by a distance r exert a force of 0.080 N on each other. The charges are unchanged, but the separation is reduced to one third of r. Find the new magnitude of the force between them.',
  correctSolution: [
    'Coulomb law is F = k q_1 q_2 / r^2, so with the charges fixed the force is proportional to 1 / r^2.',
    'The separation becomes r/3, so r^2 becomes (r/3)^2 = r^2 / 9. Dividing by one ninth multiplies the force by 9.',
    'New force: F = 9 (0.080 N) = 0.72 N.',
  ],
  finalAnswer: '0.72 N',
  rubric:
    'Full credit requires recognizing F is proportional to 1/r^2, so reducing the separation to one third multiplies the force by nine, giving 0.72 N. Catch scaling by 1/r (a factor of 3) and treating a smaller separation as a weaker force.',
  flaws: [
    {
      misconceptionId: 'inverse-square-error',
      signature: 'Scales by 1/r instead of 1/r^2, multiplying by 3 to get about 0.24 N.',
    },
    {
      misconceptionId: 'force-distance-direction-error',
      signature:
        'Treats a smaller separation as a weaker force and divides by 9, getting about 0.0089 N.',
    },
  ],
};
