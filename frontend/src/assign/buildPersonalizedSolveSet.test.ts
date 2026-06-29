import { describe, expect, it, vi } from 'vitest';

import { buildPersonalizedSolveSet, type Planner, type PlannedGenerator } from './buildPersonalizedSolveSet';
import coulombsLaw from '../content/modules/coulombs-law';
import { getProblemById } from '../content/problems';
import type { ProblemPlan } from '../content/problemSchema';
import { EMPTY_PROGRESS, type DashboardProgress } from '../progress/dashboardProgress';
import type { MisconceptionGraph, MisconceptionNode } from '../mastery/misconceptionGraph';
import type { PlanProblemSetInput, PlannedProblemInput, PlannedProblemResult } from '../lib/grading';

const now = new Date('2026-02-01T00:00:00.000Z');

// The curated authored front of Coulomb's Law, regardless of how many ids the
// module currently lists (the builder slices the first three).
const AUTHORED_IDS = coulombsLaw.independentProblemIds.slice(0, 3);
const AUTHORED_PROMPTS = AUTHORED_IDS.map((id) => getProblemById(id)!.prompt);

// A stub planner: one distinct description and title per generated slot, in slot
// order. The description doubles as the generated problem's id seed below, so a
// resume that replays the same plan reproduces the same problems.
function makePlanner(): Planner {
  return vi.fn(async (input: PlanProblemSetInput): Promise<ProblemPlan[]> =>
    input.slots.map((slot, index) => ({
      slotIndex: index,
      title: `Solve title ${index} band ${slot.difficultyBand}`,
      description: `solve-desc-${index}`,
    })),
  );
}

// A deterministic, echoing stand-in for the backend generator. The problemId is
// derived from the planned description (unique per slot by construction), so two
// identical topic scopes still get distinct ids and a resume reproduces them. It
// rejects on any description in `rejectDescriptions` to model a slot whose
// generation stays down (the builder must report it, never substitute).
function makeGenerator(rejectDescriptions: string[] = []): PlannedGenerator {
  return vi.fn(async (input: PlannedProblemInput): Promise<PlannedProblemResult> => {
    if (rejectDescriptions.includes(input.description)) {
      throw new Error(`generation failed: ${input.description}`);
    }
    return {
      problemId: `syn:${input.description}`,
      statement: `Statement for ${input.description}`,
      title: input.title,
      skillIds: input.skillIds,
      principleIds: input.principleIds,
      misconceptionTags: input.targetMisconceptions.map((target) => target.nodeId),
      difficultyBand: input.difficultyBand,
      targetMisconceptionNodeIds: input.targetMisconceptions.map((target) => target.nodeId),
    };
  });
}

