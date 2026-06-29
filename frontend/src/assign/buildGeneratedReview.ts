// Feature A: the Phase 1 "Review" set, three problems generated on the fly. One
// synthesizes all past concepts (P1), one targets the previous lesson (P2), one
// the lesson before that (P3). Each scope is derived from the learner's progress
// and the module's authored review seeds.
//
// Two stages, both injected so this stays pure and unit-testable with stubs: a
// planner proposes one mutually-distinct description per slot (so duplication is
// impossible by construction), then a generator realizes each description into a
// verified synthesis problem (which never returns answers). There is NO fallback
// and NO template: the planner failing rejects the whole build, but a single
// slot's generation failing is reported per-slot (failedSlotIndices) and never
// substituted, so the rest of the set stays usable.
//
// Pure and deterministic given its inputs: it takes `now` as an explicit Date,
// the planner and generator are injected (no firebase import, no global clock),
// and it reads only the static catalog via principleIdsForSkills and the passed
// graph. It never calls Math.random.

import { capScopePrinciples, principleIdsForSkills } from '../content';
import type { Problem, ProblemKind, ProblemPlan } from '../content/problemSchema';
import type { LessonModule } from '../content/schema';
import type {
  PlanProblemSetInput,
  PlanSlot,
  PlannedProblemInput,
  PlannedProblemResult,
} from '../lib/grading';
import { selectNodesForScope, type MisconceptionGraph } from '../mastery/misconceptionGraph';
import type { DashboardProgress } from '../progress/dashboardProgress';

// The injected backend boundaries. Mirror the planProblemSet / generatePlannedProblem
// wrappers in lib/grading; passing them in keeps this builder pure and testable.
export type Planner = (input: PlanProblemSetInput) => Promise<ProblemPlan[]>;
export type PlannedGenerator = (input: PlannedProblemInput) => Promise<PlannedProblemResult>;

// Per-slot outcomes: the problems that built successfully (in slot order) plus
// the indices of the slots whose generation failed all attempts. A planner
// failure rejects instead; a slot failure is reported here, never thrown.
export type BuildResult = { problems: Problem[]; failedSlotIndices: number[] };

// Optional callbacks and resume inputs. `onPlan` surfaces a freshly-made plan so
// the caller can persist it; `onProblem` streams each problem as it resolves;
// `onSlotError` reports a slot whose generation failed; `prebuilt` /
// `prebuiltPlan` restore an already-built set on resume (matched by identity).
export type BuildOptions = {
  onProblem?: (problem: Problem) => void;
  onPlan?: (plans: ProblemPlan[]) => void;
  onSlotError?: (slotIndex: number) => void;
  prebuilt?: Problem[];
  prebuiltPlan?: ProblemPlan[];
};

const UNIT_ID = 'electrostatics';
const SYNTHESIS_BAND = 5;
const STANDARD_BAND = 4;
const STEP_COUNT = 4;

// A synthesis chains at most three principles, a focused slot at most two, and a
// synthesis whose capped scope holds fewer than two principles generates focused
// rather than forcing an unverifiable chain.
const MAX_SYNTHESIS_PRINCIPLES = 3;
const MAX_FOCUSED_PRINCIPLES = 2;
const MIN_CHAIN_PRINCIPLES = 2;

type Target = { nodeId: string; principleId: string; wrongBelief: string };

// One review slot before generation: the (bounded) principles it chains, the band
// and kind it asks for, whether it must chain, and the tracked misconceptions it
// may trap (selected from the full scope, weakest first).
type ReviewSlot = {
  skillIds: string[];
  principleIds: string[];
  band: number;
  kind: ProblemKind;
  // P1 (the all-past synthesis) chains multiple principles; P2/P3 are focused
  // single-topic problems that must not be forced into a contrived chain.
  requireChain: boolean;
  targets: Target[];
};

/**
 * Build one review slot. Targets come from the FULL scope (weakest first,
 * capped), then the slot's principleIds are bounded with capScopePrinciples so
 * the chain leads with the learner's weakest tracked-node principles and never
 * exceeds the cap. A synthesis whose capped scope cannot reach
 * MIN_CHAIN_PRINCIPLES degrades to focused (requireChain false).
 */
