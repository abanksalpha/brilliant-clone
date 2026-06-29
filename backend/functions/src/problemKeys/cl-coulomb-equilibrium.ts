import { ProblemKey } from '../types';

// Difficulty band 5. The classic equilibrium point between two like charges. With
// a +q and a +4q charge 0.30 m apart, the third charge feels zero net force where
// the two pushes balance: 0.30 - x = 2x, so x = 0.10 m from the +q charge. The
// test charge and k cancel, so the answer is independent of them. Targets skipping
// the square root and measuring from the wrong charge.
export const clCoulombEquilibrium: ProblemKey = {
  problemId: 'cl-coulomb-equilibrium',
  statement:
    'A +q charge and a +4q charge are fixed 0.30 m apart. A third charge is placed on the line between them so that the net electric force on it is zero. Find its distance from the +q charge.',
  correctSolution: [
    'For zero net force the two pushes on the third charge must be equal in magnitude. Let x be its distance from the +q charge, so it is (0.30 - x) from the +4q charge.',
    'Set the magnitudes equal: k q Q / x^2 = k (4q) Q / (0.30 - x)^2. The test charge Q and the constant k cancel.',
    'Simplify the ratio: (0.30 - x)^2 = 4 x^2, so taking the root that lies between the charges, 0.30 - x = 2x.',
    'Solve: 0.30 = 3x, so x = 0.10 m from the +q charge.',
  ],
  finalAnswer: '0.10 m',
  rubric:
    'Full credit requires setting the two force magnitudes equal, cancelling k and the test charge, taking the square root of the 4-to-1 ratio to get 0.30 - x = 2x, and solving x = 0.10 m measured from the +q charge. Catch skipping the square root and reporting the distance from the wrong charge.',
  flaws: [
    {
      misconceptionId: 'equilibrium-sqrt-omitted',
      signature:
        'Sets 0.30 - x = 4x without taking the square root of the ratio, getting x = 0.06 m.',
    },
    {
      misconceptionId: 'equilibrium-reference-error',
      signature:
        'Balances correctly but reports the 0.20 m distance from the +4q charge instead of the 0.10 m distance from the +q charge.',
    },
  ],
};
