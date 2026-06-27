import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';

// These types mirror the Wave 1 Firebase Functions v2 contract (gradeAttempt,
// getHint). Keep them in sync with backend/functions/src/types.ts.

export type GradeLineRef = { id: string; bbox: { x: number; y: number; w: number; h: number } };

// How a wrong answer is classified. A slip is a careless, arithmetic, or
// transcription mistake; a concept is a genuine wrong mental model that may feed
// the per-student misconception graph.
export type ErrorType = 'concept' | 'slip';

// One of the student's existing misconception signatures, passed into grading so
// the grader can decide whether a new conceptual error is the same underlying
// mistake as one already on record.
export type KnownMisconception = { id: string; principleId: string; wrongBelief: string };

// The grader's classification of a conceptual error. matchedNodeId is an existing
// known id when the mistake matches one on record, or null to propose a new node.
export type ConceptMatch = {
  matchedNodeId: string | null;
  principleId: string;
  wrongBelief: string;
  specificNote: string;
};

export type GradeInput = {
  problemId: string;
  imagePngBase64: string;
  lines: GradeLineRef[];
  // Optional for now so existing callers still compile; populated once call sites
  // supply the student's misconception graph and the problem's allowed principles.
  knownMisconceptions?: KnownMisconception[];
  allowedPrincipleIds?: string[];
};

export type GradeResult = {
  isCorrect: boolean;
  transcribedSteps: string[];
  firstErrorLineId: string | null;
  explanation: string;
  correctSolution?: string[];
  errorType?: ErrorType;
  conceptMatch?: ConceptMatch;
  /**
   * @deprecated No longer returned by the backend. Kept optional only so existing
   * frontend code compiles until cleanup.
   */
  misconceptionId?: string | null;
};

export type HintInput = {
  problemId: string;
  imagePngBase64: string;
  lines: GradeLineRef[];
  tier: 0 | 1 | 2;
};

export type HintResult = { tier: 0 | 1 | 2; text: string; targetLineId: string | null };

export type AskInput = {
  problemId: string;
  imagePngBase64: string;
  lines: GradeLineRef[];
  question: string;
};

export type AskResult = { answer: string };

// Mirrors the backend generateReviewProblem callable: the composer asks for a
// verified problem aimed at a misconception node's wrong belief. The callable
// returns only PUBLIC fields plus the target node id; answers and rubric stay
// server side.
export type ReviewProblemInput = {
  nodeId: string;
  wrongBelief: string;
  principleId: string;
  difficultyBand: number;
};

export type ReviewProblemResult = {
  problemId: string;
  statement: string;
  skillIds: string[];
  principleIds: string[];
  misconceptionTags: string[];
  difficultyBand: number;
  targetMisconceptionNodeId: string;
};

export async function gradeAttempt(input: GradeInput): Promise<GradeResult> {
  if (!functions) throw new Error('Grading is unavailable: Firebase is not configured.');
  const callable = httpsCallable<GradeInput, GradeResult>(functions, 'gradeAttempt');
  const res = await callable(input);
  return res.data;
}

export async function getHint(input: HintInput): Promise<HintResult> {
  if (!functions) throw new Error('Hints are unavailable: Firebase is not configured.');
  const callable = httpsCallable<HintInput, HintResult>(functions, 'getHint');
  const res = await callable(input);
  return res.data;
}

export async function askQuestion(input: AskInput): Promise<AskResult> {
  if (!functions) throw new Error('Ask is unavailable: Firebase is not configured.');
  const callable = httpsCallable<AskInput, AskResult>(functions, 'askQuestion');
  const res = await callable(input);
  return res.data;
}

export async function generateReviewProblem(input: ReviewProblemInput): Promise<ReviewProblemResult> {
  if (!functions) throw new Error('Review generation is unavailable: Firebase is not configured.');
  const callable = httpsCallable<ReviewProblemInput, ReviewProblemResult>(functions, 'generateReviewProblem');
  const res = await callable(input);
  return res.data;
}
