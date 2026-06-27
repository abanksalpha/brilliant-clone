// Blueprint chooser. Turns a learner's mastery state into an ordered list of
// empty slots (single, synthesis, misconception-review) for two contexts:
// post-lesson (anchored on a target skill) and review (no anchor). Pure and
// deterministic: the caller passes `now`, there is no Math.random, and ties
// break by input order.

import { currentStrength } from '../mastery/masteryModel';
import { trackedNodes } from '../mastery/misconceptionGraph';
import type { MisconceptionGraph, MisconceptionNode } from '../mastery/misconceptionGraph';
import type { AssignmentContext, LearnerState, Slot } from './types';

/** AP-Classroom hard band for synthesis slots. */
export const SYNTHESIS_BAND = 5;

/** AP-Classroom hard band for single and misconception-review slots. */
export const STANDARD_BAND = 4;

const MIN_LENGTH = 6;
const MAX_LENGTH = 18;
const MAX_SYNTHESIS = 4;
const MAX_MISCONCEPTION_SLOTS = 3;
const REVIEW_LENGTH = 8;
const MAX_REVIEW_SYNTHESIS = 2;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(value: number, min: number, max: number): number {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

/**
 * The learner's TRACKED misconception nodes, ordered from weakest to strongest
 * by decayed strength right now. Notes are excluded; only promoted nodes get
 * review slots. Equal current strengths break by createdISO ascending (older
 * first), so the result is stable and deterministic.
 */
function trackedNodesByAscendingStrength(
  graph: MisconceptionGraph,
  now: Date,
): MisconceptionNode[] {
  return trackedNodes(graph)
    .map((node) => ({ node, strength: currentStrength(node, now) }))
    .sort(
      (a, b) =>
        a.strength - b.strength || a.node.createdISO.localeCompare(b.node.createdISO),
    )
    .map((scored) => scored.node);
}

/** Build a review slot aimed at one emergent misconception node. */
function reviewSlot(node: MisconceptionNode): Slot {
  return {
    type: 'misconception-review',
    targetMisconceptionNodeId: node.id,
    wrongBelief: node.wrongBelief,
    principleId: node.principleId,
    difficultyBand: STANDARD_BAND,
  };
}

/** Skill id at position `i` round-robin across the list, or undefined if empty. */
function roundRobin(ids: string[], i: number): string | undefined {
  if (ids.length === 0) return undefined;
  return ids[i % ids.length];
}

type BlueprintParams = {
  context: AssignmentContext;
  targetSkillId?: string;
  skillCourseIndex?: number;
  totalSkills?: number;
  learnerState: LearnerState;
  now: Date;
};

/**
 * Post-lesson blueprint, anchored on `targetSkillId`. Length scales from 6 at
 * the first course skill to 18 at the last. Slots are composed as synthesis,
 * then misconception-review, then single, truncated or padded to length.
 *
 *   - Synthesis count scales 0..4 with course position but is gated to zero
 *     when no skill is mastered yet (nothing to synthesize against).
 *   - Up to min(3, floor(length / 4)) misconception-review slots target the
 *     learner's weakest TRACKED misconception nodes, ascending strength.
 *   - The remaining slots are single problems on the target skill.
 */
function postLessonBlueprint(params: BlueprintParams): Slot[] {
  const { targetSkillId, skillCourseIndex, totalSkills, learnerState, now } = params;
  const idx = skillCourseIndex ?? 0;
  const span = Math.max(1, (totalSkills ?? 1) - 1);
  const t = idx / span;

  const length = clamp(Math.round(lerp(MIN_LENGTH, MAX_LENGTH, t)), MIN_LENGTH, MAX_LENGTH);

  const synthesisCount =
    learnerState.masteredSkillIds.length === 0
      ? 0
      : clamp(Math.round(lerp(0, MAX_SYNTHESIS, t)), 0, MAX_SYNTHESIS);

  const weakest = trackedNodesByAscendingStrength(learnerState.misconceptionGraph, now);
  const misconceptionCount = Math.min(
    MAX_MISCONCEPTION_SLOTS,
    Math.floor(length / 4),
    weakest.length,
  );

  const slots: Slot[] = [];
  for (let i = 0; i < synthesisCount; i += 1) {
    slots.push({ type: 'synthesis', targetSkillId, difficultyBand: SYNTHESIS_BAND });
  }
  for (let i = 0; i < misconceptionCount; i += 1) {
    slots.push(reviewSlot(weakest[i]));
  }
  while (slots.length < length) {
    slots.push({ type: 'single', targetSkillId, difficultyBand: STANDARD_BAND });
  }

  return slots.slice(0, length);
}

/**
 * Review blueprint, with no anchor (any input target skill is ignored). Fixed
 * length 8. About three fifths of the slots (5 of 8) are misconception-review on
 * the learner's weakest TRACKED nodes, ascending strength; if fewer tracked
 * nodes exist the shortfall becomes single slots. The rest are single slots
 * spread round-robin across mastered skills, plus up to two synthesis slots when
 * at least two skills are mastered.
 */
function reviewBlueprint(params: BlueprintParams): Slot[] {
  const { learnerState, now } = params;
  const misconceptionTarget = Math.round((REVIEW_LENGTH * 3) / 5);
  const restCount = REVIEW_LENGTH - misconceptionTarget;

  const weakest = trackedNodesByAscendingStrength(learnerState.misconceptionGraph, now);
  const reviewCount = Math.min(misconceptionTarget, weakest.length);

  const synthesisCount =
    learnerState.masteredSkillIds.length >= 2 ? Math.min(MAX_REVIEW_SYNTHESIS, restCount) : 0;
  const singleCount = misconceptionTarget - reviewCount + (restCount - synthesisCount);

  const slots: Slot[] = [];
  for (let i = 0; i < reviewCount; i += 1) {
    slots.push(reviewSlot(weakest[i]));
  }
  for (let i = 0; i < singleCount; i += 1) {
    slots.push({
      type: 'single',
      targetSkillId: roundRobin(learnerState.masteredSkillIds, i),
      difficultyBand: STANDARD_BAND,
    });
  }
  for (let i = 0; i < synthesisCount; i += 1) {
    slots.push({ type: 'synthesis', difficultyBand: SYNTHESIS_BAND });
  }

  return slots;
}

/**
 * Choose the slot blueprint for an assignment. Post-lesson anchors on the
 * target skill and scales with course position; review ignores any anchor and
 * spaces retrieval across mastered skills and global weak spots.
 */
export function chooseBlueprint(params: BlueprintParams): Slot[] {
  if (params.context === 'review') return reviewBlueprint(params);
  return postLessonBlueprint(params);
}
