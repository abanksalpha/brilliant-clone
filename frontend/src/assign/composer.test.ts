import { describe, expect, it } from 'vitest';
import { composeAssignment } from './composer';
import type { CandidateProblem, LearnerState, Slot } from './types';

const now = new Date('2026-01-01T00:00:00.000Z');

function makeCandidate(
  problemId: string,
  overrides: Partial<CandidateProblem> = {},
): CandidateProblem {
  return {
    problemId,
    skillIds: [],
    principleIds: [],
    misconceptionTags: [],
    kind: 'single',
    difficultyBand: 4,
    ...overrides,
  };
}

const emptyLearner: LearnerState = {
  misconceptionGraph: {},
  masteredSkillIds: [],
  recentProblemIds: [],
};

// A generator that must never run for a given test: failing it loudly proves
// the composer did not reach for generation when an authored candidate fit.
const neverGenerate = async (slot: Slot): Promise<CandidateProblem | null> => {
  throw new Error(`generateForSlot should not be called for ${slot.type}`);
};

function ids(assignment: CandidateProblem[]): string[] {
  return assignment.map((problem) => problem.problemId);
}

describe('composeAssignment matching', () => {
  it('fills a single slot with a matching single-kind candidate of the right band', async () => {
    const slots: Slot[] = [{ type: 'single', targetSkillId: 'S1', difficultyBand: 4 }];
    const candidates: CandidateProblem[] = [
      makeCandidate('synthesis', { skillIds: ['S1'], kind: 'synthesis' }),
      makeCandidate('wrongSkill', { skillIds: ['S2'], kind: 'single' }),
      makeCandidate('wrongBand', { skillIds: ['S1'], kind: 'single', difficultyBand: 2 }),
      makeCandidate('match', { skillIds: ['S1'], kind: 'single', difficultyBand: 4 }),
    ];

    const assignment = await composeAssignment({
      slots,
      candidates,
      learnerState: emptyLearner,
      now,
      generateForSlot: neverGenerate,
    });

    expect(ids(assignment)).toEqual(['match']);
  });
});

describe('composeAssignment misconception review', () => {
  it('fills a misconception-review slot from generateForSlot, ignoring authored candidates', async () => {
    const slots: Slot[] = [
      {
        type: 'misconception-review',
        targetMisconceptionNodeId: 'mc:weak',
        wrongBelief: 'wb',
        principleId: 'P',
        difficultyBand: 4,
      },
    ];
    // An authored candidate that is tagged for the node must still be ignored:
    // emergent nodes have no authored problems, so review slots always generate.
    const candidates: CandidateProblem[] = [makeCandidate('authored', { misconceptionTags: ['mc:weak'] })];
    const generated = makeCandidate('gen-review', { misconceptionTags: ['inverse-square-error'] });
    const seenTypes: Slot['type'][] = [];

    const assignment = await composeAssignment({
      slots,
      candidates,
      learnerState: emptyLearner,
      now,
      generateForSlot: async (slot) => {
        seenTypes.push(slot.type);
        return generated;
      },
    });

    expect(seenTypes).toEqual(['misconception-review']);
    expect(ids(assignment)).toEqual(['gen-review']);
  });

  it('throws when generateForSlot returns null for a review slot', async () => {
    const slots: Slot[] = [
      {
        type: 'misconception-review',
        targetMisconceptionNodeId: 'mc:weak',
        wrongBelief: 'wb',
        principleId: 'P',
        difficultyBand: 4,
      },
    ];

    await expect(
      composeAssignment({
        slots,
        candidates: [],
        learnerState: emptyLearner,
        now,
        generateForSlot: async () => null,
      }),
    ).rejects.toThrow('cannot fill slot: misconception-review');
  });
});

