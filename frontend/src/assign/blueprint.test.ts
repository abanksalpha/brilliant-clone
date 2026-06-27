import { describe, expect, it } from 'vitest';
import { chooseBlueprint } from './blueprint';
import type { LearnerState, Slot } from './types';
import type { MisconceptionGraph, MisconceptionNode } from '../mastery/misconceptionGraph';

const now = new Date('2026-01-01T00:00:00.000Z');

// A tracked node whose lastSeen is `now` and caught is 0, so currentStrength
// equals the stored strength (no decay). Defaults are overridable so a test can
// pin the id, strength, createdISO, principleId, and wrongBelief it cares about.
function trackedNode(overrides: Partial<MisconceptionNode> & { id: string }): MisconceptionNode {
  return {
    status: 'tracked',
    principleId: 'P',
    wrongBelief: 'belief',
    specificNote: 'note',
    caught: 0,
    missed: 2,
    strength: 0,
    lastSeenISO: now.toISOString(),
    caughtDayStamps: [],
    createdISO: now.toISOString(),
    ...overrides,
  };
}

function graphOf(nodes: MisconceptionNode[]): MisconceptionGraph {
  return Object.fromEntries(nodes.map((node) => [node.id, node]));
}

function typesOf(slots: Slot[], type: Slot['type']): Slot[] {
  return slots.filter((slot) => slot.type === type);
}

const emptyLearner: LearnerState = {
  misconceptionGraph: {},
  masteredSkillIds: [],
  recentProblemIds: [],
};

describe('chooseBlueprint post-lesson length', () => {
  it('scales length from 6 at the first skill to 18 at the last', () => {
    const first = chooseBlueprint({
      context: 'post-lesson',
      targetSkillId: 'S',
      skillCourseIndex: 0,
      totalSkills: 35,
      learnerState: emptyLearner,
      now,
    });
    const last = chooseBlueprint({
      context: 'post-lesson',
      targetSkillId: 'S',
      skillCourseIndex: 34,
      totalSkills: 35,
      learnerState: emptyLearner,
      now,
    });
    const middle = chooseBlueprint({
      context: 'post-lesson',
      targetSkillId: 'S',
      skillCourseIndex: 17,
      totalSkills: 35,
      learnerState: emptyLearner,
      now,
    });

    expect(first).toHaveLength(6);
    expect(last).toHaveLength(18);
    expect(middle.length).toBeGreaterThan(6);
    expect(middle.length).toBeLessThan(18);
    expect(middle).toHaveLength(12);
  });
});

describe('chooseBlueprint post-lesson synthesis gating', () => {
  it('emits zero synthesis slots when no skill is mastered, even late in the course', () => {
    const slots = chooseBlueprint({
      context: 'post-lesson',
      targetSkillId: 'S',
      skillCourseIndex: 34,
      totalSkills: 35,
      learnerState: emptyLearner,
      now,
    });

    expect(typesOf(slots, 'synthesis')).toHaveLength(0);
  });

  it('emits synthesis slots when a skill is mastered and the index is late', () => {
    const slots = chooseBlueprint({
      context: 'post-lesson',
      targetSkillId: 'S',
      skillCourseIndex: 34,
      totalSkills: 35,
      learnerState: { misconceptionGraph: {}, masteredSkillIds: ['S0'], recentProblemIds: [] },
      now,
    });

    const synthesis = typesOf(slots, 'synthesis');
    expect(synthesis.length).toBeGreaterThan(0);
    for (const slot of synthesis) {
      expect(slot.targetSkillId).toBe('S');
      expect(slot.difficultyBand).toBe(5);
    }
  });
});

