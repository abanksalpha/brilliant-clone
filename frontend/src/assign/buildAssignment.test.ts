import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock only the grading wrapper boundary: the composer reaches the backend for a
// review problem through generateReviewProblem, and these tests stand in for it.
vi.mock('../lib/grading', () => ({
  generateReviewProblem: vi.fn(),
}));

import { buildPostLessonAssignment, buildReviewAssignment, rehydrateAssignment } from './buildAssignment';
import { generateReviewProblem } from '../lib/grading';
import { EMPTY_PROGRESS } from '../progress/dashboardProgress';
import type { DashboardProgress } from '../progress/dashboardProgress';
import type { Problem } from '../content/problems';
import type { MisconceptionGraph, MisconceptionNode } from '../mastery/misconceptionGraph';

const now = new Date('2026-01-01T00:00:00.000Z');
const emptyProgress = EMPTY_PROGRESS;

function ids(problems: Problem[]): string[] {
  return problems.map((problem) => problem.problemId);
}

// A "full" problem is one ProblemPlayer can render: it carries a real prompt,
// not just an id projection.
function isFull(problem: Problem): boolean {
  return typeof problem.prompt === 'string' && problem.prompt.length > 0;
}

function trackedNode(id: string): MisconceptionNode {
  return {
    id,
    status: 'tracked',
    principleId: 'field-concept',
    wrongBelief: 'field falls off linearly with distance',
    specificNote: 'used 1/r instead of 1/r^2',
    caught: 0,
    missed: 2,
    strength: 0,
    lastSeenISO: now.toISOString(),
    caughtDayStamps: [],
    createdISO: now.toISOString(),
  };
}

function progressWithGraph(graph: MisconceptionGraph): DashboardProgress {
  return { ...EMPTY_PROGRESS, misconceptionGraph: graph };
}

beforeEach(() => {
  vi.mocked(generateReviewProblem).mockReset();
});

describe('buildPostLessonAssignment', () => {
  it('returns six full, unique problems with at least one generated variant for an empty graph', async () => {
    const problems = await buildPostLessonAssignment('coulombs-law', emptyProgress, now);

    expect(problems).toHaveLength(6);
    expect(problems.every(isFull)).toBe(true);
    expect(new Set(ids(problems)).size).toBe(problems.length);
    // Six exceeds the four authored problems, so the seam must generate variants.
    expect(problems.some((problem) => problem.provenance === 'variant')).toBe(true);
  });

  it('does not call the review generator and emits no review problems for an empty graph', async () => {
    const problems = await buildPostLessonAssignment('coulombs-law', emptyProgress, now);

    expect(generateReviewProblem).not.toHaveBeenCalled();
    expect(problems.every((problem) => problem.targetMisconceptionNodeId === undefined)).toBe(true);
  });

  it('is deterministic: the same arguments yield the same ids in the same order', async () => {
    const first = await buildPostLessonAssignment('coulombs-law', emptyProgress, now);
    const second = await buildPostLessonAssignment('coulombs-law', emptyProgress, now);

    expect(ids(first)).toEqual(ids(second));
  });

  it('emits a pending review placeholder for a tracked node, generating nothing up front', async () => {
    const graph = { 'mc:node1': trackedNode('mc:node1') };

    const problems = await buildPostLessonAssignment('coulombs-law', progressWithGraph(graph), now);

    // No model call happens while building: the placeholder is generated on
    // demand by the player when the student reaches it.
    expect(generateReviewProblem).not.toHaveBeenCalled();

    const review = problems.find((problem) => problem.targetMisconceptionNodeId === 'mc:node1');
    expect(review).toBeDefined();
    expect(review?.problemId).toBe('review:mc:node1');
    expect(review?.prompt).toBe('');
    expect(review?.pendingReview).toEqual({
      nodeId: 'mc:node1',
      wrongBelief: 'field falls off linearly with distance',
      principleId: 'field-concept',
      difficultyBand: 4,
    });
  });

  it('never calls the review generator while building, for either context', async () => {
    const graph = { 'mc:node1': trackedNode('mc:node1') };

    await buildPostLessonAssignment('coulombs-law', progressWithGraph(graph), now);
    await buildReviewAssignment(progressWithGraph(graph), now);

    expect(generateReviewProblem).not.toHaveBeenCalled();
  });
});

describe('buildReviewAssignment', () => {
  it('returns eight full, unique problems for an empty graph (single/synthesis only)', async () => {
    const problems = await buildReviewAssignment(emptyProgress, now);

    expect(problems).toHaveLength(8);
    expect(problems.every(isFull)).toBe(true);
    expect(new Set(ids(problems)).size).toBe(problems.length);
    expect(generateReviewProblem).not.toHaveBeenCalled();
    expect(problems.every((problem) => problem.targetMisconceptionNodeId === undefined)).toBe(true);
  });

  it('is deterministic: the same arguments yield the same ids in the same order', async () => {
    const first = await buildReviewAssignment(emptyProgress, now);
    const second = await buildReviewAssignment(emptyProgress, now);

    expect(ids(first)).toEqual(ids(second));
  });
});

describe('rehydrateAssignment', () => {
  const variantId = 'v1:cl-field-point-charge:q=0.000003;r=2';

  it('restores an authored problem from its id', () => {
    const problems = rehydrateAssignment(['cl-field-point-charge']);

    expect(problems).toHaveLength(1);
    expect(problems[0].problemId).toBe('cl-field-point-charge');
    expect(isFull(problems[0])).toBe(true);
  });

  it('re-derives a v1 variant problem from its id', () => {
    const problems = rehydrateAssignment([variantId]);

    expect(problems).toHaveLength(1);
    expect(problems[0].problemId).toBe(variantId);
    expect(problems[0].provenance).toBe('variant');
    expect(isFull(problems[0])).toBe(true);
  });

  it('drops ids that no longer resolve, including generated syn: review ids, instead of throwing', () => {
    expect(rehydrateAssignment(['v1:nope:x=1'])).toEqual([]);
    expect(rehydrateAssignment(['bogus'])).toEqual([]);
    // A generated review id cannot be rebuilt client-side, so it is skipped.
    expect(rehydrateAssignment(['syn:review-1'])).toEqual([]);
  });

  it('preserves order across a mix of authored, variant, and unresolvable ids', () => {
    const problems = rehydrateAssignment(['cl-field-point-charge', 'bogus', variantId]);

    expect(ids(problems)).toEqual(['cl-field-point-charge', variantId]);
  });

  it('rebuilds a review placeholder from the graph node so the player can regenerate it', () => {
    const graph = { 'mc:node1': trackedNode('mc:node1') };
    const problems = rehydrateAssignment(['review:mc:node1'], graph);

    expect(problems).toHaveLength(1);
    expect(problems[0].problemId).toBe('review:mc:node1');
    expect(problems[0].pendingReview?.nodeId).toBe('mc:node1');
  });

  it('drops a review placeholder when the graph is absent or the node is gone', () => {
    expect(rehydrateAssignment(['review:mc:node1'])).toEqual([]);
    expect(rehydrateAssignment(['review:mc:node1'], {})).toEqual([]);
  });
});
