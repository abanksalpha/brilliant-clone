import { ProblemKey } from '../types';

// Difficulty band 5. Between two oppositely charged sheets the two fields add, giving
// E = sigma / epsilon_0. With sigma = 3.0e-8 C/m^2, E = 3.39e3 N/C. Targets using the
// single-sheet field sigma / (2 epsilon_0) and double-counting to 2 sigma / epsilon_0.
export const gaussTwoSheets: ProblemKey = {
  problemId: 'gauss-two-sheets',
  statement:
    'Two large parallel sheets carry equal and opposite uniform surface charge densities of magnitude 3.0e-8 C/m^2. Find the magnitude of the electric field in the region between them. Use epsilon_0 = 8.85e-12 C^2/(N m^2).',
  correctSolution: [
    'Each sheet alone makes a field sigma / (2 epsilon_0). Between the sheets the two fields point the same way and add.',
    'Add them: E = sigma / (2 epsilon_0) + sigma / (2 epsilon_0) = sigma / epsilon_0.',
    'Substitute: E = 3.0e-8 / 8.85e-12 = 3.39e3 N/C. (Outside the pair the fields cancel.)',
  ],
  finalAnswer: '3.39e3 N/C',
  rubric:
    'Full credit requires adding the two sheet fields to E = sigma / epsilon_0 = about 3.39e3 N/C. Catch using a single sheet sigma / (2 epsilon_0) (about 1.69e3 N/C) and double-counting to 2 sigma / epsilon_0 (about 6.78e3 N/C).',
  flaws: [
    {
      misconceptionId: 'between-uses-single-sheet',
      signature: 'Uses only one sheet, sigma / (2 epsilon_0), giving about 1.69e3 N/C.',
    },
    {
      misconceptionId: 'between-double-counts',
      signature: 'Counts each sheet as sigma / epsilon_0 and adds to 2 sigma / epsilon_0, giving about 6.78e3 N/C.',
    },
  ],
};
