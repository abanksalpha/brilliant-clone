import { ProblemKey } from '../types';

// Difficulty band 4. The defining relation E = F / q: the field is the force per
// unit positive charge, read off a test charge. F = 0.18 N, q = 2.0e-6 C,
// E = 9.0e4 N/C. No Coulomb constant is needed. Targets reporting the force as the
// field and inverting the defining ratio.
export const effFieldFromForce: ProblemKey = {
  problemId: 'eff-field-from-force',
  statement:
    'A +2.0 microcoulomb test charge placed at a point feels an electric force of 0.18 N. Find the magnitude of the electric field at that point.',
  correctSolution: [
    'The field is the force per unit positive charge, so the relation is E = F / q.',
    'List the givens: F = 0.18 N and q = 2.0e-6 C.',
    'Substitute and compute: E = 0.18 / 2.0e-6 = 9.0e4 N/C.',
  ],
  finalAnswer: '9.0e4 N/C',
  rubric:
    'Full credit requires using E = F / q with the measured force divided by the test charge, giving a field near 9.0e4 N/C. Catch reporting the force 0.18 N as the field, and catch multiplying F by q instead of dividing.',
  flaws: [
    {
      misconceptionId: 'field-force-conflation',
      signature:
        'Reports the force 0.18 N as the field, treating force and field as the same quantity instead of dividing by the charge.',
    },
    {
      misconceptionId: 'field-defining-ratio-inverted',
      signature:
        'Multiplies F by q instead of dividing, getting about 3.6e-7 instead of E = F / q = 9.0e4 N/C.',
    },
  ],
};