function makeReviewSlot(
  graph: MisconceptionGraph,
  skillIds: string[],
  fullScope: string[],
  band: number,
  kind: ProblemKind,
  targetCount: number,
  now: Date,
): ReviewSlot {
  const targets: Target[] = selectNodesForScope(graph, fullScope, targetCount, now).map((node) => ({
    nodeId: node.id,
    principleId: node.principleId,
    wrongBelief: node.wrongBelief,
  }));
  const priorityPrincipleIds = [...new Set(targets.map((target) => target.principleId))];
  const isSynthesis = kind === 'synthesis';
  const cap = isSynthesis ? MAX_SYNTHESIS_PRINCIPLES : MAX_FOCUSED_PRINCIPLES;
  const principleIds = capScopePrinciples(fullScope, priorityPrincipleIds, cap);
  const requireChain = isSynthesis && principleIds.length >= MIN_CHAIN_PRINCIPLES;
  return { skillIds, principleIds, band, kind, requireChain, targets };
}

/** Assemble a verified generated result plus its slot into a full Problem. */
function toProblem(result: PlannedProblemResult, slot: ReviewSlot, lessonId: string, slotIndex: number): Problem {
  return {
    problemId: result.problemId,
    lessonId,
    unitId: UNIT_ID,
    skillIds: result.skillIds,
    principleIds: result.principleIds,
    misconceptionTags: result.misconceptionTags,
    kind: slot.kind,
    difficulty: result.difficultyBand,
    difficultyBand: result.difficultyBand,
    difficultyFeatures: {
      steps: STEP_COUNT,
      symbolic: false,
      calculus: false,
      multiPart: slot.kind === 'synthesis',
      hasTrap: result.targetMisconceptionNodeIds.length > 0,
    },
    provenance: 'synthesis',
    // The planner owns the specific, descriptive title; it is carried through the
    // generator onto the Problem.
    title: result.title,
    prompt: result.statement,
    gradeId: result.problemId,
    targetMisconceptionNodeIds: result.targetMisconceptionNodeIds,
    // The plan slot this problem realizes, so resume and per-slot retry are by
    // identity rather than array position.
    planSlotIndex: slotIndex,
  };
}

/** Collect the present problems in slot order, omitting absent (failed) slots. */
function assembleBySlot(slotCount: number, bySlot: Map<number, Problem>): Problem[] {
  const problems: Problem[] = [];
  for (let index = 0; index < slotCount; index += 1) {
    const problem = bySlot.get(index);
    if (problem) problems.push(problem);
  }
  return problems;
}

/**
 * Build the Phase 1 review: up to three problems in the order P2 (previous
 * lesson), P3 (the lesson before that), then P1 (a synthesis of all past
 * concepts). P2/P3 are single-topic (requireChain false); P1 chains its bounded
 * scope. Per-scope traps come from the tracked misconception graph.
 *
 * Plan once for the whole set so the descriptions are mutually distinct, then
 * generate each missing slot CONCURRENTLY with Promise.allSettled. Each slot is
 * independent: a fulfilled slot streams via onProblem the moment it resolves; a
 * rejected slot is reported via onSlotError and collected into failedSlotIndices;
 * one slot's failure never rejects the batch and is never substituted. The build
 * rejects only when the planner fails (a whole-set, loud failure).
 *
 * Resumable by IDENTITY: pass the already-built problems as `prebuilt` and the
 * persisted descriptions as `prebuiltPlan`. The missing slots are exactly the
 * plan slots with no prebuilt problem (matched by planSlotIndex), so a returning
 * learner keeps the same problems and only the absent slots regenerate, even for
 * a non-prefix partial (e.g. slot 1 missing while slots 0 and 2 are present). A
 * complete prebuilt set plans and generates nothing. Only newly generated
 * problems are emitted via onProblem.
 */
