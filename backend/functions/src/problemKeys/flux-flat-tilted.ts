import { ProblemKey } from '../types';

// Difficulty band 4. Flux through a flat area in a uniform field: Phi = E A cos(theta).
// With E = 300 N/C, A = 0.040 m^2, theta = 30 degrees, Phi = 10.4 N m^2/C. Targets
// dropping the cosine (using E A) and using sine instead of cosine.
export const fluxFlatTilted: ProblemKey = {
  problemId: 'flux-flat-tilted',
  statement:
    'A flat square surface with sides of 0.20 m sits in a uniform electric field of 300 N/C. The surface normal makes an angle of 30 degrees with the field. Find the electric flux through the surface.',
  correctSolution: [
    'The flux through a flat area is Phi = E A cos(theta), where theta is the angle between the field and the surface normal.',
    'List the givens: E = 300 N/C, A = (0.20 m)^2 = 0.040 m^2, theta = 30 degrees.',
    'Find the cosine: cos(30 degrees) = 0.866.',
    'Substitute: Phi = (300)(0.040)(0.866) = 10.4 N m^2/C.',
  ],
  finalAnswer: '10.4 N m^2/C',
  rubric:
    'Full credit requires Phi = E A cos(theta) with A = 0.040 m^2 and cos(30) = 0.866, giving about 10.4 N m^2/C. Catch dropping the cosine and using E A (12 N m^2/C) and using sine instead of cosine (6 N m^2/C).',
  flaws: [
    {
      misconceptionId: 'flux-ignores-angle',
      signature: 'Uses E A and drops the cosine, giving 12 N m^2/C.',
    },
    {
      misconceptionId: 'flux-uses-sin',
      signature: 'Uses E A sin(theta) instead of cosine, giving 6 N m^2/C.',
    },
  ],
};
