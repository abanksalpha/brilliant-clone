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
export type HintInput = { problemId: string; imagePngBase64: string; lines: LineRef[]; tier: 0 | 1 | 2 };
export type AskInput = { problemId: string; imagePngBase64: string; lines: LineRef[]; question: string };

export type GradeResult = {
  isCorrect: boolean;
  transcribedSteps: string[];
  firstErrorLineId: string | null;   // must be null or one of the input line ids
  explanation: string;               // why the first wrong step is wrong; never reveals the final answer
  correctSolution?: string[];        // present only when isCorrect is true
  errorType?: ErrorType;             // present only when isCorrect is false
  conceptMatch?: ConceptMatch;       // present only when errorType is 'concept'
};

export type HintResult = { tier: 0 | 1 | 2; text: string; targetLineId: string | null };

export type AskResult = { answer: string };

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
};

// A re-numbered problem is described by a template plus a set of numeric
// parameters. A ParamRange bounds one parameter; ParamSpec is the full set of
// ranges for a template; VariantParams is one concrete choice of values.
export type ParamRange = { min: number; max: number; step: number };
export type ParamSpec = Record<string, ParamRange>;
export type VariantParams = Record<string, number>;

// A SeedTemplate computes its own correct answer and each misconception's buggy
// answer in code, so any variant's key is re-derivable from its parameters at
// grade time without a database. These are server only: never export them or the
// answers they compute to any frontend path.
export type SeedTemplate = {
  templateId: string;
  skillIds: string[];
  principleIds: string[];
  difficultyBand: number;
  paramSpec: ParamSpec;
  renderStatement: (p: VariantParams) => string;
  solve: (p: VariantParams) => { correctSolution: string[]; finalAnswer: string };
  rubric: string;
  flaws: { misconceptionId: string; buggyPath: (p: VariantParams) => string }[];
};
