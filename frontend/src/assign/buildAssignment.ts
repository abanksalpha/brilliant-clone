// Integration seam between the learner's progress and the composer. It turns a
// DashboardProgress into a Problem[] the existing ProblemPlayer can render, by
// composing a blueprint over the authored problems, freshly drawn public
// variants, and review-slot placeholders. Nothing is generated against the model
// here: a misconception-review slot resolves to a lightweight placeholder that
// carries the emergent node to target, and the player generates the real problem
// on demand when the student reaches it (never up front, so no problem is ever
// generated that the student may never see). Variant answers stay backend-only:
// a variant problemId is a v1: id the backend re-derives at grade time.
//
// The variant seed counter is derived from progress (no Math.random, no clock
// reads beyond the passed now), so the template variants are deterministic. No
// fallbacks: if a chosen id cannot resolve to a full problem it throws, because
// that indicates a real bug.

import { COURSE_LESSONS_FLAT } from '../content/courseMap';
import { PROBLEMS, getProblemById, getProblemsForLesson, type Problem } from '../content/problems';
import type { PendingReview } from '../content/problemSchema';
import {
  PUBLIC_TEMPLATES,
  drawParams,
  generateVariantProblem,
  parseVariantId,
  type PublicSeedTemplate,
} from '../content/templates';
import { isLessonMastered } from '../mastery/masteryModel';
import type { MisconceptionGraph } from '../mastery/misconceptionGraph';
import type { DashboardProgress } from '../progress/dashboardProgress';
import { STANDARD_BAND, chooseBlueprint } from './blueprint';
import { composeAssignment } from './composer';
import type { AssignmentContext, CandidateProblem, LearnerState, Slot } from './types';

// Bound on how far the seed counter advances while skipping variant ids that
// collide with an already chosen problem before generateForSlot gives up.
const MAX_SEED_ADVANCE = 64;

/** Project a full Problem down to the leaner shape the composer scores. */
function toCandidate(problem: Problem): CandidateProblem {
  return {
    problemId: problem.problemId,
    skillIds: problem.skillIds,
    principleIds: problem.principleIds,
    misconceptionTags: problem.misconceptionTags,
    kind: problem.kind,
    difficultyBand: problem.difficultyBand,
  };
}

/**
 * The placeholder a review slot resolves to. It carries the generation request
 * (the emergent node, its wrong belief, principle, and band) but no statement:
 * the player generates the real problem on demand when the student reaches it,
 * never up front. The problemId is a stable `review:<nodeId>` so set order,
 * progress, and resume stay fixed across that lazy generation.
 */
export function reviewPlaceholder(pending: PendingReview): Problem {
  return {
    problemId: `review:${pending.nodeId}`,
    lessonId: 'coulombs-law',
    unitId: 'electrostatics',
    skillIds: [],
    principleIds: [pending.principleId],
    misconceptionTags: [],
    kind: 'single',
    difficulty: pending.difficultyBand,
    difficultyBand: pending.difficultyBand,
    difficultyFeatures: { steps: 4, symbolic: false, calculus: false, multiPart: false, hasTrap: true },
    provenance: 'synthesis',
    title: 'Review',
    prompt: '',
    targetMisconceptionNodeId: pending.nodeId,
    pendingReview: pending,
  };
}

/**
 * The public templates that can fill a single or synthesis slot: those covering
 * its target skill, or the first template when the slot has no target. Empty
 * when nothing matches. Misconception-review slots never reach here; they are
 * filled by live backend generation, not template variants.
 */
function matchingTemplates(slot: Slot): PublicSeedTemplate[] {
  const target = slot.targetSkillId;
  if (target === undefined) {
    return PUBLIC_TEMPLATES.length > 0 ? [PUBLIC_TEMPLATES[0]] : [];
  }
  return PUBLIC_TEMPLATES.filter((template) => template.skillIds.includes(target));
}

/**
 * Shared core: build the learner state, candidate pool, and blueprint, then let
 * the composer fill it (drawing template variants for single and synthesis slots
 * and generating live review problems for misconception-review slots) and
 * resolve each chosen id back to a full Problem.
 */
