import { ProblemKey } from '../types';

// Difficulty band 5. Inside a uniformly charged solid sphere a Gaussian sphere of
// radius r encloses only the fraction (r/R)^3 of the charge, giving E = k Q r / R^3.
// With Q = 12e-9 C, R = 0.10 m, r = 0.050 m, E = 5.39e3 N/C. k = 8.99e9. Targets
// treating it as a point charge (k Q / r^2) and assuming the inside field is zero
// (true for a shell, not a solid sphere).
export const gaussSolidSphereInside: ProblemKey = {
  problemId: 'gauss-solid-sphere-inside',
  statement:
    'A solid sphere of radius 0.10 m carries a charge of +12 nC spread uniformly through its volume. Find the magnitude of the electric field at a point 0.050 m from the center. Use k = 8.99e9 N m^2/C^2.',
  correctSolution: [
    'A Gaussian sphere of radius r inside encloses only the charge in that volume: Q_enc = Q (r/R)^3.',
    'Gauss: E (4 pi r^2) = Q_enc / epsilon_0, which simplifies to E = k Q r / R^3.',
    'List the givens: Q = 12e-9 C, R = 0.10 m, r = 0.050 m.',
    'Substitute: E = (8.99e9)(12e-9)(0.050) / (0.10)^3 = 5.39e3 N/C.',
  ],
  finalAnswer: '5.39e3 N/C',
  rubric:
    'Full credit requires E = k Q r / R^3 (only the enclosed fraction counts), giving about 5.39e3 N/C. Catch treating the sphere as a point charge k Q / r^2 (about 4.3e4 N/C) and assuming the inside field is zero (true only for a shell).',
  flaws: [
    {
      misconceptionId: 'inside-uses-point',
      signature: 'Treats the sphere as a point charge, using k Q / r^2 (about 4.3e4 N/C).',
    },
    {
      misconceptionId: 'inside-assumes-zero',
      signature: 'Assumes the field inside is zero (a shell result), reporting 0 instead of k Q r / R^3.',
    },
  ],
};
