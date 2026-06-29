import { ProblemKey } from '../types';

// Difficulty band 4. Inside a uniformly charged spherical shell, a Gaussian sphere
// encloses no charge, so the field is zero everywhere inside. Targets treating the
// shell as a point charge at the field point's distance, and using the shell radius.
export const gaussShellInside: ProblemKey = {
  problemId: 'gauss-shell-inside',
  statement:
    'A thin spherical shell of radius 0.10 m carries a uniformly distributed charge of +6.0 nC. Find the magnitude of the electric field at a point 0.040 m from the center, inside the shell. Use k = 8.99e9 N m^2/C^2.',
  correctSolution: [
    'Pick a Gaussian sphere of radius 0.040 m, inside the shell. It encloses no charge, since all the charge sits on the shell at 0.10 m.',
    'Gauss: E (4 pi r^2) = Q_enc / epsilon_0 = 0, and by symmetry E is the same everywhere on the surface.',
    'Therefore the field everywhere inside the shell is E = 0 N/C.',
  ],
  finalAnswer: '0 N/C',
  rubric:
    'Full credit requires recognizing the Gaussian sphere inside encloses no charge, so E = 0 everywhere inside the shell. Catch treating the shell as a point charge at r = 0.040 m (about 3.4e4 N/C) and using the shell radius R = 0.10 m (about 5.4e3 N/C).',
  flaws: [
    {
      misconceptionId: 'inside-uses-point',
      signature: 'Treats the shell as a point charge at the field point, using k Q / r^2 (about 3.4e4 N/C) instead of zero.',
    },
    {
      misconceptionId: 'inside-uses-surface',
      signature: 'Uses the shell radius R in k Q / R^2 (about 5.4e3 N/C) instead of recognizing the interior field is zero.',
    },
  ],
};