describe('composeAssignment exclusion', () => {
  it('excludes recentProblemIds and never repeats within one assignment', async () => {
    const learnerState: LearnerState = {
      misconceptionGraph: {},
      masteredSkillIds: [],
      recentProblemIds: ['recent'],
    };
    const slots: Slot[] = [
      { type: 'single', targetSkillId: 'S1', difficultyBand: 4 },
      { type: 'single', targetSkillId: 'S1', difficultyBand: 4 },
    ];
    const candidates: CandidateProblem[] = [
      makeCandidate('recent', { skillIds: ['S1'] }),
      makeCandidate('a', { skillIds: ['S1'] }),
      makeCandidate('b', { skillIds: ['S1'] }),
    ];

    const assignment = await composeAssignment({
      slots,
      candidates,
      learnerState,
      now,
      generateForSlot: neverGenerate,
    });
    const chosen = ids(assignment);

    expect(chosen).not.toContain('recent');
    expect(new Set(chosen).size).toBe(chosen.length);
    expect(chosen).toEqual(['a', 'b']);
  });
});

describe('composeAssignment interleaving', () => {
  it('avoids a shared principle between consecutive picks when an alternative exists', async () => {
    const slots: Slot[] = [
      { type: 'single', targetSkillId: 'S1', difficultyBand: 4 },
      { type: 'single', targetSkillId: 'S1', difficultyBand: 4 },
    ];
    const candidates: CandidateProblem[] = [
      makeCandidate('p1', { skillIds: ['S1'], principleIds: ['P'] }),
      makeCandidate('p2', { skillIds: ['S1'], principleIds: ['P'] }),
      makeCandidate('p3', { skillIds: ['S1'], principleIds: ['Q'] }),
    ];

    const assignment = await composeAssignment({
      slots,
      candidates,
      learnerState: emptyLearner,
      now,
      generateForSlot: neverGenerate,
    });

    expect(ids(assignment)).toEqual(['p1', 'p3']);
    const shared = assignment[1].principleIds.some((p) => assignment[0].principleIds.includes(p));
    expect(shared).toBe(false);
  });
});

describe('composeAssignment generation and failure', () => {
  it('calls generateForSlot when no candidate fits a single slot and uses its result', async () => {
    const slots: Slot[] = [{ type: 'single', targetSkillId: 'MISSING', difficultyBand: 4 }];
    const candidates: CandidateProblem[] = [makeCandidate('other', { skillIds: ['S1'] })];
    const generated = makeCandidate('generated', { skillIds: ['MISSING'] });
    let seenSlot: Slot | null = null;

    const assignment = await composeAssignment({
      slots,
      candidates,
      learnerState: emptyLearner,
      now,
      generateForSlot: async (slot) => {
        seenSlot = slot;
        return generated;
      },
    });

    expect(seenSlot).not.toBeNull();
    expect(ids(assignment)).toEqual(['generated']);
  });

  it('throws when a single slot cannot be filled and the generator yields null', async () => {
    const slots: Slot[] = [{ type: 'single', targetSkillId: 'MISSING', difficultyBand: 4 }];
    const candidates: CandidateProblem[] = [makeCandidate('other', { skillIds: ['S1'] })];

    await expect(
      composeAssignment({
        slots,
        candidates,
        learnerState: emptyLearner,
        now,
        generateForSlot: async () => null,
      }),
    ).rejects.toThrow('cannot fill slot: single');
  });

  it('throws when the generated candidate does not fit a synthesis slot', async () => {
    const slots: Slot[] = [{ type: 'synthesis', targetSkillId: 'S1', difficultyBand: 4 }];
    const candidates: CandidateProblem[] = [];
    const mismatched = makeCandidate('gen-single', { skillIds: ['S1'], kind: 'single' });

    await expect(
      composeAssignment({
        slots,
        candidates,
        learnerState: emptyLearner,
        now,
        generateForSlot: async () => mismatched,
      }),
    ).rejects.toThrow('cannot fill slot: synthesis');
  });

  it('uses a generated candidate that does fit a synthesis slot', async () => {
    const slots: Slot[] = [{ type: 'synthesis', targetSkillId: 'S1', difficultyBand: 4 }];
    const candidates: CandidateProblem[] = [];
    const fitting = makeCandidate('gen-synthesis', { skillIds: ['S1'], kind: 'synthesis' });

    const assignment = await composeAssignment({
      slots,
      candidates,
      learnerState: emptyLearner,
      now,
      generateForSlot: async () => fitting,
    });

    expect(ids(assignment)).toEqual(['gen-synthesis']);
  });
});
