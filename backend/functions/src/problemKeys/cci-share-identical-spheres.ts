import { ProblemKey } from '../types';

// Difficulty band 4. Two identical conductors that touch reach a common
// potential, which for equal spheres means equal charge. Total +8.0 nC splits to
// +4.0 nC each. Targets forgetting that the charge is shared.
export const cciShareIdenticalSpheres: ProblemKey = {
  problemId: 'cci-share-identical-spheres',
  statement:
    'Two identical isolated metal spheres sit far apart. Sphere A carries +8.0 nC and sphere B is neutral. The spheres are briefly touched together and then separated. Find the charge on each sphere afterward.',
  correctSolution: [
    'Identify the principle: two identical conductors that touch share charge until both reach the same potential, which for equal spheres means equal charge.',
    'Conserve charge: the total is +8.0 nC + 0 = +8.0 nC.',
    'Split the total evenly between the two identical spheres: each gets half.',
    'Compute: each sphere ends with (8.0 nC) / 2 = +4.0 nC.',
  ],
  finalAnswer: '+4.0 nC',
  rubric:
    'Full credit requires conserving the total charge of +8.0 nC and splitting it evenly between the two identical spheres for +4.0 nC each. The single error to catch is leaving all the charge on the originally charged sphere instead of sharing it.',
  flaws: [
    {
      misconceptionId: 'charge-sharing-omitted',
      signature:
        'Leaves all +8.0 nC on sphere A and sphere B neutral, forgetting that touching identical conductors splits the charge evenly (each should be +4.0 nC).',
    },
  ],
};
