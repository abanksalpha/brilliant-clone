import { describe, expect, it, vi } from 'vitest';

import { buildGeneratedReview, type Planner, type PlannedGenerator } from './buildGeneratedReview';
import coulombsLaw from '../content/modules/coulombs-law';
import { capScopePrinciples, principleIdsForSkills } from '../content';
import type { LessonModule } from '../content/schema';
import type { ProblemPlan } from '../content/problemSchema';
import { EMPTY_PROGRESS } from '../progress/dashboardProgress';
import type { DashboardProgress } from '../progress/dashboardProgress';
import type { MisconceptionGraph, MisconceptionNode } from '../mastery/misconceptionGraph';
import type { PlanProblemSetInput, PlannedProblemInput, PlannedProblemResult } from '../lib/grading';

const now = new Date('2026-01-01T00:00:00.000Z');

// The principles each mechanics seed resolves to through the real catalog. The
// mapping is not 1:1 by name (skill mechanics-forces -> principle
// mechanics-newtons-laws), so these are pinned to what principleIdsForSkills
// actually returns for the Coulomb module's authored review seeds.
const NEWTONS_LAWS = 'mechanics-newtons-laws';
const ENERGY = 'mechanics-energy';
const KINEMATICS = 'mechanics-kinematics';
const MECHANICS_PRINCIPLES = [NEWTONS_LAWS, ENERGY, KINEMATICS];

/**
 * A stub generator that echoes its planned input into a verified-looking result.
 * The problemId folds in the band so two slots that share a scope still get
 * distinct ids. The title flows through from the plan. Deterministic, no network.
 */
function echoResult(input: PlannedProblemInput): PlannedProblemResult {
  return {
    problemId: `syn:${input.skillIds.join('-')}:${input.difficultyBand}`,
    statement: `S:${input.description}`,
    title: input.title,
    skillIds: input.skillIds,
    principleIds: input.principleIds,
    misconceptionTags: [],
    difficultyBand: input.difficultyBand,
    targetMisconceptionNodeIds: input.targetMisconceptions.map((target) => target.nodeId),
  };
}

function makeGenerator(): PlannedGenerator {
  return vi.fn(async (input: PlannedProblemInput) => echoResult(input));
}

// A stub planner that returns one distinct description per slot, in slot order.
function makePlanner(): Planner {
  return vi.fn(async (input: PlanProblemSetInput): Promise<ProblemPlan[]> =>
    input.slots.map((slot, index) => ({
      slotIndex: index,
      title: `Plan ${index} band ${slot.difficultyBand}`,
      description: `Plan desc ${index}`,
    })),
  );
}

function progressWith(overrides: Partial<DashboardProgress>): DashboardProgress {
  return { ...EMPTY_PROGRESS, ...overrides };
}

function moduleWith(overrides: Partial<LessonModule>): LessonModule {
  return { ...coulombsLaw, ...overrides };
}

// A tracked node at `now` so its decayed strength equals its stored strength,
// keeping the weakest-first ordering easy to reason about in the target tests.
function trackedNode(id: string, principleId: string, strength: number): MisconceptionNode {
  return {
    id,
    status: 'tracked',
    principleId,
    wrongBelief: `belief:${id}`,
    specificNote: 'note',
    caught: 0,
    missed: 2,
    strength,
    lastSeenISO: now.toISOString(),
    caughtDayStamps: [],
    createdISO: now.toISOString(),
  };
}

function graphOf(...nodes: MisconceptionNode[]): MisconceptionGraph {
  return Object.fromEntries(nodes.map((node) => [node.id, node]));
}

