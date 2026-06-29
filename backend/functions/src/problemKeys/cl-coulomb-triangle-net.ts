import { ProblemKey } from '../types';

// Difficulty band 5. Superposition with 60 degree geometry. The vertex charge is
// pushed by the two others, each 0.20 m away, with the two forces 60 degrees
// apart. By symmetry the resultant is along the axis through the vertex, each
// force projecting as F cos(30 degrees), so F_net = sqrt(3) F = 9.73 N. k = 8.99e9
// N m^2/C^2. Targets adding magnitudes as scalars and the cos(60) vs cos(30) error.
export const clCoulombTriangleNet: ProblemKey = {
  problemId: 'cl-coulomb-triangle-net',
  statement:
    'Three point charges of +5.0 microcoulomb each sit at the vertices of an equilateral triangle 0.20 m on a side. Find the magnitude of the net electric force on one of the charges. Use k = 8.99e9 N m^2/C^2.',
  correctSolution: [
    'The charge under study is pushed by the other two, each 0.20 m away, so each force has magnitude F = k (5.0e-6)^2 / (0.20)^2 = 5.62 N.',
    'The two forces point away from the two base charges, along the two sides that meet at the vertex, so the angle between them is 60 degrees.',
    'By symmetry the resultant lies along the axis through the vertex, and each force contributes F cos(30 degrees) along that axis.',
    'Add the components: F_net = 2 F cos(30 degrees) = sqrt(3) F = (1.732)(5.62 N) = 9.73 N, directed away from the center of the triangle.',
  ],
  finalAnswer: '9.73 N',
  rubric:
    'Full credit requires each pairwise Coulomb force k q^2 / r^2 at r = 0.20 m, recognizing the two forces are 60 degrees apart, and adding their components along the symmetry axis (each F cos 30 degrees) to a net of sqrt(3) F, about 9.73 N. Catch adding the magnitudes as scalars and using the 60 degree angle in place of the 30 degree angle from the axis.',
  flaws: [
    {
      misconceptionId: 'superposition-magnitude-add',
      signature:
        'Adds the two force magnitudes as scalars (2 F = about 11.2 N) instead of adding them as vectors 60 degrees apart.',
    },
    {
      misconceptionId: 'superposition-direction-error',
      signature:
        'Uses the 60 degree angle between the forces as the angle from the axis, taking F cos 60 degrees each for a net of about 5.62 N.',
    },
  ],
};
