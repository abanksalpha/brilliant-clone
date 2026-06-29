import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import type { ProblemPlan } from '../content/problemSchema';

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

// Hints escalate without a ceiling: `level` is the 0-based index of the hint
// being requested (how many were already given) and `priorHints` is the text of
// those earlier hints, so each new hint goes strictly deeper and never repeats.
export type HintInput = {
  problemId: string;
  imagePngBase64: string;
  lines: GradeLineRef[];
  level: number;
  priorHints: string[];
};

export type HintResult = { level: number; text: string; targetLineId: string | null };

export type AskInput = {
  problemId: string;
  imagePngBase64: string;
  lines: GradeLineRef[];
  question: string;
};

export type AskResult = { answer: string };

// A worked-example self-explanation: the conceptual `question` the student was
// asked and their typed `answer`. The backend grounds the feedback from the
// problem key, so no canvas image is sent.
export type ExplainFeedbackInput = {
  problemId: string;
  question: string;
  answer: string;
};

// `isOnTrack` only styles the response (encouraging vs. nudging); it never blocks
// the learner from continuing.
export type ExplainFeedbackResult = { feedback: string; isOnTrack: boolean };

// One generated slot the planner reasons about as part of a whole set. Scope and
// the learner's misconceptions to target are passed straight through to Stage 2;
// the planner only writes a distinct description and title per slot.
export type PlanSlot = {
  skillIds: string[];
  principleIds: string[];
  difficultyBand: number;
  kind: 'single' | 'synthesis';
  requireChain: boolean;
  targetMisconceptions: { nodeId: string; principleId: string; wrongBelief: string }[];
};

// Mirrors the backend planProblemSet callable: it sees the whole set so it can
// return one mutually-distinct description per slot, distinct from any authored
// problem already in the set (existingStatements). No answers anywhere.
export type PlanProblemSetInput = {
  slots: PlanSlot[];
  existingStatements: string[];
  lessonTitle: string;
};

// Mirrors the backend generatePlannedProblem callable: a generator subagent
// realizes one planned description into a verified problem (a verifier subagent
// must independently agree). Each target misconception is embedded as a required,
// diagnosable flaw. The callable returns only PUBLIC fields plus the trapped node
// ids and the title; answers and rubric stay server side.
export type PlannedProblemInput = {
  skillIds: string[];
  principleIds: string[];
  difficultyBand: number;
  // A synthesis problem must chain multiple principles; a focused single-topic
  // problem opts out so the gate does not force a contrived, unverifiable chain.
  requireChain: boolean;
  targetMisconceptions: { nodeId: string; principleId: string; wrongBelief: string }[];
  pastPrincipleIds?: string[];
  // The planned scenario this problem must realize, and the planned title carried
  // onto the resulting Problem.
  description: string;
  title: string;
};

export type PlannedProblemResult = {
  problemId: string;
  statement: string;
  title: string;
  skillIds: string[];
  principleIds: string[];
  misconceptionTags: string[];
  difficultyBand: number;
  targetMisconceptionNodeIds: string[];
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

export async function getExplanationFeedback(
  input: ExplainFeedbackInput,
): Promise<ExplainFeedbackResult> {
  if (!functions) throw new Error('Feedback is unavailable: Firebase is not configured.');
  const callable = httpsCallable<ExplainFeedbackInput, ExplainFeedbackResult>(functions, 'explainFeedback');
  const res = await callable(input);
  return res.data;
}

// Stage 1: ask the planner for one distinct description per generated slot. The
// callable returns `{ plans }`, which this unwraps to the bare array.
export async function planProblemSet(input: PlanProblemSetInput): Promise<ProblemPlan[]> {
  if (!functions) throw new Error('Problem planning is unavailable: Firebase is not configured.');
  // The default callable timeout is 70s; the planner can retry, so allow more.
  const callable = httpsCallable<PlanProblemSetInput, { plans: ProblemPlan[] }>(functions, 'planProblemSet', {
    timeout: 120000,
  });
  const res = await callable(input);
  return res.data.plans;
}

// Stage 2: realize one planned description into a verified problem. There is no
// fallback; a failure rejects so the surface fails loudly.
export async function generatePlannedProblem(input: PlannedProblemInput): Promise<PlannedProblemResult> {
  if (!functions) throw new Error('Problem generation is unavailable: Firebase is not configured.');
  // Generation runs a reasoning model and re-verifies over several independent
  // re-solves, retrying on a failed gate, so one call can take a few minutes. The
  // default 70s callable timeout would abort a valid generation; match the
  // function's own timeoutSeconds (see backend/functions/src/index.ts).
  const callable = httpsCallable<PlannedProblemInput, PlannedProblemResult>(functions, 'generatePlannedProblem', {
    timeout: 300000,
  });
  const res = await callable(input);
  return res.data;
}