describe('chooseBlueprint post-lesson misconception review', () => {
  it('emits misconception-review slots for the weakest tracked nodes, ascending strength, carrying node fields', () => {
    // Inserted strongest first to prove the blueprint sorts by current strength.
    const learnerState: LearnerState = {
      misconceptionGraph: graphOf([
        trackedNode({ id: 'mStrong', strength: 0.9, principleId: 'pStrong', wrongBelief: 'wbStrong' }),
        trackedNode({ id: 'mMid', strength: 0.5, principleId: 'pMid', wrongBelief: 'wbMid' }),
        trackedNode({ id: 'mWeak', strength: 0.1, principleId: 'pWeak', wrongBelief: 'wbWeak' }),
      ]),
      masteredSkillIds: [],
      recentProblemIds: [],
    };

    const slots = chooseBlueprint({
      context: 'post-lesson',
      targetSkillId: 'S',
      skillCourseIndex: 34,
      totalSkills: 35,
      learnerState,
      now,
    });

    const review = typesOf(slots, 'misconception-review');
    // length 18 -> min(3, floor(18/4)=4, 3 tracked) = 3 slots, weakest first.
    expect(review.map((slot) => slot.targetMisconceptionNodeId)).toEqual(['mWeak', 'mMid', 'mStrong']);
    expect(review.map((slot) => slot.wrongBelief)).toEqual(['wbWeak', 'wbMid', 'wbStrong']);
    expect(review.map((slot) => slot.principleId)).toEqual(['pWeak', 'pMid', 'pStrong']);
    for (const slot of review) {
      expect(slot.difficultyBand).toBe(4);
    }
  });

  it('breaks ties on equal current strength by createdISO ascending', () => {
    const learnerState: LearnerState = {
      misconceptionGraph: graphOf([
        trackedNode({ id: 'later', strength: 0.3, createdISO: '2026-01-02T00:00:00.000Z' }),
        trackedNode({ id: 'earlier', strength: 0.3, createdISO: '2026-01-01T00:00:00.000Z' }),
      ]),
      masteredSkillIds: [],
      recentProblemIds: [],
    };

    const slots = chooseBlueprint({
      context: 'post-lesson',
      targetSkillId: 'S',
      skillCourseIndex: 34,
      totalSkills: 35,
      learnerState,
      now,
    });

    const review = typesOf(slots, 'misconception-review');
    expect(review.map((slot) => slot.targetMisconceptionNodeId)).toEqual(['earlier', 'later']);
  });

  it('emits no misconception-review slots when there are no tracked nodes', () => {
    const noteOnly: MisconceptionNode = {
      id: 'mNote',
      status: 'note',
      principleId: 'P',
      wrongBelief: 'belief',
      specificNote: 'note',
      caught: 0,
      missed: 1,
      strength: 0,
      lastSeenISO: now.toISOString(),
      caughtDayStamps: [],
      createdISO: now.toISOString(),
    };

    const slots = chooseBlueprint({
      context: 'post-lesson',
      targetSkillId: 'S',
      skillCourseIndex: 34,
      totalSkills: 35,
      learnerState: { misconceptionGraph: graphOf([noteOnly]), masteredSkillIds: [], recentProblemIds: [] },
      now,
    });

    expect(typesOf(slots, 'misconception-review')).toHaveLength(0);
  });
});

describe('chooseBlueprint review', () => {
  it('emits 5 review slots when 5+ tracked nodes exist, weakest first, with node fields', () => {
    const learnerState: LearnerState = {
      misconceptionGraph: graphOf([
        trackedNode({ id: 'mC', strength: 0.4 }),
        trackedNode({ id: 'mA', strength: 0.05 }),
        trackedNode({ id: 'mE', strength: 0.8 }),
        trackedNode({ id: 'mD', strength: 0.7 }),
        trackedNode({ id: 'mB', strength: 0.2 }),
        trackedNode({ id: 'mF', strength: 0.95 }),
      ]),
      masteredSkillIds: ['S1', 'S2'],
      recentProblemIds: [],
    };

    const slots = chooseBlueprint({
      context: 'review',
      targetSkillId: 'IGNORED',
      learnerState,
      now,
    });

    expect(slots).toHaveLength(8);

    const review = typesOf(slots, 'misconception-review');
    // round(8 * 3 / 5) = 5 review slots, weakest first.
    expect(review.map((slot) => slot.targetMisconceptionNodeId)).toEqual(['mA', 'mB', 'mC', 'mD', 'mE']);
    for (const slot of review) {
      expect(slot.wrongBelief).toBe('belief');
      expect(slot.principleId).toBe('P');
      expect(slot.difficultyBand).toBe(4);
    }

    const synthesis = typesOf(slots, 'synthesis');
    expect(synthesis).toHaveLength(2);

    const singles = typesOf(slots, 'single');
    expect(singles).toHaveLength(1);

    // The anchor input is ignored in review: no slot is anchored to it.
    for (const slot of slots) {
      expect(slot.targetSkillId).not.toBe('IGNORED');
    }

    for (const slot of slots) {
      expect(slot.difficultyBand).toBe(slot.type === 'synthesis' ? 5 : 4);
    }
  });

  it('fills the shortfall with single slots when fewer than 5 tracked nodes exist', () => {
    const learnerState: LearnerState = {
      misconceptionGraph: graphOf([
        trackedNode({ id: 'mA', strength: 0.1 }),
        trackedNode({ id: 'mB', strength: 0.2 }),
        trackedNode({ id: 'mC', strength: 0.3 }),
      ]),
      masteredSkillIds: ['S1', 'S2'],
      recentProblemIds: [],
    };

    const slots = chooseBlueprint({ context: 'review', learnerState, now });

    expect(slots).toHaveLength(8);
    // 3 tracked nodes -> 3 review slots; the 2-slot shortfall becomes single.
    expect(typesOf(slots, 'misconception-review')).toHaveLength(3);
    expect(typesOf(slots, 'synthesis')).toHaveLength(2);
    expect(typesOf(slots, 'single')).toHaveLength(3);
  });
});
