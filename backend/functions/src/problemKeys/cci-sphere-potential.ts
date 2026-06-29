import { ProblemKey } from '../types';

// Difficulty band 4. A charged conductor is an equipotential, and at and outside
// its surface it acts like a point charge, so the surface potential is
// V = k Q / R. With Q = 4.0e-9 C and R = 0.20 m, V = 1.80e2 V. k = 8.99e9.
// Targets using the field formula k Q / R^2 and using the diameter for the radius.
export const cciSpherePotential: ProblemKey = {
  problemId: 'cci-sphere-potential',
  statement:
    "A solid metal sphere of radius 0.20 m carries +4.0 nC. Taking the potential to be zero infinitely far away, find the electric potential at the sphere's surface. Use k = 8.99e9 N m^2/C^2.",
  correctSolution: [
    'A charged conductor is an equipotential, and at its surface it acts like a point charge at the center, so V = k Q / R (note the first power of R for potential).',
    'List the givens: Q = 4.0e-9 C and R = 0.20 m.',
    'Substitute and compute: V = (8.99e9)(4.0e-9) / 0.20 = 1.80e2 V.',
  ],
  finalAnswer: '1.80e2 V',
  rubric:
    'Full credit requires V = k Q / R with the first power of the radius, giving about 1.80e2 V. Catch using k Q / R^2 (which is the field, not the potential) and using the diameter 0.40 m in place of the radius.',
  flaws: [
    {
      misconceptionId: 'potential-uses-r-squared',
      signature:
        'Uses k Q / R^2 (the field formula) instead of k Q / R for the potential, giving about 8.99e2 V.',
    },
    {
      misconceptionId: 'radius-diameter-confusion',
      signature:
        'Uses the diameter 0.40 m in place of the radius 0.20 m, giving about 8.99e1 V.',
    },
  ],
};
