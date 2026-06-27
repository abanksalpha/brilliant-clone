// Local, minimal input types for the assignment composer. These are defined
// here (not imported from content or progress) so this module stays self
// contained, pure, and decoupled, mirroring how mastery/selectProblems.ts
// keeps its own ProblemRef shape.

import type { MisconceptionGraph } from '../mastery/misconceptionGraph';

export type AssignmentContext = 'post-lesson' | 'review';

export type SlotType = 'single' | 'synthesis' | 'misconception-review';

export type Slot = {
  type: SlotType;
  targetSkillId?: string; // for single and synthesis anchoring
  // The emergent misconception node a review slot targets, plus the node fields a
  // generator needs to draft a problem aimed at that wrong belief.
  targetMisconceptionNodeId?: string;
  wrongBelief?: string;
  principleId?: string;
  difficultyBand: number;
};

export type LearnerState = {
  misconceptionGraph: MisconceptionGraph;
  masteredSkillIds: string[];
  recentProblemIds: string[];
};

export type CandidateProblem = {
  problemId: string;
  skillIds: string[];
  principleIds: string[];
  misconceptionTags: string[];
  kind: 'single' | 'synthesis';
  difficultyBand: number;
};

export type Assignment = CandidateProblem[];
