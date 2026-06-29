import { ProblemKey } from '../types';

// Difficulty band 5. Optimization on Coulomb law. With a fixed total Q and a fixed
// separation, F = k q (Q - q) / r^2 depends only on the product q (Q - q), which
// is maximized at q = Q/2. For Q = 12 microcoulomb the best split is 6.0
// microcoulomb on each part. k and r cancel out of the answer. Targets the belief
// that loading all the charge onto one part maximizes the force.
export const clCoulombChargeSplitMax: ProblemKey = {
  problemId: 'cl-coulomb-charge-split-max',
  statement:
    'A total charge of 12 microcoulomb is split between two small spheres that are held a fixed distance apart. One sphere carries a charge q and the other carries the remaining 12 microcoulomb minus q. Find the value of q that makes the electric force between the two spheres as large as possible.',
  correctSolution: [
    'Call the two parts q and (Q - q) with Q = 12 microcoulomb. At a fixed separation r, Coulomb law gives the force F = k q (Q - q) / r^2.',
    'Only the product q (Q - q) changes as the split changes, so the largest force comes from the largest value of q (Q - q) = q Q - q^2.',
    'Set the derivative to zero: d/dq (q Q - q^2) = Q - 2 q = 0, so q = Q / 2. The second derivative is -2, so this is a maximum.',
    'Split the total evenly: q = (12 microcoulomb) / 2 = 6.0 microcoulomb, and the other part is also 6.0 microcoulomb.',
  ],
  finalAnswer: '6.0e-6 C',
  rubric:
    'Full credit requires writing the force as F = k q (Q - q) / r^2 with k and r fixed, recognizing only the product q (Q - q) matters, and maximizing it (q = Q/2) to get q = 6.0 microcoulomb, an even split. Catch the belief that piling the whole charge onto one part maximizes the force.',
  flaws: [
    {
      misconceptionId: 'optimization-endpoint-error',
      signature:
        'Assumes a larger charge always means a larger force and puts all 12 microcoulomb on one part (q = 1.2e-5 C), which actually gives zero force.',
    },
  ],
};
