import { ProblemKey } from '../types';

// Difficulty band 5. Gauss's law: the net flux through any closed surface is the
// enclosed charge over epsilon_0, Phi = q / epsilon_0, independent of shape.
// With q = 5.0e-9 C and epsilon_0 = 8.85e-12, Phi = 565 N m^2/C. Targets using
// Coulomb's constant (k q) and dividing by twice epsilon_0.
export const fluxPointChargeEnclosed: ProblemKey = {
  problemId: 'flux-point-charge-enclosed',
  statement:
    'A +5.0 nC point charge sits inside a closed surface. Find the net electric flux through the surface. Use epsilon_0 = 8.85e-12 C^2/(N m^2).',
  correctSolution: [
    "By Gauss's law the net flux through a closed surface is the enclosed charge divided by epsilon_0, Phi = q / epsilon_0, whatever the surface shape.",
    'List the givens: q = 5.0e-9 C and epsilon_0 = 8.85e-12 C^2/(N m^2).',
    'Substitute: Phi = 5.0e-9 / 8.85e-12 = 565 N m^2/C.',
  ],
  finalAnswer: '565 N m^2/C',
  rubric:
    'Full credit requires Phi = q / epsilon_0 = 5.0e-9 / 8.85e-12 = about 565 N m^2/C. Catch using Coulomb constant k q (about 45 N m^2/C) and dividing by 2 epsilon_0 (about 282 N m^2/C).',
  flaws: [
    {
      misconceptionId: 'flux-uses-coulomb-constant',
      signature: 'Computes k q instead of q / epsilon_0, giving about 45 N m^2/C.',
    },
    {
      misconceptionId: 'flux-half-surface',
      signature: 'Divides by 2 epsilon_0 (as if only half the surface counts), giving about 282 N m^2/C.',
    },
  ],
};
