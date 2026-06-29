import { ProblemKey } from '../types';

// Difficulty band 4. Proportional reasoning on the point-charge field: with the
// charge fixed, E is proportional to 1 / r^2, so tripling the distance divides the
// field by nine. 9.0e5 N/C becomes 1.0e5 N/C. Targets scaling by 1/r and inverting
// the direction of the dependence.
export const effFieldDistanceRatio: ProblemKey = {
  problemId: 'eff-field-distance-ratio',
  statement:
    'The electric field 0.10 m from a point charge has magnitude 9.0e5 N/C. Find the magnitude of the electric field 0.30 m from the same charge.',
  correctSolution: [
    'The field of a point charge is E = k Q / r^2, so with the charge fixed the field is proportional to 1 / r^2.',
    'The distance triples from 0.10 m to 0.30 m, so r^2 grows by a factor of nine and the field drops to one ninth.',
    'New field: E = 9.0e5 / 9 = 1.0e5 N/C.',
  ],
  finalAnswer: '1.0e5 N/C',
  rubric:
    'Full credit requires recognizing E is proportional to 1 / r^2, so tripling the distance divides the field by nine, giving 1.0e5 N/C. Catch scaling by 1/r (a factor of 3) and treating a larger distance as a stronger field.',
  flaws: [
    {
      misconceptionId: 'inverse-square-error',
      signature: 'Scales by 1/r instead of 1/r^2, dividing by 3 to get about 3.0e5 N/C.',
    },
    {
      misconceptionId: 'field-distance-direction-error',
      signature: 'Treats a larger distance as a stronger field and multiplies by 9, getting about 8.1e6 N/C.',
    },
  ],
};
