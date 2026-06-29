import { ProblemKey } from '../types';

// Difficulty band 4. Sequential pairwise sharing among identical spheres. A (+12
// nC) touches B: each becomes +6.0 nC. Then B (+6.0 nC) touches C: each becomes
// +3.0 nC. So sphere C ends with +3.0 nC. Targets dividing the total three ways at
// once and stopping after the first sharing.
export const cciShareThreeSpheres: ProblemKey = {
  problemId: 'cci-share-three-spheres',
  statement:
    'Three identical isolated metal spheres sit far apart. Sphere A carries +12 nC; spheres B and C are neutral. Sphere A is touched to sphere B and separated, then sphere B is touched to sphere C and separated. Find the final charge on sphere C.',
  correctSolution: [
    'First touch: sphere A (+12 nC) meets identical neutral sphere B, so the charge splits evenly and each leaves with +6.0 nC.',
    'Second touch: sphere B (now +6.0 nC) meets identical neutral sphere C, so that +6.0 nC splits evenly.',
    'Compute sphere C: (6.0 nC) / 2 = +3.0 nC.',
  ],
  finalAnswer: '+3.0 nC',
  rubric:
    'Full credit requires sharing pairwise in order: +12 nC halves to +6.0 nC on B, then +6.0 nC halves to +3.0 nC on C. Catch dividing the original +12 nC three ways at once, and stopping after the first sharing.',
  flaws: [
    {
      misconceptionId: 'charge-shared-three-ways',
      signature:
        'Divides the original +12 nC equally among all three spheres to get +4.0 nC, instead of sharing pairwise in sequence.',
    },
    {
      misconceptionId: 'charge-sharing-single-step',
      signature:
        'Stops after the first touch and reports +6.0 nC for sphere C, missing that the second touch halves the charge again.',
    },
  ],
};
