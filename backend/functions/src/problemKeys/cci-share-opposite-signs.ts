import { ProblemKey } from '../types';

// Difficulty band 4. Sharing charges of opposite sign: the spheres reach a common
// charge equal to the average of the signed charges, (16 + (-4)) / 2 = +6.0 nC
// each. Targets averaging the magnitudes (ignoring the sign) and adding without
// dividing.
export const cciShareOppositeSigns: ProblemKey = {
  problemId: 'cci-share-opposite-signs',
  statement:
    'Two identical isolated metal spheres carry +16 nC and -4.0 nC. They are briefly touched together and then separated. Find the charge on each sphere afterward.',
  correctSolution: [
    'Conserve charge using the signs: the total is +16 nC + (-4.0 nC) = +12 nC.',
    'Split evenly between the two identical spheres: each gets half of the signed total.',
    'Compute: each sphere ends with (12 nC) / 2 = +6.0 nC.',
  ],
  finalAnswer: '+6.0 nC',
  rubric:
    'Full credit requires adding the charges with their signs to +12 nC and dividing by the two identical spheres for +6.0 nC each. Catch averaging the magnitudes as if both were positive, and adding the charges without dividing by two.',
  flaws: [
    {
      misconceptionId: 'charge-sign-ignored',
      signature:
        'Averages the magnitudes (16 and 4) to +10 nC, ignoring that the negative charge cancels part of the positive.',
    },
    {
      misconceptionId: 'charge-sum-not-averaged',
      signature:
        'Adds the signed charges to +12 nC but forgets to divide by the two spheres.',
    },
  ],
};
