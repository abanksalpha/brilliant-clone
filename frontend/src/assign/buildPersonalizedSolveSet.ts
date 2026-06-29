// Phase 5 ("Solve") builder: three hand-authored problems plus three problems
// generated on the fly for the individual learner. The authored three are a
// curated subset of the module's independentProblemIds and are always present;
// the generated three are personalized to the learner's tracked misconceptions
// in scope (two on the lesson topic, one chaining in a past concept).
//
// Two stages, both injected so this stays pure and unit-testable with stubs: a
// planner proposes one mutually-distinct description per generated slot (told the
// authored three so the generated problems never echo them), then a generator
// realizes each into a verified problem. There is NO fallback and NO template:
// the planner failing rejects the whole build, but a single generated slot
// failing is reported per-slot (failedSlotIndices) and never substituted.
// Authored ids must resolve (break-loud).
//
// Pure and deterministic given its inputs: it reads the static catalog and the
// passed progress, takes `now` explicitly, and injects the planner and generator
// rather than importing the runtime wrappers, so it can be unit tested without a
// live model call.

import { capScopePrinciples, principleIdsForSkills } from '../content';
import { getProblemById } from '../content/problems';
import type { Problem, ProblemKind, ProblemPlan } from '../content/problemSchema';
import type { LessonModule } from '../content/schema';
import { selectNodesForScope, type MisconceptionNode } from '../mastery/misconceptionGraph';
import type { DashboardProgress } from '../progress/dashboardProgress';
import type {
  PlanProblemSetInput,
  PlanSlot,
  PlannedProblemInput,
  PlannedProblemResult,
} from '../lib/grading';

// The injected backend boundaries. Mirror the planProblemSet / generatePlannedProblem
// wrappers in lib/grading; passing them in keeps this builder pure and testable.
export type Planner = (input: PlanProblemSetInput) => Promise<ProblemPlan[]>;
export type PlannedGenerator = (input: PlannedProblemInput) => Promise<PlannedProblemResult>;

// Per-slot outcomes: the full set (authored three plus the generated successes in
// slot order) and the indices of the generated slots whose generation failed all
// attempts. A planner failure rejects instead; a slot failure is reported here.
export type BuildResult = { problems: Problem[]; failedSlotIndices: number[] };

// Optional callbacks and resume inputs. `onPlan` surfaces a freshly-made plan so
// the caller can persist it; `onProblem` streams each problem as it resolves;
// `onSlotError` reports a generated slot whose generation failed; `prebuilt` /
// `prebuiltPlan` restore an already-built set on resume (matched by identity).
export type BuildOptions = {
  onProblem?: (problem: Problem) => void;
  onPlan?: (plans: ProblemPlan[]) => void;
  onSlotError?: (slotIndex: number) => void;
  prebuilt?: Problem[];
  prebuiltPlan?: ProblemPlan[];
};

// How many authored ids the front of the set is curated to.
const AUTHORED_COUNT = 3;
// The number of in-scope tracked misconception nodes a single generated problem
// can trap.
const TARGETS_PER_PROBLEM = 2;
const TOPIC_BAND = 4;
const SYNTHESIS_BAND = 5;
const UNIT_ID = 'electrostatics';
const STEP_COUNT = 4;

// A synthesis chains at most three principles, a focused slot at most two, and a
// synthesis whose chainable scope holds fewer than two principles generates
// focused rather than forcing an unverifiable chain.
const MAX_SYNTHESIS_PRINCIPLES = 3;
const MAX_FOCUSED_PRINCIPLES = 2;
const MIN_CHAIN_PRINCIPLES = 2;

type Target = { nodeId: string; principleId: string; wrongBelief: string };

// One generated slot before generation: its (bounded) scope, the band and kind it
// asks for, whether it must chain, the tracked misconceptions to trap, and (for
// the synthesis slot) the past principle to chain in.
type GenSlot = {
  kind: ProblemKind;
  skillIds: string[];
  principleIds: string[];
  difficultyBand: number;
  requireChain: boolean;
  targetMisconceptions: Target[];
  pastPrincipleIds?: string[];
};

/** Project tracked nodes into the public target shape the backend embeds as traps. */
function toTargets(nodes: MisconceptionNode[]): Target[] {
  return nodes.map((node) => ({
    nodeId: node.id,
    principleId: node.principleId,
    wrongBelief: node.wrongBelief,
  }));
}

/**
 * Assemble a full Problem from a verified generated result, matching the shape
 * the review builder produces: synthesis provenance, the statement as the prompt,
 * and the syn: id as the gradeId the backend resolves at grade time. A correct
 * solve later credits a catch on each entry of targetMisconceptionNodeIds. The
 * plan slot it realizes is recorded so resume and per-slot retry are by identity.
 */
