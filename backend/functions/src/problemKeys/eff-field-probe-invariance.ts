import { ProblemKey } from '../types';

// Difficulty band 4. The field is a property of the point, not of the probe. The
// 1.0 microcoulomb test charge measures E = F / q = 0.050 / 1.0e-6 = 5.0e4 N/C; the
// field is unchanged when a 3.0 microcoulomb charge replaces it, so
// F = q E = 3.0e-6 (5.0e4) = 0.15 N. Targets scaling the field up with the probe and
// thinking the force is unchanged.
export const effFieldProbeInvariance: ProblemKey = {
  problemId: 'eff-field-probe-invariance',
  statement:
    'A +1.0 microcoulomb test charge placed at a point feels an electric force of 0.050 N. The test charge is removed and a +3.0 microcoulomb charge is placed at the same point. Find the magnitude of the electric force on the +3.0 microcoulomb charge.',
  correctSolution: [
    'Find the field at the point from the first measurement: E = F / q = 0.050 / 1.0e-6 = 5.0e4 N/C.',
    'The field is set by the other charges in the region, not by the probe, so it is the same value when the larger charge is placed there.',
    'Find the new force: F = q E = (3.0e-6)(5.0e4) = 0.15 N. Equivalently, tripling the charge triples the force.',
  ],
  finalAnswer: '0.15 N',
  rubric:
    'Full credit requires finding the field E = F / q from the first charge, recognizing the field does not depend on the probe, and computing F = q E = 0.15 N (three times the original force). Catch scaling the field up with the probe (giving 0.45 N) and catch leaving the force unchanged at 0.050 N.',
  flaws: [
    {
      misconceptionId: 'field-scales-with-probe',
      signature:
        'Assumes the field also triples when the charge triples, multiplying twice to get about 0.45 N instead of 0.15 N.',
    },
    {
      misconceptionId: 'field-probe-force-unchanged',
      signature:
        'Reports the unchanged 0.050 N as the force, treating the force as a property of the point rather than scaling it with the new charge.',
    },
  ],
};
