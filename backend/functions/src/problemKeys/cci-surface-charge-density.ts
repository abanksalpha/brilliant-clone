import { ProblemKey } from '../types';

// Difficulty band 5. Excess charge on a conductor rides the outer surface, so the
// surface charge density is the charge over the surface area: sigma = Q / (4 pi
// R^2). With Q = 6.0e-9 C and R = 0.10 m, sigma = 4.77e-8 C/m^2. Targets skipping
// the 4 pi factor and dividing by the volume instead of the area.
export const cciSurfaceChargeDensity: ProblemKey = {
  problemId: 'cci-surface-charge-density',
  statement:
    "A solid metal sphere of radius 0.10 m carries +6.0 nC spread over its surface. Find the surface charge density on the sphere. Use the sphere's surface area 4 pi r^2.",
  correctSolution: [
    'The excess charge rides the surface, so the surface charge density is the charge divided by the surface area: sigma = Q / (4 pi R^2).',
    'Compute the surface area: 4 pi R^2 = 4 pi (0.10 m)^2 = 0.1257 m^2.',
    'List the charge: Q = 6.0e-9 C.',
    'Substitute and compute: sigma = (6.0e-9) / 0.1257 = 4.77e-8 C/m^2.',
  ],
  finalAnswer: '4.77e-8 C/m^2',
  rubric:
    'Full credit requires sigma = Q / (4 pi R^2) using the full spherical surface area, giving about 4.77e-8 C/m^2. Catch dividing by R^2 alone without the 4 pi, and dividing by the volume (4/3) pi R^3 instead of the surface area.',
  flaws: [
    {
      misconceptionId: 'density-omits-4pi',
      signature:
        'Divides by R^2 alone and skips the factor of 4 pi, giving about 6.0e-7 C/m^2.',
    },
    {
      misconceptionId: 'density-uses-volume',
      signature:
        'Divides by the volume (4/3) pi R^3 instead of the surface area, giving about 1.43e-6 C/m^3.',
    },
  ],
};