function toProblem(slot: GenSlot, result: PlannedProblemResult, lessonId: string, slotIndex: number): Problem {
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
    targetMisconceptionNodeIds: result.targetMisconceptionNodeIds,
    gradeId: result.problemId,
    planSlotIndex: slotIndex,
  };
}

/** Collect the present generated problems in slot order, omitting absent slots. */
function assembleBySlot(slotCount: number, bySlot: Map<number, Problem>): Problem[] {
  const problems: Problem[] = [];
  for (let index = 0; index < slotCount; index += 1) {
    const problem = bySlot.get(index);
    if (problem) problems.push(problem);
  }
  return problems;
}

/**
 * Build the Phase 5 solve set for a lesson: the curated authored three (ready
 * instantly) followed by three personalized generated problems (two focused on
 * the lesson topic, one synthesis chaining a past concept). The authored three
 * are delivered first via onProblem so the player can start at once, then the
 * generated ones stream in as they resolve.
 *
 * Plan once for the three generated slots (told the authored three via
 * existingStatements so the generated problems never echo them), then generate
 * each missing slot CONCURRENTLY with Promise.allSettled. Each slot is
 * independent: a fulfilled slot streams via onProblem; a rejected slot is
 * reported via onSlotError and collected into failedSlotIndices; one slot's
 * failure never rejects the batch and is never substituted. The build rejects
 * only when the planner fails or an authored id cannot be resolved.
 *
 * Resumable by IDENTITY: pass the already-built problems as `prebuilt` and the
 * persisted descriptions as `prebuiltPlan`. The missing slots are exactly the
 * generated plan slots with no prebuilt problem (matched by planSlotIndex), so a
 * returning learner keeps the same generated problems and only the absent slots
 * regenerate, even for a non-prefix partial. The authored three are always
 * re-derived (free and deterministic). Only problems not already in `prebuilt`
 * are emitted via onProblem.
 */
