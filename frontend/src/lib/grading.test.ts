import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  AskInput,
  AskResult,
  ConceptMatch,
  GradeInput,
  GradeResult,
  HintInput,
  HintResult,
  KnownMisconception,
  PlanProblemSetInput,
  PlannedProblemInput,
  PlannedProblemResult,
} from './grading';
import type { ProblemPlan } from '../content/problemSchema';

// The Firebase boundary is mocked ONLY in these tests; product code never mocks
// or falls back. `callable` stands in for the function returned by
// `httpsCallable`, and `httpsCallable` always hands it back.
const callable = vi.fn();
const httpsCallable = vi.fn(() => callable);

// A recognizable stand-in for a configured Functions instance, so we can assert
// it is the exact object handed to `httpsCallable`.
const fakeFunctions = { brand: 'functions' } as const;

/**
 * Re-imports the wrapper with a controlled `functions` export. The wrapper reads
 * the `functions` binding from ./firebase, so each scenario (configured vs not
 * configured) needs a fresh module graph with the matching mock.
 */
async function loadGrading(functions: unknown) {
  vi.resetModules();
  vi.doMock('../lib/firebase', () => ({ functions }));
  vi.doMock('firebase/functions', () => ({ httpsCallable }));
  return import('./grading');
}

const gradeInput: GradeInput = {
  problemId: 'cl-field-point-charge',
  imagePngBase64: 'aGVsbG8=',
  lines: [{ id: 'l1', bbox: { x: 0, y: 0, w: 10, h: 10 } }],
};

const gradeResult: GradeResult = {
  isCorrect: false,
  transcribedSteps: ['E = kq/r'],
  firstErrorLineId: 'l1',
  misconceptionId: 'forgot-square',
  explanation: 'The denominator should be r squared.',
};

const hintInput: HintInput = { ...gradeInput, tier: 1 };
const hintResult: HintResult = { tier: 1, text: 'Recall the Coulomb law.', targetLineId: 'l1' };

const askInput: AskInput = { ...gradeInput, question: 'Which charge is enclosed?' };
const askResult: AskResult = { answer: 'Think about which charge is enclosed.' };

const planInput: PlanProblemSetInput = {
  slots: [
    {
      skillIds: ['coulombs-law'],
      principleIds: ['coulomb-force'],
      difficultyBand: 4,
      kind: 'single',
      requireChain: false,
      targetMisconceptions: [
        { nodeId: 'm-linear-falloff', principleId: 'coulomb-force', wrongBelief: 'like charges attract' },
      ],
    },
  ],
  existingStatements: ['An authored Coulomb problem already in the set.'],
  lessonTitle: "Coulomb's Law",
};

const planResult: ProblemPlan[] = [
  {
    slotIndex: 0,
    title: 'Net force from two point charges',
    description: 'Two point charges on a line; find the net force on a third placed between them.',
  },
];

const plannedInput: PlannedProblemInput = {
  skillIds: ['coulombs-law'],
  principleIds: ['coulomb-force'],
  difficultyBand: 4,
  requireChain: false,
  targetMisconceptions: [
    { nodeId: 'm-linear-falloff', principleId: 'coulomb-force', wrongBelief: 'like charges attract' },
  ],
  description: 'Two point charges on a line; find the net force on a third placed between them.',
  title: 'Net force from two point charges',
};

