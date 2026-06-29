import { ProblemKey } from '../types';

// Difficulty band 4. Inverse of the flux relation: cos(theta) = Phi / (E A). With
// E = 300 N/C, A = 0.040 m^2, Phi = 6.0 N m^2/C, cos(theta) = 0.50 so theta = 60
// degrees. Targets assuming the surface is face-on (theta = 0) and using sine.
export const fluxSolveAngle: ProblemKey = {
  problemId: 'flux-solve-angle',
  statement:
    'A flat square surface with sides of 0.20 m sits in a uniform electric field of 300 N/C. The electric flux through it is 6.0 N m^2/C. Find the angle between the field and the surface normal.',
  correctSolution: [
    'The flux relation is Phi = E A cos(theta), with theta the unknown.',
    'Solve for the angle: cos(theta) = Phi / (E A).',
    'Substitute: cos(theta) = 6.0 / ((300)(0.040)) = 6.0 / 12 = 0.50.',
    'Take the inverse cosine: theta = 60 degrees.',
  ],
  finalAnswer: '60 degrees',
  rubric:
    'Full credit requires cos(theta) = Phi / (E A) = 0.50, so theta = 60 degrees. Catch assuming the surface is face-on (theta = 0 degrees) and using sine instead of cosine (theta = 30 degrees).',
  flaws: [
    {
      misconceptionId: 'flux-ignores-angle',
      signature: 'Assumes the surface is face-on and reports 0 degrees, ignoring that the flux is less than E A.',
    },
    {
      misconceptionId: 'flux-uses-sin',
      signature: 'Sets sin(theta) = 0.50 instead of cosine, giving 30 degrees.',
    },
  ],
};
