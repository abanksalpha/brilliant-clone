export type LineRef = { id: string; bbox: { x: number; y: number; w: number; h: number } };

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
  matchedNodeId: string | null;   // an existing known id, or null to propose new
  principleId: string;            // must be one of the allowed principle ids
  wrongBelief: string;            // canonical one-line signature, no instance numbers
  specificNote: string;           // human-readable detail for this work
};

export type GradeInput = {
  problemId: string;
  imagePngBase64: string;
  lines: LineRef[];
  knownMisconceptions: KnownMisconception[];   // this student's existing signatures
  allowedPrincipleIds: string[];               // principle ids a new proposal may use
};
// Hints escalate without a fixed ceiling: `level` is the 0-based index of the
// hint being requested (how many were already given), and `priorHints` carries
// the text of those earlier hints so the model can go strictly deeper and never
// repeat itself.
export type HintInput = {
  problemId: string;
  imagePngBase64: string;
  lines: LineRef[];
  level: number;
  priorHints: string[];
};
export type AskInput = { problemId: string; imagePngBase64: string; lines: LineRef[]; question: string };

// A worked example self-explanation: the conceptual `question` the student was
// asked after the full solution was revealed, and their typed `answer`. There is
// no handwriting image; the solution is grounded from the problem key server side.
export type ExplainFeedbackInput = { problemId: string; question: string; answer: string };

export type GradeResult = {
  isCorrect: boolean;
  transcribedSteps: string[];
  firstErrorLineId: string | null;   // must be null or one of the input line ids
  explanation: string;               // why the first wrong step is wrong; never reveals the final answer
  correctSolution?: string[];        // present only when isCorrect is true
  errorType?: ErrorType;             // present only when isCorrect is false
  conceptMatch?: ConceptMatch;       // present only when errorType is 'concept'
};

export type HintResult = { level: number; text: string; targetLineId: string | null };

export type AskResult = { answer: string };

// Formative feedback on a self-explanation: `feedback` speaks to the student in
// the second person, and `isOnTrack` is whether their explanation captures the
// core idea (used only to style the response; it never blocks progress).
export type ExplainFeedbackResult = { feedback: string; isOnTrack: boolean };

export type ProblemKey = {
  problemId: string;
  statement: string;
  correctSolution: string[];
  finalAnswer: string;
  rubric: string;
  flaws: Array<{ misconceptionId: string; signature: string }>;
};

// One intended misconception in a synthesized problem. signature is the wrong
// step it produces (kept on the grader key); wrongAnswer is the distinct numeric
// answer that misconception yields, used only by the verification gate to prove
// the misconception is diagnosable. wrongAnswer is dropped before grading.
export type SynthesisFlaw = { misconceptionId: string; signature: string; wrongAnswer: string };

// A candidate problem proposed by the synthesis model, before or after it has
// passed the verification gate. problemId is "syn:" plus a stable hash of the
// statement. finalAnswer is a canonical answer string, for example "2.25e6 N/C".
export type SynthesisCandidate = {
  problemId: string;
  statement: string;
  skillIds: string[];
  principleIds: string[];
  misconceptionTags: string[];
  difficultyBand: number;
  correctSolution: string[];
  finalAnswer: string;
  rubric: string;
  flaws: SynthesisFlaw[];
  // A short, specific display name the model proposes (the planned-problem prompt
  // requests it, and the planner's title is carried onto the verified candidate).
  title?: string;
};

// One target misconception passed from the client through both pipeline stages
// unchanged: the node to credit, the principle it corrupts, and the wrong belief
// the generated problem must make decide the answer.
export type TargetMisconception = { nodeId: string; principleId: string; wrongBelief: string };

// Stage 1 input. One PlanSlot per generated problem in display order; the planner
// proposes a distinct scenario per slot. Scope and misconceptions are forwarded
// to Stage 2 unchanged (the planner never assigns scope).
export type PlanSlot = {
  skillIds: string[];
  principleIds: string[];
  difficultyBand: number;
  kind: 'single' | 'synthesis';
  requireChain: boolean;
  targetMisconceptions: TargetMisconception[];
};

export type PlanProblemSetInput = {
  slots: PlanSlot[];
  existingStatements: string[]; // authored problems already in the set, to avoid
  lessonTitle: string;          // light context for better descriptions
};

// Stage 1 output. One plan per slot (slotIndex back into the input slots): a
// specific title and a 1 to 2 sentence scenario sketch, never the full problem or
// its answer. Descriptions are mutually distinct by construction.
export type ProblemPlan = {
  slotIndex: number;
  title: string;
  description: string;
};

// Stage 2 input. A slot's scope plus the planned scenario and title that the
// generated problem must realize exactly.
export type PlannedProblemInput = {
  skillIds: string[];
  principleIds: string[];
  difficultyBand: number;
  requireChain: boolean;
  targetMisconceptions: TargetMisconception[];
  pastPrincipleIds?: string[];
  description: string;
  title: string;
};