describe('buildGeneratedReview', () => {
  it('delivers P2/P3 single band 4 first, then the P1 synthesis band 5 last (fast first)', async () => {
    const { problems } = await buildGeneratedReview(EMPTY_PROGRESS, coulombsLaw, now, makePlanner(), makeGenerator());

    expect(problems).toHaveLength(3);
    const [p2, p3, p1] = problems;

    expect(p2.kind).toBe('single');
    expect(p2.difficultyBand).toBe(4);
    expect(p3.kind).toBe('single');
    expect(p3.difficultyBand).toBe(4);
    expect(p1.kind).toBe('synthesis');
    expect(p1.difficultyBand).toBe(5);

    // The synthesis (last) falls back to the authored review seeds (mechanics) with
    // no completed lessons; the single-topic slots come from the seeds in order.
    expect(p1.skillIds).toEqual(['mechanics-forces', 'mechanics-energy', 'mechanics-kinematics']);
    expect(p1.principleIds).toEqual(MECHANICS_PRINCIPLES);
    expect(p2.skillIds).toEqual(['mechanics-forces']);
    expect(p3.skillIds).toEqual(['mechanics-energy']);
  });

  it('shapes every slot as a verified synthesis Problem the player can render, tagged by plan slot', async () => {
    const { problems } = await buildGeneratedReview(EMPTY_PROGRESS, coulombsLaw, now, makePlanner(), makeGenerator());
    const single = problems[0];
    const synthesis = problems[problems.length - 1];

    expect(synthesis.provenance).toBe('synthesis');
    expect(synthesis.unitId).toBe('electrostatics');
    expect(synthesis.lessonId).toBe('coulombs-law');
    expect(synthesis.prompt.length).toBeGreaterThan(0);
    // The grade id is the generated syn: key, and it matches the public problemId.
    expect(synthesis.gradeId).toBe(synthesis.problemId);
    expect(synthesis.problemId.startsWith('syn:')).toBe(true);

    // The synthesis rung is multi part; the single-topic ones are not.
    expect(synthesis.difficultyFeatures.multiPart).toBe(true);
    expect(single.difficultyFeatures.multiPart).toBe(false);

    // No tracked nodes in scope means no trap.
    expect(synthesis.difficultyFeatures.hasTrap).toBe(false);
    expect(synthesis.targetMisconceptionNodeIds).toEqual([]);

    // Each generated problem records the plan slot it realizes, in display order.
    expect(problems.map((problem) => problem.planSlotIndex)).toEqual([0, 1, 2]);
  });

  it('plans the whole set once with the right (capped) slots, empty existingStatements, and lesson title', async () => {
    const plan = makePlanner();
    await buildGeneratedReview(EMPTY_PROGRESS, coulombsLaw, now, plan, makeGenerator());

    expect(plan).toHaveBeenCalledTimes(1);
    const input = plan.mock.calls[0][0];
    expect(input.existingStatements).toEqual([]);
    expect(input.lessonTitle).toBe("Coulomb's Law");
    expect(input.slots.map((slot) => slot.difficultyBand)).toEqual([4, 4, 5]);
    expect(input.slots.map((slot) => slot.kind)).toEqual(['single', 'single', 'synthesis']);
    expect(input.slots.map((slot) => slot.requireChain)).toEqual([false, false, true]);
    expect(input.slots[0].skillIds).toEqual(['mechanics-forces']);
    // The synthesis spans the three mechanics principles (cap 3, no priority).
    expect(input.slots[2].principleIds).toEqual(MECHANICS_PRINCIPLES);
    expect(input.slots.every((slot) => slot.principleIds.length <= 3)).toBe(true);
  });

  it('surfaces a freshly made plan via onPlan so the caller can persist it', async () => {
    let captured: ProblemPlan[] | null = null;
    await buildGeneratedReview(EMPTY_PROGRESS, coulombsLaw, now, makePlanner(), makeGenerator(), {
      onPlan: (plans) => {
        captured = plans;
      },
    });

    expect(captured).not.toBeNull();
    expect(captured!.map((plan) => plan.slotIndex)).toEqual([0, 1, 2]);
  });

  it('generates one problem per plan, with no avoid-list dedup', async () => {
    const generate = makeGenerator();
    await buildGeneratedReview(EMPTY_PROGRESS, coulombsLaw, now, makePlanner(), generate);

    expect(generate).toHaveBeenCalledTimes(3);
    const descriptions = generate.mock.calls.map((call) => call[0].description);
    expect(descriptions).toEqual(['Plan desc 0', 'Plan desc 1', 'Plan desc 2']);
    // The serial avoidStatements dedup is gone; distinctness is the planner's job.
    expect(generate.mock.calls.every((call) => !('avoidStatements' in call[0]))).toBe(true);
  });

  it('reports a single failed slot in failedSlotIndices while the others succeed, never throwing or substituting', async () => {
    // The synthesis slot (band 5) is down. With Promise.allSettled the two single
    // slots still succeed, the synthesis is reported per-slot, and nothing is
    // substituted to keep the set at three.
    const failingGen: PlannedGenerator = vi.fn(async (input: PlannedProblemInput) => {
      if (input.difficultyBand === 5) throw new Error('synthesis generation failed');
      return echoResult(input);
    });
    const emitted: string[] = [];
    const errored: number[] = [];

    const { problems, failedSlotIndices } = await buildGeneratedReview(
      EMPTY_PROGRESS,
      coulombsLaw,
      now,
      makePlanner(),
      failingGen,
      {
        onProblem: (problem) => emitted.push(problem.problemId),
        onSlotError: (slotIndex) => errored.push(slotIndex),
      },
    );

    expect(failedSlotIndices).toEqual([2]);
    expect(errored).toEqual([2]);
    expect(problems.map((problem) => problem.problemId)).toEqual(['syn:mechanics-forces:4', 'syn:mechanics-energy:4']);
    expect(problems.some((problem) => problem.kind === 'synthesis')).toBe(false);
    expect(emitted).toEqual(['syn:mechanics-forces:4', 'syn:mechanics-energy:4']);
  });

  it('resumes only the missing slots by identity, including a non-prefix partial, with no duplication', async () => {
    let captured: ProblemPlan[] = [];
    const { problems: full } = await buildGeneratedReview(EMPTY_PROGRESS, coulombsLaw, now, makePlanner(), makeGenerator(), {
      onPlan: (plans) => {
        captured = plans;
      },
    });
    expect(full).toHaveLength(3);

    // Keep slots 0 and 2, drop the middle (slot 1): a non-prefix partial.
    const prebuilt = full.filter((problem) => problem.planSlotIndex !== 1);
    const plan = makePlanner();
    const generate = makeGenerator();
    const emitted: string[] = [];

    const { problems: resumed, failedSlotIndices } = await buildGeneratedReview(
      EMPTY_PROGRESS,
      coulombsLaw,
      now,
      plan,
      generate,
      { prebuilt, prebuiltPlan: captured, onProblem: (problem) => emitted.push(problem.problemId) },
    );

    // Only slot 1 regenerates; slots 0 and 2 are reused, not re-emitted or duplicated.
    expect(plan).not.toHaveBeenCalled();
    expect(generate).toHaveBeenCalledTimes(1);
    expect(generate.mock.calls[0][0].description).toBe('Plan desc 1');
    expect(emitted).toEqual([full[1].problemId]);
    expect(resumed.map((problem) => problem.problemId)).toEqual(full.map((problem) => problem.problemId));
    expect(new Set(resumed.map((problem) => problem.problemId)).size).toBe(3);
    expect(failedSlotIndices).toEqual([]);
  });

  it('resumes from a prefix prebuilt + cached plan: regenerates only the missing slots, never re-planning', async () => {
    let captured: ProblemPlan[] = [];
    const { problems: full } = await buildGeneratedReview(EMPTY_PROGRESS, coulombsLaw, now, makePlanner(), makeGenerator(), {
      onPlan: (plans) => {
        captured = plans;
      },
    });

    const prebuilt = full.slice(0, 1);
    const plan = makePlanner();
    const generate = makeGenerator();
    const emitted: string[] = [];

    const { problems: resumed } = await buildGeneratedReview(EMPTY_PROGRESS, coulombsLaw, now, plan, generate, {
      prebuilt,
      prebuiltPlan: captured,
      onProblem: (problem) => emitted.push(problem.problemId),
    });

    expect(plan).not.toHaveBeenCalled();
    expect(generate).toHaveBeenCalledTimes(2);
    expect(resumed.map((problem) => problem.problemId)).toEqual(full.map((problem) => problem.problemId));
    expect(new Set(emitted)).toEqual(new Set(full.slice(1).map((problem) => problem.problemId)));
  });

  it('carries the planned title onto each generated problem', async () => {
    const plan: Planner = vi.fn(async (input: PlanProblemSetInput) =>
      input.slots.map((slot, index) => ({
        slotIndex: index,
        title: `Name ${slot.difficultyBand}-${index}`,
        description: `d${index}`,
      })),
    );

    const { problems } = await buildGeneratedReview(EMPTY_PROGRESS, coulombsLaw, now, plan, makeGenerator());

    expect(problems[0].title).toBe('Name 4-0');
    expect(problems[problems.length - 1].title).toBe('Name 5-2');
  });

  it('keeps the single-topic slots on a single natural principle and only chains the synthesis', async () => {
    const generate = makeGenerator();
    const { problems } = await buildGeneratedReview(EMPTY_PROGRESS, coulombsLaw, now, makePlanner(), generate);
    const [p2, p3, p1] = problems;

    // The synthesis (last) chains all three mechanics principles; the single-topic
    // slots (first two) stay on a single natural one.
    expect(p1.principleIds).toEqual(MECHANICS_PRINCIPLES);
    expect(p2.principleIds).toEqual([NEWTONS_LAWS]);
    expect(p3.principleIds).toEqual([ENERGY]);

    // Only the band-5 synthesis is told to chain; the single-topic slots are not.
    const inputs = generate.mock.calls.map((call) => call[0]);
    expect(inputs.find((input) => input.difficultyBand === 5)?.requireChain).toBe(true);
    expect(inputs.filter((input) => input.difficultyBand === 4).every((input) => input.requireChain === false)).toBe(true);
  });

  it('scopes the synthesis to the completed lessons (excluding this lesson), bounded by the cap', async () => {
    const progress = progressWith({
      completedLessonIds: ['coulombs-law', 'charging-conductors-insulators'],
    });

    const { problems } = await buildGeneratedReview(progress, coulombsLaw, now, makePlanner(), makeGenerator());
    const synthesis = problems[problems.length - 1];

    // The current lesson is excluded; the remaining completed lesson drives it.
    expect(synthesis.skillIds).toEqual(['charging-conductors-insulators']);
    // The synthesis principles are the scope capped to at most three (no tracked
    // nodes here, so the cap simply takes the first three in catalog order).
    const fullScope = principleIdsForSkills(['charging-conductors-insulators']);
    expect(synthesis.principleIds).toEqual(capScopePrinciples(fullScope, [], 3));
    expect(synthesis.principleIds.length).toBeLessThanOrEqual(3);
    expect(synthesis.principleIds.length).toBeGreaterThanOrEqual(2);

    // The single-topic slots still come from the authored review seeds.
    expect(problems[0].skillIds).toEqual(['mechanics-forces']);
    expect(problems[1].skillIds).toEqual(['mechanics-energy']);
  });

  it('selects per-scope traps weakest first, capped, and leads principleIds with those target principles', async () => {
    const graph = graphOf(
      trackedNode('mc:nl', NEWTONS_LAWS, 0.2),
      trackedNode('mc:en', ENERGY, 0.3),
      trackedNode('mc:kin', KINEMATICS, 0.1),
    );
    const progress = progressWith({ misconceptionGraph: graph });

    const { problems } = await buildGeneratedReview(progress, coulombsLaw, now, makePlanner(), makeGenerator());
    const [p2, p3, p1] = problems;

    // The synthesis spans all three mechanics principles (cap 3): weakest first.
    expect(p1.targetMisconceptionNodeIds).toEqual(['mc:kin', 'mc:nl', 'mc:en']);
    expect(p1.difficultyFeatures.hasTrap).toBe(true);
    // The capped principleIds lead with the weakest tracked-node principles.
    expect(p1.principleIds).toEqual([KINEMATICS, NEWTONS_LAWS, ENERGY]);

    // Each single-topic slot traps only the node in its own scope.
    expect(p2.targetMisconceptionNodeIds).toEqual(['mc:nl']);
    expect(p3.targetMisconceptionNodeIds).toEqual(['mc:en']);
  });

  it('passes the same per-slot traps to the planner and the generator', async () => {
    const graph = graphOf(trackedNode('mc:nl', NEWTONS_LAWS, 0.2));
    const plan = makePlanner();
    const generate = makeGenerator();

    await buildGeneratedReview(progressWith({ misconceptionGraph: graph }), coulombsLaw, now, plan, generate);

    // The P2 slot (band 4, NEWTONS_LAWS scope) carries the one in-scope trap in
    // both the plan request and the generation request.
    const planSlot = plan.mock.calls[0][0].slots[0];
    expect(planSlot.targetMisconceptions).toEqual([
      { nodeId: 'mc:nl', principleId: NEWTONS_LAWS, wrongBelief: 'belief:mc:nl' },
    ]);
    const genInput = generate.mock.calls.map((call) => call[0]).find((input) => input.skillIds[0] === 'mechanics-forces');
    expect(genInput?.targetMisconceptions).toEqual([
      { nodeId: 'mc:nl', principleId: NEWTONS_LAWS, wrongBelief: 'belief:mc:nl' },
    ]);
  });

  it('yields two problems when only one review seed exists (P3 skipped) and degrades a <2-principle synthesis to focused', async () => {
    const module = moduleWith({ reviewSkillIds: ['mechanics-forces'] });
    const plan = makePlanner();
    const generate = makeGenerator();

    const { problems } = await buildGeneratedReview(EMPTY_PROGRESS, module, now, plan, generate);

    expect(problems).toHaveLength(2);
    expect(problems.map((problem) => problem.kind)).toEqual(['single', 'synthesis']);
    expect(generate).toHaveBeenCalledTimes(2);
    expect(plan.mock.calls[0][0].slots).toHaveLength(2);

    // The synthesis scope is a single principle (mechanics-forces -> 1 principle),
    // below the chain floor, so it generates focused (requireChain false) instead
    // of forcing an unverifiable chain. Its kind stays synthesis.
    const synthSlot = plan.mock.calls[0][0].slots[1];
    expect(synthSlot.kind).toBe('synthesis');
    expect(synthSlot.principleIds).toEqual([NEWTONS_LAWS]);
    expect(synthSlot.requireChain).toBe(false);
    const synthGen = generate.mock.calls.map((call) => call[0]).find((input) => input.difficultyBand === 5);
    expect(synthGen?.requireChain).toBe(false);
  });

  it('streams each newly generated problem to onProblem as it resolves', async () => {
    const seen: string[] = [];
    const { problems } = await buildGeneratedReview(EMPTY_PROGRESS, coulombsLaw, now, makePlanner(), makeGenerator(), {
      onProblem: (problem) => {
        seen.push(problem.problemId);
      },
    });

    expect(new Set(seen)).toEqual(new Set(problems.map((problem) => problem.problemId)));
    expect(seen).toHaveLength(3);
  });

  it('rejects when the planner fails, surfacing the error to the caller', async () => {
    const plan: Planner = vi.fn(async () => {
      throw new Error('planner down');
    });

    await expect(buildGeneratedReview(EMPTY_PROGRESS, coulombsLaw, now, plan, makeGenerator())).rejects.toThrow(
      /planner down/,
    );
  });

  it('is deterministic: the same inputs yield the same ids in the same order', async () => {
    const { problems: first } = await buildGeneratedReview(EMPTY_PROGRESS, coulombsLaw, now, makePlanner(), makeGenerator());
    const { problems: second } = await buildGeneratedReview(EMPTY_PROGRESS, coulombsLaw, now, makePlanner(), makeGenerator());

    expect(first.map((problem) => problem.problemId)).toEqual(second.map((problem) => problem.problemId));
  });

  it('makes zero backend calls when the prebuilt set is already complete', async () => {
    const { problems: full } = await buildGeneratedReview(EMPTY_PROGRESS, coulombsLaw, now, makePlanner(), makeGenerator());
    const plan = makePlanner();
    const generate = makeGenerator();
    const emitted: string[] = [];

    const { problems: resumed, failedSlotIndices } = await buildGeneratedReview(EMPTY_PROGRESS, coulombsLaw, now, plan, generate, {
      prebuilt: full,
      onProblem: (problem) => emitted.push(problem.problemId),
    });

    expect(plan).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
    expect(emitted).toHaveLength(0);
    expect(resumed.map((problem) => problem.problemId)).toEqual(full.map((problem) => problem.problemId));
    expect(failedSlotIndices).toEqual([]);
  });
});
