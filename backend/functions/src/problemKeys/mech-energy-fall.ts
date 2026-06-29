import { ProblemKey } from '../types';

// Mechanics prerequisite (energy), difficulty band 4. Energy conservation: m g h
// becomes (1/2) m v^2, the mass cancels, so v = sqrt(2 g h). h = 1.2 m,
// g = 9.8 m/s^2, v = 4.85 m/s. Targets forgetting the square root and dropping the
// factor of 2.
export const mechEnergyFall: ProblemKey = {
  problemId: 'mech-energy-fall',
  statement:
    'A 0.50 kg ball is released from rest at a height of 1.2 m above the ground. Ignoring air resistance, find its speed just before it reaches the ground. Use g = 9.8 m/s^2.',
  correctSolution: [
    'Energy conservation: the gravitational potential energy m g h converts to kinetic energy (1/2) m v^2, and the mass cancels.',
    'Solve for speed: v = sqrt(2 g h).',
    'Substitute and compute: v = sqrt(2 (9.8)(1.2)) = sqrt(23.5) = 4.85 m/s.',
  ],
  finalAnswer: '4.85 m/s',
  rubric:
    'Full credit requires equating m g h with (1/2) m v^2, cancelling the mass, and solving v = sqrt(2 g h) = 4.85 m/s. Catch forgetting the square root and dropping the factor of 2.',
  flaws: [
    {
      misconceptionId: 'energy-omits-sqrt',
      signature:
        'Reports 2 g h = 23.5 without taking the square root, treating an energy-like quantity as a speed.',
    },
    {
      misconceptionId: 'energy-factor-error',
      signature: 'Uses v = sqrt(g h) and drops the factor of 2, getting about 3.43 m/s.',
    },
  ],
};
