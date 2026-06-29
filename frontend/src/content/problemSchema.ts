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
  provenance: 'authored' | 'synthesis';
  title: string;
  prompt: string;
  givens?: ProblemGiven[];
  figure?: string; // optional text description of a figure
  targetMisconceptionNodeIds?: string[]; // node ids a generated problem traps; a correct solve credits a catch on each
  // The id the backend grades against. Differs from problemId only for a
  // generated problem whose stable set id and graded key diverge; for authored
  // problems it is omitted and grading targets problemId.
  gradeId?: string;
  // The plan slot a generated problem realizes (a finite integer), set by the
  // builders. Optional and only present on generated problems; authored problems
  // never carry it. Resume and per-slot retry match a persisted problem to its
  // slot by this index rather than by array position or count.
  planSlotIndex?: number;
};

// One planned problem in a generated set. A planner agent returns one plan per
// generated slot (mutually distinct by construction), then a generator subagent
// realizes each into a full Problem. This is the shared shape with the backend
// planProblemSet callable.
export type ProblemPlan = {
  slotIndex: number; // index back into the requested slots, in display order
  title: string; // a specific, descriptive name (not "Practice")
  description: string; // a short, moderately specific scenario sketch
};
