import { ProblemKey } from '../types';

// Difficulty band 5. A -7.0 nC charge at the center of a conducting shell pulls
// +7.0 nC onto the inner surface so the field inside the metal is zero. Charge is
// conserved on the shell, so the outer surface carries the net charge minus the
// inner surface: +10 nC - (+7.0 nC) = +3.0 nC. Targets ignoring the inner surface
// and getting the induced sign backward.
export const cciShellSurfaceCharges: ProblemKey = {
  problemId: 'cci-shell-surface-charges',
  statement:
    'A -7.0 nC point charge sits at the center of a hollow metal sphere that carries a net charge of +10 nC. Find the charge on the outer surface of the sphere.',
  correctSolution: [
    'The field inside the metal must be zero, so the inner surface must carry a charge that cancels the enclosed -7.0 nC: the inner surface holds +7.0 nC.',
    'Charge is conserved on the shell: inner surface plus outer surface equals the net +10 nC.',
    'Solve for the outer surface: +10 nC - (+7.0 nC) = +3.0 nC.',
  ],
  finalAnswer: '+3.0 nC',
  rubric:
    'Full credit requires noting the inner surface holds +7.0 nC to cancel the enclosed -7.0 nC, then conserving charge so the outer surface holds +10 nC - 7.0 nC = +3.0 nC. Catch putting the entire +10 nC on the outer surface, and giving the inner surface the same sign as the central charge.',
  flaws: [
    {
      misconceptionId: 'shell-ignores-inner-surface',
      signature:
        'Puts the whole +10 nC net charge on the outer surface, ignoring the +7.0 nC drawn to the inner surface.',
    },
    {
      misconceptionId: 'shell-induction-sign-error',
      signature:
        'Gives the inner surface the same sign as the center (-7.0 nC), so the outer surface comes out as +17 nC.',
    },
  ],
};
