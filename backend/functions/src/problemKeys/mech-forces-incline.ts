import { ProblemKey } from '../types';

// Mechanics prerequisite (forces), difficulty band 4. On a frictionless incline
// the net force along the surface is the gravity component m g sin(theta).
// m = 2.0 kg, theta = 30 degrees, g = 9.8 m/s^2, so F = 9.8 N. Targets using the
// cosine component instead of the sine.
export const mechForcesIncline: ProblemKey = {
  problemId: 'mech-forces-incline',
  statement:
    'A 2.0 kg block is released from rest on a frictionless ramp inclined at 30 degrees above the horizontal. Find the magnitude of the net force on the block along the ramp. Use g = 9.8 m/s^2.',
  correctSolution: [
    'On a frictionless ramp the only force along the surface is the component of gravity, so the net force along the ramp is m g sin(theta).',
    'Substitute: F = (2.0 kg)(9.8 m/s^2) sin(30 degrees).',
    'Compute: sin(30 degrees) = 0.5, so F = 2.0 (9.8)(0.5) = 9.8 N directed down the ramp.',
  ],
  finalAnswer: '9.8 N',
  rubric:
    'Full credit requires resolving gravity along the incline as m g sin(theta) and computing 9.8 N. The single error to catch is using cos(theta) in place of sin(theta).',
  flaws: [
    {
      misconceptionId: 'incline-component-error',
      signature: 'Uses m g cos(theta) instead of m g sin(theta), getting about 17 N.',
    },
  ],
};
