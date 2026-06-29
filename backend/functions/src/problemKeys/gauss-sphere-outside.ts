import { ProblemKey } from '../types';

// Difficulty band 4. Outside a spherically symmetric charge, a Gaussian sphere gives
// E (4 pi r^2) = Q / epsilon_0, so E = k Q / r^2, the same as a point charge at the
// center. With Q = 8.0e-9 C and r = 0.20 m, E = 1.80e3 N/C. k = 8.99e9. Targets using
// the sphere radius R instead of the distance r, and dividing by r instead of r^2.
export const gaussSphereOutside: ProblemKey = {
  problemId: 'gauss-sphere-outside',
  statement:
    'A solid sphere of radius 0.10 m carries a uniformly distributed charge of +8.0 nC. Find the magnitude of the electric field at a point 0.20 m from the center. Use k = 8.99e9 N m^2/C^2.',
  correctSolution: [
    'Pick a Gaussian sphere of radius r through the point. By symmetry the field is uniform over it and points straight out, so the flux is E (4 pi r^2).',
    'Gauss: E (4 pi r^2) = Q / epsilon_0, so E = k Q / r^2 (the sphere acts like a point charge at the center).',
    'List the givens: Q = 8.0e-9 C and r = 0.20 m (the field point is outside the sphere).',
    'Substitute: E = (8.99e9)(8.0e-9) / (0.20)^2 = 1.80e3 N/C.',
  ],
  finalAnswer: '1.80e3 N/C',
  rubric:
    'Full credit requires E = k Q / r^2 with r = 0.20 m, giving about 1.80e3 N/C. Catch using the sphere radius R = 0.10 m instead of the distance (about 7.2e3 N/C) and dividing by r instead of r^2 (about 360 N/C).',
  flaws: [
    {
      misconceptionId: 'gauss-surface-not-distance',
      signature: 'Uses the sphere radius R = 0.10 m in k Q / R^2 instead of the distance r, giving about 7.2e3 N/C.',
    },
    {
      misconceptionId: 'inverse-square-error',
      signature: 'Divides by r instead of r^2, giving about 360 N/C.',
    },
  ],
};
