import { ProblemKey } from '../types';

// Difficulty band 5. Flux through the curved part of a hemisphere in a uniform field
// parallel to its axis equals the flux through its flat circular cap, E (pi r^2),
// because the closed hemisphere encloses no charge. With E = 400 N/C and r = 0.050 m,
// Phi = 3.14 N m^2/C. Targets using the curved surface area 2 pi r^2 and using the
// diameter as the radius.
export const fluxHemisphereUniform: ProblemKey = {
  problemId: 'flux-hemisphere-uniform',
  statement:
    'A hemispherical surface of radius 0.050 m sits in a uniform electric field of 400 N/C, with the field parallel to the axis of the hemisphere. Find the electric flux through the curved part of the hemisphere.',
  correctSolution: [
    'The hemisphere plus its flat circular cap form a closed surface enclosing no charge, so the flux through the curved part equals the flux through the cap.',
    'The cap is a flat circle facing the field, so its flux is Phi = E (pi r^2).',
    'Compute the area: pi r^2 = pi (0.050 m)^2 = 7.85e-3 m^2.',
    'Substitute: Phi = (400)(7.85e-3) = 3.14 N m^2/C.',
  ],
  finalAnswer: '3.14 N m^2/C',
  rubric:
    'Full credit requires recognizing the curved flux equals the flat cap flux E (pi r^2) = about 3.14 N m^2/C. Catch using the curved surface area 2 pi r^2 (about 6.28 N m^2/C) and using the diameter as the radius (about 12.6 N m^2/C).',
  flaws: [
    {
      misconceptionId: 'flux-uses-curved-area',
      signature: 'Multiplies the field by the curved surface area 2 pi r^2, giving about 6.28 N m^2/C.',
    },
    {
      misconceptionId: 'flux-radius-diameter',
      signature: 'Uses the diameter 0.10 m as the radius in pi r^2, giving about 12.6 N m^2/C.',
    },
  ],
};
