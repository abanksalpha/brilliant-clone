export type StepType = 'concept' | 'interactive';

export type InteractionType =
  | 'drag'
  | 'drag-rotate'
  | 'drag-to-match'
  | 'multiple-choice'
  | 'slider'
  | 'tap'
  | 'numeric'
  | 'sandbox'
  | 'build-formula'
  | 'vector-aim'
  | 'ordering';

export type VisualConfig = {
  type: 'text-description';
  description: string;
};

export type Choice = {
  id: string;
  text: string;
  correct: boolean;
};

export type Feedback = {
  correct?: string;
  wrong: Array<{
    label?: string;
    text: string;
  }>;
};

// Typed answer checked against the lesson's real physics in plain JS.
export type NumericConfig = {
  answer: number;
  tolerance?: number;
  relativeTolerance?: number;
  unit?: string;
  placeholder?: string;
  // Extra exact string forms that also count as correct (e.g. "1/25").
  accepts?: string[];
};

export type SandboxCharge = {
  id: string;
  x: number;
  y: number;
  q: number;
  fixed?: boolean;
  label?: string;
};

export type SandboxConfig = {
  width: number;
  height: number;
  fixedCharges: SandboxCharge[];
  testCharge: SandboxCharge;
  lockAxis?: 'x' | 'y';
  goal?: {
    type: 'equilibrium';
    toleranceForce: number;
    targetX?: number;
    targetY?: number;
  };
};

export type BuildFormulaPiece = {
  id: string;
  label: string;
};

export type BuildFormulaConfig = {
  pieces: BuildFormulaPiece[];
  numerator: string[];
  denominator: string[];
  prefixLabel?: string;
};

export type VectorAimConfig = {
  // Degrees, 0 = pointing right (+x), increasing clockwise (SVG y grows down).
  targetAngleDeg: number;
  toleranceDeg: number;
  pivotSign?: '+' | '-';
  targetSign?: '+' | '-';
};

export type OrderingItem = {
  id: string;
  label: string;
};

export type OrderingConfig = {
  // Items listed in their CORRECT order. The widget shuffles them for display.
  items: OrderingItem[];
  // Optional explicit correct id order; defaults to the items' own order.
  correctOrder?: string[];
};

export type BaseStep = {
  stepNumber: number;
  title?: string;
  type: StepType;
  visual: VisualConfig;
  explanation?: string;
  cta?: string;
};

export type ConceptStep = BaseStep & {
  type: 'concept';
  body: string;
};

export type InteractiveStep = BaseStep & {
  type: 'interactive';
  interactionType: InteractionType;
  prompt: string;
  interaction?: string;
  triggerCondition?: string;
  choices?: Choice[];
  feedback: Feedback;
  correctMatches?: string[];
  numeric?: NumericConfig;
  sandbox?: SandboxConfig;
  buildFormula?: BuildFormulaConfig;
  vectorAim?: VectorAimConfig;
  ordering?: OrderingConfig;
};

export type Step = ConceptStep | InteractiveStep;

export type LessonCounts = {
  totalSteps: number;
  interactiveProblems: number;
  conceptCards: number;
};

export type Lesson = {
  lessonId: string;
  lessonNumber: number;
  title: string;
  sourceFile: string;
  prerequisites: string[];
  targetIntuitions: string[];
  learningArc: string;
  counts: LessonCounts;
  steps: Step[];
};
