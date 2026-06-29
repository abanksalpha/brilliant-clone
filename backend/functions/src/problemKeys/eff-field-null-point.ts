import { ProblemKey } from '../types';

// Difficulty band 5. The null point between two like charges, the field-language
// version of the Coulomb balance point. With +q and +4q a distance 0.60 m apart,
// the net field is zero where k q / x^2 = k (4q) / (0.60 - x)^2, so 0.60 - x = 2x
// and x = 0.20 m from the +q charge. The reference charge and k cancel. Targets
// skipping the square root and measuring from the wrong charge.
export const effFieldNullPoint: ProblemKey = {
  problemId: 'eff-field-null-point',
  statement:
    'A +q charge and a +4q charge are fixed 0.60 m apart on a line. Find the distance from the +q charge to the point between them where the net electric field is zero.',
  correctSolution: [
    'For zero net field the two field magnitudes must be equal. Let x be the distance from the +q charge, so the point is (0.60 - x) from the +4q charge.',
    'Set the magnitudes equal: k q / x^2 = k (4q) / (0.60 - x)^2. The factor k q cancels.',
    'Simplify the ratio: (0.60 - x)^2 = 4 x^2, so taking the root between the charges, 0.60 - x = 2x.',
    'Solve: 0.60 = 3x, so x = 0.20 m from the +q charge.',
  ],
  finalAnswer: '0.20 m',
  rubric:
    'Full credit requires setting the two field magnitudes equal, cancelling k and q, taking the square root of the 4-to-1 ratio to get 0.60 - x = 2x, and solving x = 0.20 m measured from the +q charge. Catch skipping the square root and reporting the distance from the wrong charge.',
  flaws: [
    {
      misconceptionId: 'null-point-sqrt-omitted',
      signature: 'Sets 0.60 - x = 4x without taking the square root of the ratio, getting x = 0.12 m.',
    },
    {
      misconceptionId: 'null-point-reference-error',
      signature:
        'Balances correctly but reports the 0.40 m distance from the +4q charge instead of the 0.20 m distance from the +q charge.',
    },
  ],
};