function trackedNode(overrides: Partial<MisconceptionNode> & Pick<MisconceptionNode, 'id' | 'principleId'>): MisconceptionNode {
  return {
    status: 'tracked',
    wrongBelief: 'a wrong belief',
    specificNote: 'a specific note',
    caught: 0,
    missed: 2,
    strength: 0,
    lastSeenISO: now.toISOString(),
    caughtDayStamps: [],
    createdISO: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// One tracked node inside the lesson topic and one on the past (mechanics)
// principle the synthesis problem chains in. Equal (zero) strength, so selection
// order falls to createdISO: the coulomb node is older and sorts first.
const coulombNode = trackedNode({
  id: 'mc:coulomb',
  principleId: 'coulomb-force',
  wrongBelief: 'like charges attract',
  createdISO: '2026-01-01T00:00:00.000Z',
});
const mechNode = trackedNode({
  id: 'mc:mech',
  principleId: 'mechanics-newtons-laws',
  wrongBelief: 'net force is the larger push alone',
  createdISO: '2026-01-02T00:00:00.000Z',
});

const graph: MisconceptionGraph = { 'mc:coulomb': coulombNode, 'mc:mech': mechNode };

function progressWithGraph(misconceptionGraph: MisconceptionGraph): DashboardProgress {
  return { ...EMPTY_PROGRESS, misconceptionGraph };
}

describe('buildPersonalizedSolveSet', () => {
  it('always includes the curated authored three resolved from the bank', async () => {
    const { problems: set } = await buildPersonalizedSolveSet(
      progressWithGraph(graph),
      coulombsLaw,
      now,
      makePlanner(),
      makeGenerator(),
    );

    for (const id of AUTHORED_IDS) {
      const problem = set.find((entry) => entry.problemId === id);
      expect(problem).toBeDefined();
      expect(problem?.provenance).toBe('authored');
      expect(problem?.prompt.length).toBeGreaterThan(0);
    }
  });

  it('throws when an authored id cannot be resolved (break-loud)', async () => {
    const brokenModule = { ...coulombsLaw, independentProblemIds: ['cl-coulomb-net-2d', 'does-not-exist', 'cl-coulomb-equilibrium'] };

    await expect(
      buildPersonalizedSolveSet(progressWithGraph(graph), brokenModule, now, makePlanner(), makeGenerator()),
    ).rejects.toThrow('does-not-exist');
  });

  it('fires exactly three generated calls: two topic band 4 and one synthesis band 5 with a past principle', async () => {
    const generate = makeGenerator();

    await buildPersonalizedSolveSet(progressWithGraph(graph), coulombsLaw, now, makePlanner(), generate);

    expect(generate).toHaveBeenCalledTimes(3);
    const inputs = generate.mock.calls.map((args) => args[0]);
    const [topicA, topicB, synthesis] = inputs;

    for (const topic of [topicA, topicB]) {
      expect(topic.skillIds).toEqual(['coulombs-law']);
      expect(topic.principleIds).toEqual(['coulomb-force', 'superposition']);
      expect(topic.difficultyBand).toBe(4);
      expect(topic.pastPrincipleIds).toBeUndefined();
      // Topic problems are focused, not forced into a chain.
      expect(topic.requireChain).toBe(false);
      // Each generation carries its planned scenario.
      expect(topic.description.length).toBeGreaterThan(0);
      // Topic scope is bounded to at most two principles.
      expect(topic.principleIds.length).toBeLessThanOrEqual(2);
    }

    expect(synthesis.skillIds).toEqual(['coulombs-law']);
    // Bounded to at most three; the topic scope leads, the past principle is chained
    // in separately via pastPrincipleIds.
    expect(synthesis.principleIds).toEqual(['coulomb-force', 'superposition']);
    expect(synthesis.principleIds.length).toBeLessThanOrEqual(3);
    expect(synthesis.difficultyBand).toBe(5);
    expect(synthesis.pastPrincipleIds).toEqual(['mechanics-newtons-laws']);
    // The synthesis problem must chain the topic with the past concept.
    expect(synthesis.requireChain).toBe(true);
  });

  it('reserves cap room for the past principle so a 3-principle-topic synthesis still chains at most 3', async () => {
    // A lesson whose topic already fills the synthesis cap (3 principles), plus a
    // distinct chained-in past principle, would otherwise reach 4; the cap must
    // reserve a slot for the past principle so the whole chain stays at most 3.
    const moduleWith3Topic = {
      ...coulombsLaw,
      topicPrincipleIds: ['coulomb-force', 'superposition', 'field-concept'],
      reviewSkillIds: ['mechanics-forces'],
    };
    const generate = makeGenerator();

    await buildPersonalizedSolveSet(EMPTY_PROGRESS, moduleWith3Topic, now, makePlanner(), generate);

    const synthesis = generate.mock.calls.map((args) => args[0]).find((input) => input.requireChain);
    expect(synthesis).toBeDefined();
    expect(synthesis!.pastPrincipleIds).toEqual(['mechanics-newtons-laws']);
    // Topic scope reserved one slot for the past principle: 2 topic + 1 past = 3.
    expect(synthesis!.principleIds).toEqual(['coulomb-force', 'superposition']);
    const chainSize = synthesis!.principleIds.length + (synthesis!.pastPrincipleIds?.length ?? 0);
    expect(chainSize).toBeLessThanOrEqual(3);
  });

  it('plans the three generated slots once, telling the planner the authored three', async () => {
    const plan = makePlanner();

    await buildPersonalizedSolveSet(progressWithGraph(graph), coulombsLaw, now, plan, makeGenerator());

    expect(plan).toHaveBeenCalledTimes(1);
    const input = plan.mock.calls[0][0];
    expect(input.slots).toHaveLength(3);
    expect(input.slots.map((slot) => slot.difficultyBand)).toEqual([4, 4, 5]);
    expect(input.slots.map((slot) => slot.kind)).toEqual(['single', 'single', 'synthesis']);
    // The authored statements are passed so the generated three never echo them.
    expect(input.existingStatements).toEqual(AUTHORED_PROMPTS);
    expect(input.lessonTitle).toBe("Coulomb's Law");
  });

  it('delivers the authored three first, then the generated three', async () => {
    const { problems: set } = await buildPersonalizedSolveSet(
      progressWithGraph(graph),
      coulombsLaw,
      now,
      makePlanner(),
      makeGenerator(),
    );

    expect(set.map((entry) => entry.problemId)).toEqual([
      AUTHORED_IDS[0],
      AUTHORED_IDS[1],
      AUTHORED_IDS[2],
      'syn:solve-desc-0',
      'syn:solve-desc-1',
      'syn:solve-desc-2',
    ]);
  });

  it('tags each generated problem with its plan slot index and leaves the authored three untagged', async () => {
    const { problems: set } = await buildPersonalizedSolveSet(
      progressWithGraph(graph),
      coulombsLaw,
      now,
      makePlanner(),
      makeGenerator(),
    );

    expect(set.slice(0, 3).every((entry) => entry.planSlotIndex === undefined)).toBe(true);
    expect(set.slice(3).map((entry) => entry.planSlotIndex)).toEqual([0, 1, 2]);
  });

  it('builds generated problems in the synthesis shape with traps pulled from the graph', async () => {
    const { problems: set } = await buildPersonalizedSolveSet(
      progressWithGraph(graph),
      coulombsLaw,
      now,
      makePlanner(),
      makeGenerator(),
    );

    const genTopic = set[3];
    expect(genTopic.provenance).toBe('synthesis');
    expect(genTopic.kind).toBe('single');
    expect(genTopic.title).toBe('Solve title 0 band 4');
    expect(genTopic.difficulty).toBe(4);
    expect(genTopic.difficultyBand).toBe(4);
    expect(genTopic.gradeId).toBe('syn:solve-desc-0');
    expect(genTopic.prompt).toBe('Statement for solve-desc-0');
    expect(genTopic.unitId).toBe('electrostatics');
    expect(genTopic.difficultyFeatures.multiPart).toBe(false);
    expect(genTopic.difficultyFeatures.hasTrap).toBe(true);
    // Topic scope traps only the in-scope coulomb node.
    expect(genTopic.targetMisconceptionNodeIds).toEqual(['mc:coulomb']);

    const genSynthesis = set[5];
    expect(genSynthesis.kind).toBe('synthesis');
    expect(genSynthesis.title).toBe('Solve title 2 band 5');
    expect(genSynthesis.difficultyBand).toBe(5);
    expect(genSynthesis.difficultyFeatures.multiPart).toBe(true);
    // Synthesis scope widens to the past principle, so it also reaches the mechanics node.
    expect(genSynthesis.targetMisconceptionNodeIds).toEqual(['mc:coulomb', 'mc:mech']);
  });

  it('forwards each target node id, principle, and wrong belief as an embeddable trap', async () => {
    const generate = makeGenerator();

    await buildPersonalizedSolveSet(progressWithGraph(graph), coulombsLaw, now, makePlanner(), generate);

    const [topicA, , synthesis] = generate.mock.calls.map((args) => args[0]);

    expect(topicA.targetMisconceptions).toEqual([
      { nodeId: 'mc:coulomb', principleId: 'coulomb-force', wrongBelief: 'like charges attract' },
    ]);
    expect(synthesis.targetMisconceptions).toEqual([
      { nodeId: 'mc:coulomb', principleId: 'coulomb-force', wrongBelief: 'like charges attract' },
      { nodeId: 'mc:mech', principleId: 'mechanics-newtons-laws', wrongBelief: 'net force is the larger push alone' },
    ]);
  });

  it('reports a failed generated slot in failedSlotIndices while the others and the authored three succeed', async () => {
    // The second generated slot (solve-desc-1) stays down. With Promise.allSettled
    // the other two generated slots succeed, the authored three are present, and
    // nothing is substituted to keep the set at six.
    const generate = makeGenerator(['solve-desc-1']);
    const emitted: string[] = [];
    const errored: number[] = [];

    const { problems, failedSlotIndices } = await buildPersonalizedSolveSet(
      progressWithGraph(graph),
      coulombsLaw,
      now,
      makePlanner(),
      generate,
      { onProblem: (problem) => emitted.push(problem.problemId), onSlotError: (slotIndex) => errored.push(slotIndex) },
    );

    expect(failedSlotIndices).toEqual([1]);
    expect(errored).toEqual([1]);
    expect(problems.map((entry) => entry.problemId)).toEqual([
      ...AUTHORED_IDS,
      'syn:solve-desc-0',
      'syn:solve-desc-2',
    ]);
    // The authored three stream first, then the two surviving generated slots.
    expect(emitted).toEqual([...AUTHORED_IDS, 'syn:solve-desc-0', 'syn:solve-desc-2']);
  });

  it('rejects when the planner fails, surfacing the error to the caller', async () => {
    const plan: Planner = vi.fn(async () => {
      throw new Error('planner down');
    });

    await expect(
      buildPersonalizedSolveSet(progressWithGraph(graph), coulombsLaw, now, plan, makeGenerator()),
    ).rejects.toThrow(/planner down/);
  });

  it('passes a single declared topic principle through without widening (requireChain false)', async () => {
    const generate = makeGenerator();
    const singlePrincipleModule = { ...coulombsLaw, topicPrincipleIds: ['coulomb-force'] };

    await buildPersonalizedSolveSet(progressWithGraph(graph), singlePrincipleModule, now, makePlanner(), generate);

    const inputs = generate.mock.calls.map((args) => args[0]);
    for (const topic of [inputs[0], inputs[1]]) {
      expect(topic.principleIds).toEqual(['coulomb-force']);
      expect(topic.requireChain).toBe(false);
    }
  });

  it('degrades the synthesis to focused when its chainable scope has fewer than two principles', async () => {
    // A single topic principle and no past review skill leaves the synthesis with
    // a one-principle chainable scope, below the chain floor, so it generates
    // focused (requireChain false) rather than forcing an unverifiable chain.
    const module = { ...coulombsLaw, topicPrincipleIds: ['coulomb-force'], reviewSkillIds: [] };
    const generate = makeGenerator();

    await buildPersonalizedSolveSet(progressWithGraph(graph), module, now, makePlanner(), generate);

    const synthesis = generate.mock.calls.map((args) => args[0])[2];
    expect(synthesis.difficultyBand).toBe(5);
    expect(synthesis.principleIds).toEqual(['coulomb-force']);
    expect(synthesis.pastPrincipleIds).toBeUndefined();
    expect(synthesis.requireChain).toBe(false);
  });

  it('carries the planned title onto each generated problem', async () => {
    const { problems: set } = await buildPersonalizedSolveSet(
      progressWithGraph(graph),
      coulombsLaw,
      now,
      makePlanner(),
      makeGenerator(),
    );

    // The authored three come first; set[3] is the first generated topic problem
    // and set[5] is the synthesis. Titles come from the plan, not slot labels.
    expect(set[3].title).toBe('Solve title 0 band 4');
    expect(set[5].title).toBe('Solve title 2 band 5');
  });

  it('still generates lesson-topic problems with empty targets when no misconceptions are tracked', async () => {
    const generate = makeGenerator();

    const { problems: set } = await buildPersonalizedSolveSet(EMPTY_PROGRESS, coulombsLaw, now, makePlanner(), generate);

    expect(generate).toHaveBeenCalledTimes(3);
    for (const args of generate.mock.calls) {
      expect(args[0].targetMisconceptions).toEqual([]);
    }

    expect(set).toHaveLength(6);
    const generated = set.filter((entry) => entry.provenance === 'synthesis');
    expect(generated).toHaveLength(3);
    expect(generated.every((entry) => entry.difficultyFeatures.hasTrap === false)).toBe(true);
    expect(generated.every((entry) => (entry.targetMisconceptionNodeIds ?? []).length === 0)).toBe(true);

    // The synthesis problem still chains the past principle even with no traps.
    expect(generate.mock.calls[2][0].pastPrincipleIds).toEqual(['mechanics-newtons-laws']);
  });

  it('makes zero backend calls when the prebuilt solve set is already complete', async () => {
    const { problems: full } = await buildPersonalizedSolveSet(
      EMPTY_PROGRESS,
      coulombsLaw,
      now,
      makePlanner(),
      makeGenerator(),
    );
    expect(full).toHaveLength(6);

    const plan = makePlanner();
    const generate = makeGenerator();
    const emitted: string[] = [];

    const { problems: resumed, failedSlotIndices } = await buildPersonalizedSolveSet(
      EMPTY_PROGRESS,
      coulombsLaw,
      now,
      plan,
      generate,
      { prebuilt: full, onProblem: (problem) => emitted.push(problem.problemId) },
    );

    expect(plan).not.toHaveBeenCalled();
    expect(generate).not.toHaveBeenCalled();
    expect(emitted).toHaveLength(0);
    expect(resumed.map((problem) => problem.problemId)).toEqual(full.map((problem) => problem.problemId));
    expect(failedSlotIndices).toEqual([]);
  });

  it('resumes a partial solve set from prebuiltPlan: reuses what is present, generates only the rest', async () => {
    let captured: ProblemPlan[] = [];
    const { problems: full } = await buildPersonalizedSolveSet(
      EMPTY_PROGRESS,
      coulombsLaw,
      now,
      makePlanner(),
      makeGenerator(),
      { onPlan: (plans) => { captured = plans; } },
    );
    // Three authored plus one generated already cached (a mid-generation exit).
    const prebuilt = full.slice(0, 4);

    const plan = makePlanner();
    const generate = makeGenerator();
    const emitted: string[] = [];

    const { problems: resumed } = await buildPersonalizedSolveSet(EMPTY_PROGRESS, coulombsLaw, now, plan, generate, {
      prebuilt,
      prebuiltPlan: captured,
      onProblem: (problem) => emitted.push(problem.problemId),
    });

    // Resume reuses the cached plan (no re-plan) and generates only the two missing
    // generated slots; the authored three are re-derived for free.
    expect(plan).not.toHaveBeenCalled();
    expect(generate).toHaveBeenCalledTimes(2);
    expect(resumed).toHaveLength(6);
    // The leading four (three authored plus the cached generated one) are preserved.
    expect(resumed.slice(0, 4).map((problem) => problem.problemId)).toEqual(prebuilt.map((problem) => problem.problemId));
    // The resumed set reproduces the same ids as the original full build.
    expect(resumed.map((problem) => problem.problemId)).toEqual(full.map((problem) => problem.problemId));
    // Only the two newly generated problems are emitted; the caller already has prebuilt.
    expect(emitted).toHaveLength(2);
  });

  it('resumes only the missing generated slots by identity, including a non-prefix partial, with no duplication', async () => {
    let captured: ProblemPlan[] = [];
    const { problems: full } = await buildPersonalizedSolveSet(
      EMPTY_PROGRESS,
      coulombsLaw,
      now,
      makePlanner(),
      makeGenerator(),
      { onPlan: (plans) => { captured = plans; } },
    );

    // Keep authored plus generated slots 0 and 2; drop generated slot 1 (non-prefix).
    const prebuilt = full.filter((problem) => problem.planSlotIndex !== 1);
    const plan = makePlanner();
    const generate = makeGenerator();
    const emitted: string[] = [];

    const { problems: resumed, failedSlotIndices } = await buildPersonalizedSolveSet(
      EMPTY_PROGRESS,
      coulombsLaw,
      now,
      plan,
      generate,
      { prebuilt, prebuiltPlan: captured, onProblem: (problem) => emitted.push(problem.problemId) },
    );

    expect(plan).not.toHaveBeenCalled();
    expect(generate).toHaveBeenCalledTimes(1);
    expect(generate.mock.calls[0][0].description).toBe('solve-desc-1');
    expect(emitted).toEqual(['syn:solve-desc-1']);
    expect(resumed.map((problem) => problem.problemId)).toEqual(full.map((problem) => problem.problemId));
    expect(new Set(resumed.map((problem) => problem.problemId)).size).toBe(6);
    expect(failedSlotIndices).toEqual([]);
  });
});
