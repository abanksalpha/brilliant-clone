import { ProblemKey } from '../types';

// Difficulty band 5. Only enclosed charge contributes to the net flux: q_enc =
// +12 nC + (-2.0 nC) = +10 nC, and the +6.0 nC outside contributes nothing. Phi =
// q_enc / epsilon_0 = 10e-9 / 8.85e-12 = 1.13e3 N m^2/C. Targets including the
// external charge and using Coulomb's constant.
export const fluxNetEnclosedCharges: ProblemKey = {
  problemId: 'flux-net-enclosed-charges',
  statement:
    'A closed surface encloses a +12 nC charge and a -2.0 nC charge, while a +6.0 nC charge sits just outside it. Find the net electric flux through the surface. Use epsilon_0 = 8.85e-12 C^2/(N m^2).',
  correctSolution: [
    "By Gauss's law only the enclosed charge matters: charge outside contributes equal flux in and out, netting zero.",
    'Add the enclosed charges with their signs: q_enc = +12 nC + (-2.0 nC) = +10 nC. The +6.0 nC outside is not counted.',
    'Apply Gauss: Phi = q_enc / epsilon_0 = 10e-9 / 8.85e-12 = 1.13e3 N m^2/C.',
  ],
  finalAnswer: '1.13e3 N m^2/C',
  rubric:
    'Full credit requires using only the enclosed charge q_enc = +10 nC and Phi = q_enc / epsilon_0 = about 1.13e3 N m^2/C. Catch including the external +6.0 nC (q = 16 nC, about 1.81e3 N m^2/C) and using Coulomb constant k q_enc (about 90 N m^2/C).',
  flaws: [
    {
      misconceptionId: 'flux-includes-external',
      signature: 'Adds the external +6.0 nC to the enclosed charge (16 nC total), giving about 1.81e3 N m^2/C.',
    },
    {
      misconceptionId: 'flux-uses-coulomb-constant',
      signature: 'Computes k q_enc instead of q_enc / epsilon_0, giving about 90 N m^2/C.',
    },
  ],
};
