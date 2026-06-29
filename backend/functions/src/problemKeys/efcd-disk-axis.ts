import { ProblemKey } from '../types';

// Difficulty band 5. Field on the axis of a uniformly charged disk:
// E = 2 pi k sigma (1 - x / sqrt(x^2 + R^2)). With sigma = 2.0e-7 C/m^2, R = 0.10 m,
// x = 0.050 m, E = 6.24e3 N/C. k = 8.99e9. Targets using the infinite-sheet value
// 2 pi k sigma without the geometry factor, and treating the disk as a point charge
// Q = sigma pi R^2 at distance x.
export const efcdDiskAxis: ProblemKey = {
  problemId: 'efcd-disk-axis',
  statement:
    "A disk of radius 0.10 m carries a uniform surface charge density of 2.0e-7 C/m^2. Find the magnitude of the electric field on the disk's axis, 0.050 m from its center. Use k = 8.99e9 N m^2/C^2.",
  correctSolution: [
    'Add up thin rings: each contributes only its axial component, and integrating over the disk gives E = 2 pi k sigma (1 - x / sqrt(x^2 + R^2)).',
    'List the givens: sigma = 2.0e-7 C/m^2, R = 0.10 m, x = 0.050 m. The axial ratio is x / sqrt(x^2 + R^2), which here is 0.050 / sqrt(0.0125) = 0.447.',
    'The leading factor is 2 pi k sigma = 2 pi (8.99e9)(2.0e-7) = 1.13e4 N/C.',
    'Substitute: E = (1.13e4)(1 - 0.447) = 6.24e3 N/C, along the axis.',
  ],
  finalAnswer: '6.24e3 N/C',
  rubric:
    'Full credit requires E = 2 pi k sigma (1 - x / sqrt(x^2 + R^2)), giving about 6.24e3 N/C. Catch using the infinite-sheet value 2 pi k sigma without the geometry factor (about 1.13e4 N/C) and treating the disk as a point charge Q = sigma pi R^2 at distance x (about 2.26e4 N/C).',
  flaws: [
    {
      misconceptionId: 'disk-as-infinite-sheet',
      signature:
        'Uses the infinite-sheet field 2 pi k sigma and omits the (1 - x / sqrt(x^2 + R^2)) factor, giving about 1.13e4 N/C.',
    },
    {
      misconceptionId: 'distribution-as-point',
      signature:
        'Treats the disk as a point charge Q = sigma pi R^2 at distance x, using k Q / x^2 (about 2.26e4 N/C).',
    },
  ],
};
