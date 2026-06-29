import { ProblemKey } from '../types';

// Difficulty band 5. Field at the center of a uniformly charged quarter-circle arc.
// The two components each equal k lambda / R, so the magnitude is sqrt(2) k lambda / R
// with lambda = Q / ((pi/2) R) = 2 Q / (pi R). With Q = 4.0e-9 C, R = 0.040 m,
// lambda = 6.37e-8 C/m and E = 2.02e4 N/C. k = 8.99e9. Targets reporting only one
// component (forgetting the sqrt(2)), and treating the arc as a point charge.
export const efcdQuarterArcCenter: ProblemKey = {
  problemId: 'efcd-quarter-arc-center',
  statement:
    'A quarter-circle arc of radius 0.040 m carries a uniformly distributed charge of +4.0 nC. Find the magnitude of the electric field at the center of the arc. Use k = 8.99e9 N m^2/C^2.',
  correctSolution: [
    'With dq = lambda R d theta a distance R away, each component integrates over 0 to pi/2: E_x = integral of (k lambda / R) cos(theta) d theta = k lambda / R, and E_y = integral of (k lambda / R) sin(theta) d theta = k lambda / R.',
    'The two equal components give a magnitude E = sqrt(2) k lambda / R at 45 degrees.',
    'Find lambda for a quarter circle, where the arc subtends pi/2: lambda = 2 Q / (pi R) = 6.37e-8 C/m.',
    'Compute one component: k lambda / R = (8.99e9)(6.37e-8) / 0.040 = 1.43e4 N/C.',
    'Combine: E = sqrt(2)(1.43e4) = 2.02e4 N/C, directed at 45 degrees between the two ends.',
  ],
  finalAnswer: '2.02e4 N/C',
  rubric:
    'Full credit requires both equal components k lambda / R combined to E = sqrt(2) k lambda / R, about 2.02e4 N/C, with lambda = 2 Q / (pi R). Catch reporting only one component k lambda / R (about 1.43e4 N/C) and treating the arc as a point charge at distance R (k Q / R^2, about 2.25e4 N/C).',
  flaws: [
    {
      misconceptionId: 'quarter-arc-omits-component',
      signature:
        'Reports only one component k lambda / R and forgets to combine the two with sqrt(2), giving about 1.43e4 N/C.',
    },
    {
      misconceptionId: 'distribution-as-point',
      signature:
        'Treats the arc as a point charge at distance R, using k Q / R^2 (about 2.25e4 N/C).',
    },
  ],
};
