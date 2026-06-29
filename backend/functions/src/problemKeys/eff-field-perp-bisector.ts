import { ProblemKey } from '../types';

// Difficulty band 5. Two equal +4.0 microcoulomb charges on the x axis, net field
// at a point on the perpendicular bisector. Each source is r = sqrt(0.20^2 + 0.20^2)
// = 0.283 m away, r^2 = 0.080 m^2. The x components cancel by symmetry; the y
// components add. k = 8.99e9, each field 4.50e5 N/C, y fraction 0.20/0.283 = 0.707,
// E_net = 6.36e5 N/C straight up. Targets adding magnitudes as scalars and the
// inverse-square error.
export const effFieldPerpBisector: ProblemKey = {
  problemId: 'eff-field-perp-bisector',
  statement:
    'Two +4.0 microcoulomb charges sit on the x axis at (-0.20 m, 0) and (+0.20 m, 0). Find the magnitude of the net electric field at the point (0, 0.20 m). Use k = 8.99e9 N m^2/C^2.',
  correctSolution: [
    'Each source charge is the same distance from the field point: r = sqrt((0.20)^2 + (0.20)^2) = 0.283 m, so r^2 = 0.080 m^2.',
    'Each field magnitude: E = (8.99e9)(4.0e-6) / 0.080 = 4.50e5 N/C, pointing away from its source charge.',
    'Resolve into components. The two charges sit symmetric left and right of the point, so the x components are equal and opposite and cancel, while the y components both point in the +y direction.',
    'Each y component is E times (0.20 / 0.283) = 4.50e5 (0.707) = 3.18e5 N/C.',
    'Net field: E_net = 2 (3.18e5) = 6.36e5 N/C, directed straight up.',
  ],
  finalAnswer: '6.36e5 N/C',
  rubric:
    'Full credit requires the equal distances r = 0.283 m, each field k Q / r^2, resolving into components, cancelling the x components by symmetry, and adding the y components to a net near 6.36e5 N/C. Catch adding the magnitudes as scalars and dividing by r instead of r squared.',
  flaws: [
    {
      misconceptionId: 'superposition-magnitude-add',
      signature:
        'Adds the two field magnitudes as scalars (about 8.99e5 N/C) instead of adding them as vectors and letting the x components cancel.',
    },
    {
      misconceptionId: 'inverse-square-error',
      signature: 'Divides each field by r instead of r squared, giving a net near 1.80e5 N/C.',
    },
  ],
};
