import { ProblemKey } from '../types';

// Difficulty band 5. A neutral conducting shell holds a +5.0 nC point charge at
// its center. The shell pulls -5.0 nC to its inner surface and pushes +5.0 nC to
// its outer surface, but it adds no net charge, so outside everything the field is
// that of the +5.0 nC enclosed charge: E = k Q / r^2 at r = 0.40 m, about 2.81e2
// N/C. k = 8.99e9. Targets double counting the central and outer-surface charge,
// and the inverse-square error.
export const cciShellOuterField: ProblemKey = {
  problemId: 'cci-shell-outer-field',
  statement:
    'A +5.0 nC point charge sits at the center of a neutral hollow metal sphere with inner radius 0.10 m and outer radius 0.20 m. Find the magnitude of the electric field at a point 0.40 m from the center. Use k = 8.99e9 N m^2/C^2.',
  correctSolution: [
    'The shell is neutral, so it adds no net charge. The induced -5.0 nC on the inner surface and +5.0 nC on the outer surface sum to zero.',
    'At a point outside everything, only the net enclosed charge matters, which is the +5.0 nC central charge: E = k Q / r^2.',
    'List the givens: Q = 5.0e-9 C and r = 0.40 m, so r^2 = 0.16 m^2.',
    'Substitute and compute: E = (8.99e9)(5.0e-9) / 0.16 = 2.81e2 N/C, directed radially outward.',
  ],
  finalAnswer: '2.81e2 N/C',
  rubric:
    'Full credit requires recognizing the neutral shell contributes no net charge, so the field at 0.40 m comes from the +5.0 nC enclosed charge through E = k Q / r^2, about 2.81e2 N/C. Catch adding the outer-surface charge to the central charge as if both were extra sources, and dividing by r instead of r squared.',
  flaws: [
    {
      misconceptionId: 'conductor-double-counts-charge',
      signature:
        'Adds the +5.0 nC central charge to the +5.0 nC on the outer surface and uses 10 nC as the source, giving about 5.62e2 N/C.',
    },
    {
      misconceptionId: 'inverse-square-error',
      signature:
        'Divides by r instead of r squared, giving about 1.12e2 N/C.',
    },
  ],
};
