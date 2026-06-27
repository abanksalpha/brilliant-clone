import { ProblemKey } from '../types';

// Difficulty 3. Two equal positive charges, net field at the midpoint cancels by symmetry.
// k = 8.99e9 N m^2/C^2, q = 4.0e-6 C each, each 0.30 m from the midpoint.
export const clTwoChargeSuperposition: ProblemKey = {
  problemId: 'cl-two-charge-superposition',
  statement:
    'Two +4.0 microcoulomb charges sit 0.60 m apart. Find the magnitude of the net electric field at the midpoint between them. Use k = 8.99e9 N m^2/C^2.',
  correctSolution: [
    'Set up the geometry: the two equal positive charges are symmetric about the midpoint, each a distance r = 0.30 m away.',
    'Each charge produces a field of magnitude k q / r^2 at the midpoint, but the two field vectors point in opposite directions (each points away from its own source charge).',
    'Because the charges are equal and equidistant, the two vectors have equal magnitude and opposite direction, so they cancel.',
    'Net field at the midpoint: E_net = 0 N/C.',
  ],
  finalAnswer: '0 N/C',
  rubric:
    'Full credit requires recognizing that the electric field is a vector and that the two equal, opposite vectors cancel by symmetry, giving a net magnitude of 0 N/C. Treat any nonzero magnitude, especially adding the two magnitudes as scalars, as the superposition error.',
  flaws: [
    {
      misconceptionId: 'superposition-magnitude-add',
      signature:
        'Adds the two field magnitudes as scalars (2 k q / r^2, about 8.0e5 N/C) instead of vector summing the two opposite vectors to zero.',
    },
  ],
};
