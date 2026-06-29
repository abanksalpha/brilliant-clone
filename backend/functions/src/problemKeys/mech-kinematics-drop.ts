import { ProblemKey } from '../types';

// Mechanics prerequisite (kinematics), difficulty band 4. Free fall from rest:
// d = (1/2) g t^2. t = 3.0 s, g = 9.8 m/s^2, d = 44.1 m. Targets dropping the
// factor of one half and failing to square the time.
export const mechKinematicsDrop: ProblemKey = {
  problemId: 'mech-kinematics-drop',
  statement:
    'A stone is dropped from rest and falls freely for 3.0 s. Ignoring air resistance, find the distance it falls. Use g = 9.8 m/s^2.',
  correctSolution: [
    'For a drop from rest the distance is d = (1/2) g t^2, since the initial speed is zero.',
    'Substitute: d = (1/2)(9.8 m/s^2)(3.0 s)^2.',
    'Compute: d = 0.5 (9.8)(9.0) = 44.1 m.',
  ],
  finalAnswer: '44.1 m',
  rubric:
    'Full credit requires d = (1/2) g t^2 with the time squared, giving 44.1 m. Catch dropping the factor of one half and failing to square the time.',
  flaws: [
    {
      misconceptionId: 'kinematics-omits-half',
      signature: 'Drops the factor of one half and uses d = g t^2, getting 88.2 m.',
    },
    {
      misconceptionId: 'kinematics-linear-time',
      signature: 'Fails to square the time and uses d = (1/2) g t, getting 14.7 m.',
    },
  ],
};