async function build(
  context: AssignmentContext,
  targetSkillId: string | null,
  progress: DashboardProgress,
  now: Date,
): Promise<Problem[]> {
  const masteryMap = progress.misconceptions;

  // A skill counts as mastered when its authored problems prove every tag is
  // mastered right now. Only skills with authored problems can be mastered today;
  // unique skill ids are walked in course order so the result is stable.
  const masteredSkillIds: string[] = [];
  const seenSkillIds = new Set<string>();
  for (const lesson of COURSE_LESSONS_FLAT) {
    if (seenSkillIds.has(lesson.skillId)) continue;
    seenSkillIds.add(lesson.skillId);
    if (isLessonMastered(masteryMap, getProblemsForLesson(lesson.skillId), now)) {
      masteredSkillIds.push(lesson.skillId);
    }
  }

  const recentProblemIds = Object.keys(progress.problemAttempts);

  const learnerState: LearnerState = {
    misconceptionGraph: progress.misconceptionGraph,
    masteredSkillIds,
    recentProblemIds,
  };

  // Candidate pool from authored problems, keeping the full problem keyed by id
  // so a chosen authored candidate can be resolved back to what ProblemPlayer
  // renders.
  const problemsById = new Map<string, Problem>();
  const candidates: CandidateProblem[] = [];
  for (const problem of PROBLEMS) {
    problemsById.set(problem.problemId, problem);
    candidates.push(toCandidate(problem));
  }

  let slots: Slot[];
  if (context === 'post-lesson') {
    const foundIndex = COURSE_LESSONS_FLAT.findIndex((lesson) => lesson.skillId === targetSkillId);
    const skillCourseIndex = foundIndex === -1 ? 0 : foundIndex;
    slots = chooseBlueprint({
      context: 'post-lesson',
      targetSkillId: targetSkillId ?? undefined,
      skillCourseIndex,
      totalSkills: COURSE_LESSONS_FLAT.length,
      learnerState,
      now,
    });
  } else {
    slots = chooseBlueprint({ context: 'review', learnerState, now });
  }

  // Freshly generated variants and review problems keyed by id, plus a
  // deterministic seed counter seeded from how many problems the learner has
  // already attempted (used for template variants only).
  const generatedById = new Map<string, Problem>();
  let seed = recentProblemIds.length;

  // A misconception-review slot resolves to a placeholder carrying the node to
  // target. No model call happens here: the player generates the real problem on
  // demand when the student reaches it (never up front).
  const placeholderForReviewSlot = (slot: Slot): CandidateProblem => {
    const full = reviewPlaceholder({
      nodeId: slot.targetMisconceptionNodeId!,
      wrongBelief: slot.wrongBelief!,
      principleId: slot.principleId!,
      difficultyBand: slot.difficultyBand,
    });
    generatedById.set(full.problemId, full);
    return toCandidate(full);
  };

  // Draw a fresh public variant for a single or synthesis slot, advancing the
  // seed past ids that collide with an already chosen problem. When several
  // templates fit the slot's skill, rotate across them by the (deterministic)
  // seed so a set with many single slots on one skill draws varied structures
  // instead of the same template repeatedly.
  const generateVariantForSlot = (slot: Slot): CandidateProblem | null => {
    const templates = matchingTemplates(slot);
    if (templates.length === 0) return null;

    for (let attempt = 0; attempt < MAX_SEED_ADVANCE; attempt += 1) {
      const currentSeed = seed;
      seed += 1;
      const template = templates[currentSeed % templates.length];
      const params = drawParams(template.templateId, currentSeed);
      const full = generateVariantProblem(template.templateId, params);
      if (problemsById.has(full.problemId) || generatedById.has(full.problemId)) {
        // Collides with an already chosen problem; advance the seed and retry.
        continue;
      }
      generatedById.set(full.problemId, full);
      return toCandidate(full);
    }
    return null;
  };

  const generateForSlot = async (slot: Slot): Promise<CandidateProblem | null> => {
    if (slot.type === 'misconception-review') {
      return placeholderForReviewSlot(slot);
    }
    return generateVariantForSlot(slot);
  };

  const chosen = await composeAssignment({ slots, candidates, learnerState, now, generateForSlot });

  return chosen.map((candidate) => {
    const full = problemsById.get(candidate.problemId) ?? generatedById.get(candidate.problemId);
    if (!full) {
      throw new Error('unresolved problem id: ' + candidate.problemId);
    }
    return full;
  });
}

/**
 * Post-lesson assignment anchored on the just-finished lesson's skill. Length
 * scales with course position; single and synthesis slots draw fresh public
 * variants, while misconception-review slots resolve to placeholders the player
 * generates on demand against the learner's weakest tracked nodes.
 */
export async function buildPostLessonAssignment(
  lessonId: string,
  progress: DashboardProgress,
  now: Date,
): Promise<Problem[]> {
  return build('post-lesson', lessonId, progress, now);
}

/**
 * Review assignment with no anchor: retrieval spread across the learner's
 * mastered skills and weakest tracked misconception nodes. Single and synthesis
 * slots draw fresh public variants; misconception-review slots resolve to
 * placeholders the player generates on demand.
 */
export async function buildReviewAssignment(progress: DashboardProgress, now: Date): Promise<Problem[]> {
  return build('review', null, progress, now);
}

// Restore a previously generated set so a saved session resumes the same set.
// Authored ids resolve from the bank; a v1: variant id is re-derived from the id
// itself; a review:<nodeId> placeholder is rebuilt from the live graph node so
// the player can regenerate it on demand when reached. Ids that no longer
// resolve (an unknown template, or a node no longer tracked) are dropped,
// matching the defensive persistence loaders, so a returning learner never
// crashes on a stale id.
function resolvePersistedId(problemId: string, graph?: MisconceptionGraph): Problem | null {
  const authored = getProblemById(problemId);
  if (authored) return authored;
  if (problemId.startsWith('review:')) {
    if (!graph) return null;
    const nodeId = problemId.slice('review:'.length);
    const node = graph[nodeId];
    if (!node || node.status !== 'tracked') return null;
    return reviewPlaceholder({
      nodeId,
      wrongBelief: node.wrongBelief,
      principleId: node.principleId,
      difficultyBand: STANDARD_BAND,
    });
  }
  if (!problemId.startsWith('v1:')) return null;
  try {
    const { templateId, params } = parseVariantId(problemId);
    return generateVariantProblem(templateId, params);
  } catch {
    return null;
  }
}

export function rehydrateAssignment(problemIds: string[], graph?: MisconceptionGraph): Problem[] {
  const problems: Problem[] = [];
  for (const id of problemIds) {
    const resolved = resolvePersistedId(id, graph);
    if (resolved) problems.push(resolved);
  }
  return problems;
}
