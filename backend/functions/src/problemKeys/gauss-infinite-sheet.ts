import { ProblemKey } from '../types';

// Difficulty band 4. A Gaussian pillbox through a sheet gives E (2A) = sigma A /
// epsilon_0, so E = sigma / (2 epsilon_0), independent of distance. With sigma =
// 4.0e-8 C/m^2, E = 2.26e3 N/C. Targets using sigma / epsilon_0 (the conductor result)
// and using Coulomb's constant.
export const gaussInfiniteSheet: ProblemKey = {
  problemId: 'gauss-infinite-sheet',
  statement:
    'A large flat sheet carries a uniform surface charge density of 4.0e-8 C/m^2. Find the magnitude of the electric field near the sheet. Use epsilon_0 = 8.85e-12 C^2/(N m^2).',
  correctSolution: [
    'Pick a Gaussian pillbox poking through the sheet with end caps of area A on each side. By symmetry the flux is E (2A).',
    'The enclosed charge is sigma A, so E (2A) = sigma A / epsilon_0.',
    'The area cancels: E = sigma / (2 epsilon_0), the same at any distance from the sheet.',
    'Substitute: E = 4.0e-8 / ((2)(8.85e-12)) = 2.26e3 N/C.',
  ],
  finalAnswer: '2.26e3 N/C',
  rubric:
    'Full credit requires E = sigma / (2 epsilon_0) = about 2.26e3 N/C. Catch using sigma / epsilon_0, the conductor result with no factor of 2 (about 4.52e3 N/C), and using Coulomb constant k sigma (about 360 N/C).',
  flaws: [
    {
      misconceptionId: 'sheet-uses-conductor-formula',
      signature: 'Uses sigma / epsilon_0 (the conductor result) and drops the factor of 2, giving about 4.52e3 N/C.',
    },
    {
      misconceptionId: 'sheet-uses-coulomb',
      signature: 'Multiplies sigma by Coulomb constant k instead of dividing by 2 epsilon_0, giving about 360 N/C.',
    },
  ],
};
