import { ProblemKey } from '../types';

// Difficulty band 4. Field of a single point charge, E = k Q / r^2, with the
// charge in nanocoulombs and the distance in centimeters so the unit conversion is
// part of the work. k = 8.99e9 N m^2/C^2, Q = 30e-9 C, r = 0.050 m, E = 1.08e5 N/C.
// Targets the inverse-square error (dividing by r, not r^2).
export const effFieldPointChargeNc: ProblemKey = {
  problemId: 'eff-field-point-charge-nc',
  statement:
    'A +30 nanocoulomb point charge sits alone in space. Find the magnitude of the electric field it produces at a point 5.0 cm away. Use k = 8.99e9 N m^2/C^2.',
  correctSolution: [
    'Identify the relation: a single point charge sets up a field of magnitude E = k Q / r^2.',
    'Convert to base units: Q = 30 nanocoulomb = 30e-9 C and r = 5.0 cm = 0.050 m.',
    'Square the distance: r^2 = (0.050 m)^2 = 2.5e-3 m^2.',
    'Substitute and compute: E = (8.99e9)(30e-9) / 2.5e-3 = 1.08e5 N/C, pointing away from the positive charge.',
  ],
  finalAnswer: '1.08e5 N/C',
  rubric:
    'Full credit requires the point-charge field E = k Q / r^2 with the distance converted to meters and squared in the denominator, correct substitution, and a magnitude near 1.08e5 N/C directed away from the positive charge. The single error to catch is dividing by r instead of r squared.',
  flaws: [
    {
      misconceptionId: 'inverse-square-error',
      signature:
        'Uses E = k Q / r with the linear distance in the denominator (which gives about 5.39e3 N/C) instead of dividing by r squared.',
    },
  ],
};
