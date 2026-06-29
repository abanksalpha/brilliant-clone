import { ProblemKey } from '../types';

// Difficulty band 4. Field on the axis of a uniformly charged ring: only the axial
// component survives, E = k Q x / (x^2 + R^2)^(3/2). With Q = 5.0e-9 C, R = 0.10 m,
// x = 0.15 m, E = 1.15e3 N/C. k = 8.99e9. Targets treating the ring as a point
// charge at distance x, and summing the field magnitudes without projecting onto
// the axis.
export const efcdRingAxis: ProblemKey = {
  problemId: 'efcd-ring-axis',
  statement:
    "A ring of radius 0.10 m carries a uniformly distributed charge of +5.0 nC. Find the magnitude of the electric field at a point on the ring's axis, 0.15 m from its center. Use k = 8.99e9 N m^2/C^2.",
  correctSolution: [
    'On the axis, every piece has a partner across the ring whose sideways field cancels, so only the component along the axis survives.',
    'Each piece is the same distance sqrt(x^2 + R^2) from the point and the axial fraction is x / sqrt(x^2 + R^2), so summing dq over the ring gives E = k Q x / (x^2 + R^2)^(3/2).',
    'List the givens: Q = 5.0e-9 C, R = 0.10 m, x = 0.15 m, so x^2 + R^2 = 0.0325 m^2.',
    'Substitute: E = (8.99e9)(5.0e-9)(0.15) / (0.0325)^(3/2), which gives E = 1.15e3 N/C along the axis.',
  ],
  finalAnswer: '1.15e3 N/C',
  rubric:
    'Full credit requires using E = k Q x / (x^2 + R^2)^(3/2) with the axial projection, giving about 1.15e3 N/C. Catch treating the ring as a point charge at distance x (k Q / x^2, about 2.0e3 N/C) and summing the piece magnitudes without the axial projection (k Q / (x^2 + R^2), about 1.38e3 N/C).',
  flaws: [
    {
      misconceptionId: 'distribution-as-point',
      signature:
        'Treats the whole ring as a point charge at distance x, using k Q / x^2 (about 2.0e3 N/C) and ignoring the ring geometry.',
    },
    {
      misconceptionId: 'forgot-component-projection',
      signature:
        'Sums the field magnitude k Q / (x^2 + R^2) from each piece without projecting onto the axis (about 1.38e3 N/C).',
    },
  ],
};