export async function buildPersonalizedSolveSet(
  progress: DashboardProgress,
  module: LessonModule,
  now: Date,
  plan: Planner,
  generate: PlannedGenerator,
  options: BuildOptions = {},
): Promise<BuildResult> {
  const { onProblem, onPlan, onSlotError, prebuilt = [], prebuiltPlan } = options;

  // Authored three: always present. An unresolved id is a real authoring bug, so
  // throw rather than silently shrinking the set.
  const authored = module.independentProblemIds.slice(0, AUTHORED_COUNT).map((id) => {
    const problem = getProblemById(id);
    if (!problem) {
      throw new Error('unresolved authored problem id: ' + id);
    }
    return problem;
  });

  const graph = progress.misconceptionGraph;

  // Topic scope: the lesson's authored topic principles, falling back to whatever
  // principles the lesson's own problems exercise when none are declared. The two
  // topic problems are focused (requireChain false); the synthesis problem chains
  // the past concept below.
  const topicPrincipleIds =
    module.topicPrincipleIds && module.topicPrincipleIds.length >= 1
      ? module.topicPrincipleIds
      : principleIdsForSkills([module.lessonId]);

  // One past-concept principle to chain into the synthesis problem, taken from the
  // most recent review skill. Degrade to a pure topic synthesis when there is no
  // review skill or it resolves to a principle the topic already covers.
  const firstReviewSkill = module.reviewSkillIds[0];
  const candidatePastPrincipleId = firstReviewSkill
    ? principleIdsForSkills([firstReviewSkill])[0]
    : undefined;
  const pastPrincipleId =
    candidatePastPrincipleId !== undefined && !topicPrincipleIds.includes(candidatePastPrincipleId)
      ? candidatePastPrincipleId
      : undefined;

  // Topic targets and bounded topic scope (cap 2, weakest tracked nodes first).
  const topicTargets = toTargets(selectNodesForScope(graph, topicPrincipleIds, TARGETS_PER_PROBLEM, now));
  const topicPriority = [...new Set(topicTargets.map((target) => target.principleId))];
  const topicScope = capScopePrinciples(topicPrincipleIds, topicPriority, MAX_FOCUSED_PRINCIPLES);

  // The synthesis targets are drawn from the wider topic+past scope, but the
  // slot's own principleIds stay the bounded topic scope (the past principle is
  // chained in separately via pastPrincipleIds).
  const synthesisPrincipleIds = pastPrincipleId
    ? [...topicPrincipleIds, pastPrincipleId]
    : topicPrincipleIds;
  const synthesisTargets = toTargets(selectNodesForScope(graph, synthesisPrincipleIds, TARGETS_PER_PROBLEM, now));
  const synthesisPriority = [...new Set(synthesisTargets.map((target) => target.principleId))];
  // Reserve a cap slot for the chained-in past principle so the whole synthesis
  // chain (bounded topic scope + the one past principle) never exceeds
  // MAX_SYNTHESIS_PRINCIPLES. Without this the past principle leaks the chain to 4.
  const synthesisCap = MAX_SYNTHESIS_PRINCIPLES - (pastPrincipleId ? 1 : 0);
  const synthesisScope = capScopePrinciples(topicPrincipleIds, synthesisPriority, synthesisCap);
  const pastList = pastPrincipleId ? [pastPrincipleId] : [];
  // Chain floor: the synthesis only requires a chain when its bounded scope plus
  // the past principle reach MIN_CHAIN_PRINCIPLES; otherwise it generates focused.
  const synthesisRequireChain = new Set([...synthesisScope, ...pastList]).size >= MIN_CHAIN_PRINCIPLES;

  // The three generated slots in ramp order: two topic problems then the
  // synthesis problem. The synthesis chains the past principle only when one
  // survived the degrade check above.
  const topicSlot = (): GenSlot => ({
    kind: 'single',
    skillIds: [module.lessonId],
    principleIds: topicScope,
    difficultyBand: TOPIC_BAND,
    requireChain: false,
    targetMisconceptions: topicTargets,
  });

  const synthesisSlot: GenSlot = {
    kind: 'synthesis',
    skillIds: [module.lessonId],
    principleIds: synthesisScope,
    difficultyBand: SYNTHESIS_BAND,
    requireChain: synthesisRequireChain,
    targetMisconceptions: synthesisTargets,
    ...(pastPrincipleId ? { pastPrincipleIds: [pastPrincipleId] } : {}),
  };

  const slots: GenSlot[] = [topicSlot(), topicSlot(), synthesisSlot];

  // Missing slots by identity: a generated slot is present when a prebuilt problem
  // realizes it (matched by planSlotIndex). Authored problems carry no
  // planSlotIndex, so they are naturally excluded and always re-derived.
  const presentBySlot = new Map<number, Problem>();
  for (const problem of prebuilt) {
    if (typeof problem.planSlotIndex === 'number') {
      presentBySlot.set(problem.planSlotIndex, problem);
    }
  }

  // The authored three are ready instantly, so deliver them first (the player can
  // start at once). A problem already in prebuilt is not re-emitted: the caller
  // already has it from the restored cache.
  const prebuiltIds = new Set(prebuilt.map((problem) => problem.problemId));
  for (const problem of authored) {
    if (!prebuiltIds.has(problem.problemId)) onProblem?.(problem);
  }

  const missingIndices = slots.map((_, index) => index).filter((index) => !presentBySlot.has(index));

  // A complete resume needs no plan and no generation.
  if (missingIndices.length === 0) {
    return { problems: [...authored, ...assembleBySlot(slots.length, presentBySlot)], failedSlotIndices: [] };
  }

  // Resume from a cached plan, else plan the three generated slots once and
  // surface it so the caller can persist it. The planner is told the authored
  // three so the generated problems never echo them.
  let plans: ProblemPlan[];
  if (prebuiltPlan) {
    plans = prebuiltPlan;
  } else {
    const planSlots: PlanSlot[] = slots.map((slot) => ({
      skillIds: slot.skillIds,
      principleIds: slot.principleIds,
      difficultyBand: slot.difficultyBand,
      kind: slot.kind,
      requireChain: slot.requireChain,
      targetMisconceptions: slot.targetMisconceptions,
    }));
    plans = await plan({
      slots: planSlots,
      existingStatements: authored.map((problem) => problem.prompt),
      lessonTitle: module.title,
    });
    onPlan?.(plans);
  }

  const plansBySlot = new Map(plans.map((entry) => [entry.slotIndex, entry]));
  // An incomplete plan is a planner-contract failure, so throw (whole-set, loud)
  // before generating rather than reporting it as a per-slot failure.
  for (const slotIndex of missingIndices) {
    if (!plansBySlot.has(slotIndex)) {
      throw new Error(`buildPersonalizedSolveSet: missing plan for slot ${slotIndex}`);
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
        difficultyBand: slot.difficultyBand,
        requireChain: slot.requireChain,
        targetMisconceptions: slot.targetMisconceptions,
        ...(slot.pastPrincipleIds ? { pastPrincipleIds: slot.pastPrincipleIds } : {}),
        description: planned.description,
        title: planned.title,
      });
      const problem = toProblem(slot, result, module.lessonId, slotIndex);
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
  return { problems: [...authored, ...assembleBySlot(slots.length, bySlot)], failedSlotIndices };
}
