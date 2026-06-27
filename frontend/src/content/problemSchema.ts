// A problem is single topic when it exercises one skill and synthesis when it
// spans two or more. A misconception-review slot is a composer concept, not a
// problem kind, so it is intentionally absent here.
export type ProblemKind = 'single' | 'synthesis';

export type ProblemGiven = {
  label: string;
  value: string;
};

// Structural features the composer reads to reason about how hard a problem is
// beyond its single band number: the count of distinct steps, whether it is
// worked symbolically, whether it needs calculus, whether it is multi part, and
// whether it sets a deliberate trap aligned with a misconception.
export type DifficultyFeatures = {
  steps: number;
  symbolic: boolean;
  calculus: boolean;
  multiPart: boolean;
  hasTrap: boolean;
};

export type Problem = {
  problemId: string;
  lessonId: string; // kept for back-compat: the home skill of a single-topic problem
  unitId: string;
  skillIds: string[]; // 1 = single-topic, 2+ = synthesis; must include lessonId
  principleIds: string[]; // ids from principles.ts
  misconceptionTags: string[];
  kind: ProblemKind;
  // Retained from the original schema so the mastery selector (which consumes the
  // leaner ProblemRef) can still order problems. Mirrors difficultyBand.
  difficulty: number; // 1..5
  difficultyBand: number; // 1..5, AP-Classroom = 4..5
  difficultyFeatures: DifficultyFeatures;
  provenance: 'authored' | 'variant' | 'synthesis';
  templateId?: string;
  title: string;
  prompt: string;
  givens?: ProblemGiven[];
  figure?: string; // optional text description of a figure
  // Set only on generated review problems aimed at a specific emergent
  // misconception node, so solving one can credit a spaced catch to that node.
  targetMisconceptionNodeId?: string;
  // Present only on a review-slot placeholder: the set carries the request, and
  // the player generates the real problem on demand when the student reaches it
  // (never up front). Cleared once the problem is materialized.
  pendingReview?: PendingReview;
  // The id the backend grades against. Differs from problemId only for a
  // materialized review problem, whose problemId stays the stable placeholder id
  // (for set order and progress) while grading targets the freshly generated key.
  gradeId?: string;
};

// The request a review-slot placeholder carries so the player can generate the
// real problem on demand, aimed at one emergent misconception node.
export type PendingReview = {
  nodeId: string;
  wrongBelief: string;
  principleId: string;
  difficultyBand: number;
};

export type Misconception = {
  id: string;
  name: string;
  shortLabel: string;
  description: string;
};
