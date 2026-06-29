import { ProblemKey } from '../types';

// Difficulty band 5, synthesis (field and Coulomb skills). Find the source field
// E = k Q / r^2 from the +6.0 microcoulomb charge at 0.30 m, then the force on the
// placed charge from F = |q| E. k = 8.99e9, E = 5.99e5 N/C, F = 1.20 N (attractive,
// toward the source). Targets dividing by r instead of r^2 and reporting the field
// as the force.
export const effFieldThenForce: ProblemKey = {
  problemId: 'eff-field-then-force',
  statement:
    'A +6.0 microcoulomb charge is fixed at the origin. A -2.0 microcoulomb point charge is placed 0.30 m away. Find the magnitude of the electric force on the -2.0 microcoulomb charge by first finding the field of the source charge. Use k = 8.99e9 N m^2/C^2.',
  correctSolution: [
    'Find the field of the source charge at the placed charge: E = k Q / r^2 = (8.99e9)(6.0e-6) / (0.30)^2 = 5.99e5 N/C.',
    'The force on the placed charge is F = |q| E, using the magnitude of its charge.',
    'Substitute: F = (2.0e-6)(5.99e5) = 1.20 N. The force is attractive, pointing from the negative charge toward the positive source.',
  ],
  finalAnswer: '1.20 N',
  rubric:
    'Full credit requires the source field E = k Q / r^2 with r squared, then F = |q| E, giving a force near 1.20 N directed toward the source. Catch dividing the field by r instead of r squared, and catch reporting the field magnitude as the force without multiplying by the charge.',
  flaws: [
    {
      misconceptionId: 'inverse-square-error',
      signature: 'Computes the field with k Q / r instead of k Q / r squared, giving a force of about 0.36 N.',
    },
    {
      misconceptionId: 'field-force-conflation',
      signature:
        'Reports the field magnitude (about 5.99e5) as the force, forgetting to multiply by the placed charge.',
    },
  ],
};