const plannedResult: PlannedProblemResult = {
  problemId: 'syn:inverse-square-1',
  statement: 'A +2 microcoulomb charge sits at the origin. Find the net force on a third charge.',
  title: 'Net force from two point charges',
  skillIds: ['coulombs-law'],
  principleIds: ['coulomb-force'],
  misconceptionTags: ['linear-falloff'],
  difficultyBand: 4,
  targetMisconceptionNodeIds: ['m-linear-falloff'],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('gradeAttempt', () => {
  it('returns the callable data and targets the gradeAttempt callable', async () => {
    callable.mockResolvedValueOnce({ data: gradeResult });
    const { gradeAttempt } = await loadGrading(fakeFunctions);

    const result = await gradeAttempt(gradeInput);

    expect(httpsCallable).toHaveBeenCalledWith(fakeFunctions, 'gradeAttempt');
    expect(callable).toHaveBeenCalledWith(gradeInput);
    expect(result).toEqual(gradeResult);
  });

  it('propagates callable errors instead of swallowing them', async () => {
    const failure = new Error('functions/internal: grading failed');
    callable.mockRejectedValueOnce(failure);
    const { gradeAttempt } = await loadGrading(fakeFunctions);

    await expect(gradeAttempt(gradeInput)).rejects.toBe(failure);
  });

  it('forwards knownMisconceptions and allowedPrincipleIds to the callable when present', async () => {
    const knownMisconceptions: KnownMisconception[] = [
      {
        id: 'm-linear-falloff',
        principleId: 'inverse-square-law',
        wrongBelief: 'field strength falls off linearly with distance',
      },
    ];
    const enrichedInput: GradeInput = {
      ...gradeInput,
      knownMisconceptions,
      allowedPrincipleIds: ['inverse-square-law', 'superposition'],
    };
    callable.mockResolvedValueOnce({ data: gradeResult });
    const { gradeAttempt } = await loadGrading(fakeFunctions);

    await gradeAttempt(enrichedInput);

    expect(callable).toHaveBeenCalledWith(enrichedInput);
  });

  it('returns the errorType and conceptMatch supplied by the callable', async () => {
    const conceptMatch: ConceptMatch = {
      matchedNodeId: null,
      principleId: 'inverse-square-law',
      wrongBelief: 'field strength falls off linearly with distance',
      specificNote: 'divided by r instead of r squared',
    };
    const conceptResult: GradeResult = {
      isCorrect: false,
      transcribedSteps: ['E = kq/r'],
      firstErrorLineId: 'l1',
      explanation: 'The denominator should be r squared.',
      errorType: 'concept',
      conceptMatch,
    };
    callable.mockResolvedValueOnce({ data: conceptResult });
    const { gradeAttempt } = await loadGrading(fakeFunctions);

    const result = await gradeAttempt(gradeInput);

    expect(result.errorType).toBe('concept');
    expect(result.conceptMatch).toEqual(conceptMatch);
  });
});

describe('getHint', () => {
  it('returns the callable data and targets the getHint callable', async () => {
    callable.mockResolvedValueOnce({ data: hintResult });
    const { getHint } = await loadGrading(fakeFunctions);

    const result = await getHint(hintInput);

    expect(httpsCallable).toHaveBeenCalledWith(fakeFunctions, 'getHint');
    expect(callable).toHaveBeenCalledWith(hintInput);
    expect(result).toEqual(hintResult);
  });

  it('propagates callable errors instead of swallowing them', async () => {
    const failure = new Error('functions/internal: hint failed');
    callable.mockRejectedValueOnce(failure);
    const { getHint } = await loadGrading(fakeFunctions);

    await expect(getHint(hintInput)).rejects.toBe(failure);
  });
});

describe('askQuestion', () => {
  it('returns the callable data and targets the askQuestion callable', async () => {
    callable.mockResolvedValueOnce({ data: askResult });
    const { askQuestion } = await loadGrading(fakeFunctions);

    const result = await askQuestion(askInput);

    expect(httpsCallable).toHaveBeenCalledWith(fakeFunctions, 'askQuestion');
    expect(callable).toHaveBeenCalledWith(askInput);
    expect(result).toEqual(askResult);
  });

  it('propagates callable errors instead of swallowing them', async () => {
    const failure = new Error('functions/internal: ask failed');
    callable.mockRejectedValueOnce(failure);
    const { askQuestion } = await loadGrading(fakeFunctions);

    await expect(askQuestion(askInput)).rejects.toBe(failure);
  });
});

describe('planProblemSet', () => {
  it('unwraps { plans } from the callable and targets the planProblemSet callable', async () => {
    callable.mockResolvedValueOnce({ data: { plans: planResult } });
    const { planProblemSet } = await loadGrading(fakeFunctions);

    const result = await planProblemSet(planInput);

    expect(httpsCallable).toHaveBeenCalledWith(fakeFunctions, 'planProblemSet');
    expect(callable).toHaveBeenCalledWith(planInput);
    // The wrapper returns the bare ProblemPlan[] array, not the { plans } envelope.
    expect(result).toEqual(planResult);
  });

  it('propagates callable errors instead of swallowing them', async () => {
    const failure = new Error('functions/internal: planning failed');
    callable.mockRejectedValueOnce(failure);
    const { planProblemSet } = await loadGrading(fakeFunctions);

    await expect(planProblemSet(planInput)).rejects.toBe(failure);
  });
});

describe('generatePlannedProblem', () => {
  it('returns the callable data and targets the generatePlannedProblem callable', async () => {
    callable.mockResolvedValueOnce({ data: plannedResult });
    const { generatePlannedProblem } = await loadGrading(fakeFunctions);

    const result = await generatePlannedProblem(plannedInput);

    expect(httpsCallable).toHaveBeenCalledWith(fakeFunctions, 'generatePlannedProblem');
    expect(callable).toHaveBeenCalledWith(plannedInput);
    expect(result).toEqual(plannedResult);
  });

  it('propagates callable errors instead of swallowing them', async () => {
    const failure = new Error('functions/internal: generation failed');
    callable.mockRejectedValueOnce(failure);
    const { generatePlannedProblem } = await loadGrading(fakeFunctions);

    await expect(generatePlannedProblem(plannedInput)).rejects.toBe(failure);
  });
});

describe('when Firebase is not configured', () => {
  it('rejects with a clear error and never reaches the callable', async () => {
    const { gradeAttempt, getHint, askQuestion, planProblemSet, generatePlannedProblem } = await loadGrading(null);

    await expect(gradeAttempt(gradeInput)).rejects.toThrow(
      'Grading is unavailable: Firebase is not configured.',
    );
    await expect(getHint(hintInput)).rejects.toThrow(
      'Hints are unavailable: Firebase is not configured.',
    );
    await expect(askQuestion(askInput)).rejects.toThrow(
      'Ask is unavailable: Firebase is not configured.',
    );
    await expect(planProblemSet(planInput)).rejects.toThrow(
      'Problem planning is unavailable: Firebase is not configured.',
    );
    await expect(generatePlannedProblem(plannedInput)).rejects.toThrow(
      'Problem generation is unavailable: Firebase is not configured.',
    );
    expect(httpsCallable).not.toHaveBeenCalled();
  });
});
