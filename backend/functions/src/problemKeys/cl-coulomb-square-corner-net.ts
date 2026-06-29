import { ProblemKey } from '../types';

// Difficulty band 5. Superposition in two dimensions with square symmetry. The
// corner charge feels two equal side forces 0.10 m away (perpendicular to each
// other) and one weaker diagonal force 0.10*sqrt(2) m away. The resultant lies
// along the diagonal: F_net = F_side*sqrt(2) + F_diag = 6.88 N. k = 8.99e9
// N m^2/C^2. Targets adding magnitudes as scalars and the inverse-square error.
export const clCoulombSquareCornerNet: ProblemKey = {
  problemId: 'cl-coulomb-square-corner-net',
  statement:
    'Four point charges of +2.0 microcoulomb each sit at the corners of a square 0.10 m on a side. Find the magnitude of the net electric force on one of the corner charges. Use k = 8.99e9 N m^2/C^2.',
  correctSolution: [
    'Pick the corner charge under study. Its two neighbors are each 0.10 m away along a side, and the fourth charge is across the diagonal, a distance 0.10*sqrt(2) = 0.1414 m away.',
    'Each neighbor exerts F_side = k (2.0e-6)^2 / (0.10)^2 = 3.60 N, directed outward along a side. The two side forces are perpendicular to each other.',
    'The diagonal charge exerts F_diag = k (2.0e-6)^2 / (0.1414)^2 = 1.80 N, directed outward along the diagonal, which bisects the right angle between the two side forces.',
    'Add as vectors. By symmetry the resultant lies along the diagonal: each side force contributes F_side / sqrt(2) along it, so F_net = 2 (F_side / sqrt(2)) + F_diag = F_side*sqrt(2) + F_diag.',
    'Compute: F_net = (3.60)(1.414) + 1.80 = 5.09 + 1.80 = 6.88 N, directed outward along the diagonal away from the center of the square.',
  ],
  finalAnswer: '6.88 N',
  rubric:
    'Full credit requires each pairwise Coulomb force with the correct distance (0.10 m for the two sides, 0.10*sqrt(2) m for the diagonal), recognizing the two side forces are perpendicular while the diagonal force bisects them, and vector-adding to a net near 6.88 N along the diagonal. Catch adding the three magnitudes as scalars and dividing by r instead of r squared.',
  flaws: [
    {
      misconceptionId: 'superposition-magnitude-add',
      signature:
        'Adds the three force magnitudes as scalars (3.60 + 3.60 + 1.80 = about 8.99 N) instead of adding them as vectors.',
    },
    {
      misconceptionId: 'inverse-square-error',
      signature: 'Divides each force by r instead of r squared, getting a net of about 0.76 N.',
    },
  ],
};
