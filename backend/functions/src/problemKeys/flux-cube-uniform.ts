import { ProblemKey } from '../types';

// Difficulty band 4. Net flux through a closed cube in a uniform field is zero: the
// flux entering one face equals the flux leaving the opposite face. With E = 300 N/C
// and a 0.10 m cube, one face carries E A = 3 N m^2/C in and 3 out, netting 0.
// Targets reporting one face's flux as the net, and summing the face magnitudes.
export const fluxCubeUniform: ProblemKey = {
  problemId: 'flux-cube-uniform',
  statement:
    'A cube of side 0.10 m sits in a uniform electric field of 300 N/C, with two of its faces perpendicular to the field. Find the net electric flux through the whole cube.',
  correctSolution: [
    'A closed surface adds the flux through every face, counting flux leaving as positive and entering as negative.',
    'Only the two faces perpendicular to the field carry flux: each is E A = (300)(0.10 m)^2 = 3 N m^2/C, one entering and one leaving.',
    'They cancel, so the net flux through the whole cube is 0 N m^2/C. (No charge is enclosed.)',
  ],
  finalAnswer: '0 N m^2/C',
  rubric:
    'Full credit requires recognizing the entering flux on one face cancels the leaving flux on the opposite face, so the net is 0 (no enclosed charge). Catch reporting a single face value (3 N m^2/C) and summing the face magnitudes (6 N m^2/C).',
  flaws: [
    {
      misconceptionId: 'flux-closed-empty-nonzero',
      signature: 'Reports one face value E A = 3 N m^2/C as the net flux instead of zero.',
    },
    {
      misconceptionId: 'flux-sums-face-magnitudes',
      signature: 'Adds the two face magnitudes (3 + 3) instead of letting them cancel, giving 6 N m^2/C.',
    },
  ],
};
