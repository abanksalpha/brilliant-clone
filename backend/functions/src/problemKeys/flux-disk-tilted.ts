import { ProblemKey } from '../types';

// Difficulty band 4. Flux through a tilted disk: Phi = E A cos(theta) with A = pi r^2.
// With E = 500 N/C, r = 0.10 m, theta = 30 degrees, A = 0.0314 m^2 and Phi = 13.6
// N m^2/C. Targets dropping the cosine and using sine.
export const fluxDiskTilted: ProblemKey = {
  problemId: 'flux-disk-tilted',
  statement:
    "A flat circular disk of radius 0.10 m sits in a uniform electric field of 500 N/C. The disk's normal makes an angle of 30 degrees with the field. Find the electric flux through the disk.",
  correctSolution: [
    'The flux through a flat area is Phi = E A cos(theta), and a disk has area A = pi r^2.',
    'Compute the area: A = pi (0.10 m)^2 = 0.0314 m^2.',
    'Find the cosine: cos(30 degrees) = 0.866.',
    'Substitute: Phi = (500)(0.0314)(0.866) = 13.6 N m^2/C.',
  ],
  finalAnswer: '13.6 N m^2/C',
  rubric:
    'Full credit requires Phi = E (pi r^2) cos(theta) = about 13.6 N m^2/C. Catch dropping the cosine and using E A (about 15.7 N m^2/C) and using sine instead of cosine (about 7.9 N m^2/C).',
  flaws: [
    {
      misconceptionId: 'flux-ignores-angle',
      signature: 'Uses E (pi r^2) and drops the cosine, giving about 15.7 N m^2/C.',
    },
    {
      misconceptionId: 'flux-uses-sin',
      signature: 'Uses sine instead of cosine, giving about 7.9 N m^2/C.',
    },
  ],
};
