import { ProblemKey } from '../types';

// Difficulty band 4. Conductors joined by a wire settle at a common potential
// V = k Q / R, so the charge each holds is proportional to its radius. With radii
// in the ratio 1 to 2 and a total of +9.0 nC, the larger sphere takes two thirds,
// or +6.0 nC. Targets splitting the charge equally regardless of size.
export const cciShareUnequalSpheres: ProblemKey = {
  problemId: 'cci-share-unequal-spheres',
  statement:
    'Two isolated metal spheres, one of radius R and the other of radius 2R, are far apart and then joined by a thin conducting wire. The total charge shared between them is +9.0 nC. After the charge settles, find the charge on the larger sphere.',
  correctSolution: [
    'Identify the principle: conductors joined by a wire settle at a common potential V = k Q / R, so the charge each holds is proportional to its radius.',
    'Set up the ratio: with radii R and 2R, the charges divide as 1 to 2, so the larger sphere holds two thirds of the total.',
    'Conserve charge: the total is +9.0 nC.',
    'Compute: the larger sphere ends with (2/3)(9.0 nC) = +6.0 nC (and the smaller holds +3.0 nC).',
  ],
  finalAnswer: '+6.0 nC',
  rubric:
    'Full credit requires recognizing that wired conductors reach a common potential so charge splits in proportion to radius, giving the larger sphere two thirds of +9.0 nC, or +6.0 nC. The single error to catch is splitting the charge equally as if the spheres were the same size.',
  flaws: [
    {
      misconceptionId: 'charge-sharing-equal-split',
      signature:
        'Splits the +9.0 nC equally to +4.5 nC each, ignoring that at a common potential the larger sphere holds more charge.',
    },
  ],
};
