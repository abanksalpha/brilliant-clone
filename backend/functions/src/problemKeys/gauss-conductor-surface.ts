import { ProblemKey } from '../types';

// Difficulty band 5. Just outside a conductor a pillbox has flux only through its
// outer cap (the field inside the metal is zero), so E A = sigma A / epsilon_0 and
// E = sigma / epsilon_0. With sigma = 5.0e-8 C/m^2, E = 5.65e3 N/C. Targets using the
// sheet result sigma / (2 epsilon_0) and using Coulomb's constant.
export const gaussConductorSurface: ProblemKey = {
  problemId: 'gauss-conductor-surface',
  statement:
    'The flat surface of a charged conductor carries a surface charge density of 5.0e-8 C/m^2. Find the magnitude of the electric field just outside the surface. Use epsilon_0 = 8.85e-12 C^2/(N m^2).',
  correctSolution: [
    'Just outside the conductor the field is perpendicular to the surface, and the field inside the metal is zero, so a pillbox has flux only through its outer cap, E A.',
    'The enclosed charge is sigma A, so E A = sigma A / epsilon_0, giving E = sigma / epsilon_0.',
    'Substitute: E = 5.0e-8 / 8.85e-12 = 5.65e3 N/C.',
  ],
  finalAnswer: '5.65e3 N/C',
  rubric:
    'Full credit requires E = sigma / epsilon_0 = about 5.65e3 N/C (no factor of 2, because the field is on one side only). Catch using sigma / (2 epsilon_0), the isolated-sheet result (about 2.82e3 N/C), and using Coulomb constant k sigma (about 450 N/C).',
  flaws: [
    {
      misconceptionId: 'conductor-uses-sheet-formula',
      signature: 'Uses sigma / (2 epsilon_0), the isolated-sheet result, giving about 2.82e3 N/C.',
    },
    {
      misconceptionId: 'conductor-uses-coulomb',
      signature: 'Multiplies sigma by Coulomb constant k instead of dividing by epsilon_0, giving about 450 N/C.',
    },
  ],
};
