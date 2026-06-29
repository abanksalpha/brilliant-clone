import { ProblemKey } from '../types';

// Difficulty band 4. Charge on a conductor sits on the surface, and just outside
// the field is that of a point charge at the center: E = k Q / R^2. With
// Q = 8.0e-9 C and R = 0.050 m, E = 2.88e4 N/C. k = 8.99e9. Targets the
// inverse-square error and using the diameter in place of the radius.
export const cciFieldOutsideSphere: ProblemKey = {
  problemId: 'cci-field-outside-sphere',
  statement:
    "A solid metal sphere of radius 0.050 m carries a charge of +8.0 nC. Find the magnitude of the electric field just outside the sphere's surface. Use k = 8.99e9 N m^2/C^2.",
  correctSolution: [
    'The excess charge spreads over the surface, so just outside the sphere the field equals that of a point charge Q at the center: E = k Q / R^2.',
    'List the givens: Q = 8.0e-9 C and R = 0.050 m.',
    'Square the radius: R^2 = (0.050 m)^2 = 2.5e-3 m^2.',
    'Substitute and compute: E = (8.99e9)(8.0e-9) / 2.5e-3 = 2.88e4 N/C, directed radially outward.',
  ],
  finalAnswer: '2.88e4 N/C',
  rubric:
    'Full credit requires E = k Q / R^2 with the radius squared, giving about 2.88e4 N/C just outside the surface. Catch dividing by R instead of R squared, and using the diameter 0.10 m in place of the radius.',
  flaws: [
    {
      misconceptionId: 'inverse-square-error',
      signature:
        'Divides by R instead of R squared, giving about 1.44e3 N/C.',
    },
    {
      misconceptionId: 'radius-diameter-confusion',
      signature:
        'Uses the diameter 0.10 m in place of the radius 0.050 m, giving about 7.19e3 N/C.',
    },
  ],
};