export async function buildGeneratedReview(
  progress: DashboardProgress,
  module: LessonModule,
  now: Date,
  plan: Planner,
  generate: PlannedGenerator,
  options: BuildOptions = {},
): Promise<BuildResult> {
  const { onProblem, onPlan, onSlotError, prebuilt = [], prebuiltPlan } = options;
  const graph = progress.misconceptionGraph;
  const reviewSkillIds = module.reviewSkillIds;

  // P1 "all past concepts": every completed lesson's skill except this lesson,
  // falling back to the authored review seeds (mechanics on lesson 1) when nothing
  // has been completed yet.
  const pastSkillIds = progress.completedLessonIds.filter((id) => id !== module.lessonId);
  const p1SkillIds = pastSkillIds.length > 0 ? pastSkillIds : reviewSkillIds;

  const slots: ReviewSlot[] = [];

  // P2 "previous lesson": the most recent authored seed, focused single-topic and
  // fast, so it is delivered first.
  const p2SkillId = reviewSkillIds[0];
  if (p2SkillId !== undefined) {
    slots.push(makeReviewSlot(graph, [p2SkillId], principleIdsForSkills([p2SkillId]), STANDARD_BAND, 'single', 2, now));
  }

  // P3 "the lesson before that": the second seed when present, else the last seed
  // when it differs from the first (so a short list still yields three), else
  // skipped rather than repeating P2.
  let p3SkillId: string | undefined;
  if (reviewSkillIds[1] !== undefined) {
    p3SkillId = reviewSkillIds[1];
  } else {
    const lastSkillId = reviewSkillIds[reviewSkillIds.length - 1];
    p3SkillId = lastSkillId !== undefined && lastSkillId !== reviewSkillIds[0] ? lastSkillId : undefined;
  }
  if (p3SkillId !== undefined) {
    slots.push(makeReviewSlot(graph, [p3SkillId], principleIdsForSkills([p3SkillId]), STANDARD_BAND, 'single', 2, now));
  }

  // P1 "all past concepts": the comprehensive synthesis, last because it is the
  // slowest to generate and verify.
  slots.push(makeReviewSlot(graph, p1SkillIds, principleIdsForSkills(p1SkillIds), SYNTHESIS_BAND, 'synthesis', 3, now));

  // Missing slots by identity: a slot is present when a prebuilt problem realizes
  // it (matched by planSlotIndex), so resume regenerates exactly what is absent
  // even for a non-prefix partial.
  const presentBySlot = new Map<number, Problem>();
  for (const problem of prebuilt) {
    if (typeof problem.planSlotIndex === 'number') {
      presentBySlot.set(problem.planSlotIndex, problem);
    }
  }
  const missingIndices = slots.map((_, index) => index).filter((index) => !presentBySlot.has(index));

  // A complete prebuilt set needs no plan and no generation.
  if (missingIndices.length === 0) {
    return { problems: assembleBySlot(slots.length, presentBySlot), failedSlotIndices: [] };
  }

  // Resume from a cached plan, else plan the whole set once and surface it so the
  // caller can persist it (resume regenerates the same problems, never a fresh set).
  let plans: ProblemPlan[];
  if (prebuiltPlan) {
    plans = prebuiltPlan;
  } else {
    const planSlots: PlanSlot[] = slots.map((slot) => ({
      skillIds: slot.skillIds,
      principleIds: slot.principleIds,
      difficultyBand: slot.band,
      kind: slot.kind,
      requireChain: slot.requireChain,
      targetMisconceptions: slot.targets,
    }));
    plans = await plan({ slots: planSlots, existingStatements: [], lessonTitle: module.title });
    onPlan?.(plans);
  }

  const plansBySlot = new Map(plans.map((entry) => [entry.slotIndex, entry]));
  // An incomplete plan is a planner-contract failure, so throw (whole-set, loud)
  // before generating rather than reporting it as a per-slot failure.
  for (const slotIndex of missingIndices) {
    if (!plansBySlot.has(slotIndex)) {
      throw new Error(`buildGeneratedReview: missing plan for slot ${slotIndex}`);
    }
  }

  // Generate the missing slots concurrently. Distinctness comes from the plan,
  // not from serial generation, and identity-based assembly makes concurrency
  // safe: a fulfilled slot streams + records the moment it resolves, a rejected
  // slot is collected below, and allSettled never rejects the batch.
  const generatedBySlot = new Map<number, Problem>();
  const settled = await Promise.allSettled(
    missingIndices.map(async (slotIndex) => {
      const slot = slots[slotIndex];
      const planned = plansBySlot.get(slotIndex)!;
      const result = await generate({
        skillIds: slot.skillIds,
        principleIds: slot.principleIds,
        difficultyBand: slot.band,
        requireChain: slot.requireChain,
        targetMisconceptions: slot.targets,
        description: planned.description,
        title: planned.title,
      });
      const problem = toProblem(result, slot, module.lessonId, slotIndex);
      generatedBySlot.set(slotIndex, problem);
      onProblem?.(problem);
      return problem;
    }),
  );

  // Report failures in slot order (deterministic) after the batch settles.
  const failedSlotIndices: number[] = [];
  settled.forEach((outcome, offset) => {
    if (outcome.status === 'rejected') {
      const slotIndex = missingIndices[offset];
      failedSlotIndices.push(slotIndex);
      onSlotError?.(slotIndex);
    }
  });

  const bySlot = new Map<number, Problem>([...presentBySlot, ...generatedBySlot]);
  return { problems: assembleBySlot(slots.length, bySlot), failedSlotIndices };
}
