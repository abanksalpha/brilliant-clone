import { ProblemKey } from '../types';

// Difficulty band 4. Choosing the right relation: the field is given, so the force
// is F = q E, not Coulomb law (there is no second charge or distance). The
// Coulomb constant is a distractor. q = 5.0e-6 C, E = 6.0e4 N/C, F = 0.30 N.
// Targets conflating the field with the force.
export const clFieldAndForce: ProblemKey = {
  problemId: 'cl-field-and-force',
  statement:
    'At a point in space, other charges set up a uniform electric field of magnitude 6.0e4 N/C. A +5.0 microcoulomb point charge is placed at that point. Find the magnitude of the electric force on it. Use k = 8.99e9 N m^2/C^2.',
  correctSolution: [
    'The field at the point is already given, so the right relation is F = q E, not Coulomb law (there is no second charge or distance to use).',
    'Substitute the magnitudes: F = (5.0e-6 C)(6.0e4 N/C).',
    'Compute: F = 0.30 N. The Coulomb constant k is not needed here.',
  ],
  finalAnswer: '0.30 N',
  rubric:
    'Full credit requires choosing F = q E because the field is given, and computing F = 0.30 N. The Coulomb constant is a distractor that does not enter. Catch reporting the field magnitude as the force, which skips multiplying by the charge.',
  flaws: [
    {
      misconceptionId: 'field-force-conflation',
      signature:
        'Reports the field magnitude 6.0e4 N as the force, forgetting that the force is the charge times the field.',
    },
  ],
};
