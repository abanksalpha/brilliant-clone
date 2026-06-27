import { describe, expect, it } from 'vitest';
import { selectReviewNodes } from './reviewSelection';
import type { MisconceptionGraph, MisconceptionNode } from './misconceptionGraph';

const now = new Date('2026-02-01T00:00:00.000Z');

// A tracked node by default, lastSeen at `now` so its current strength equals
// its stored strength (no decay) unless a test overrides those fields.
function node(overrides: Partial<MisconceptionNode>): MisconceptionNode {
  return {
    id: 'mc:x',
    status: 'tracked',
    principleId: 'P',
    wrongBelief: 'W',
    specificNote: 'n',
    caught: 0,
    missed: 1,
    strength: 0.5,
    lastSeenISO: now.toISOString(),
    caughtDayStamps: [],
    createdISO: now.toISOString(),
    ...overrides,
  };
}

function graphOf(...nodes: MisconceptionNode[]): MisconceptionGraph {
  return Object.fromEntries(nodes.map((entry) => [entry.id, entry]));
}

describe('selectReviewNodes', () => {
  it('returns the weakest tracked node first', () => {
    const strong = node({ id: 'mc:strong', strength: 0.9 });
    const weak = node({ id: 'mc:weak', strength: 0.1 });
    const mid = node({ id: 'mc:mid', strength: 0.5 });
    const graph = graphOf(strong, weak, mid);

    const result = selectReviewNodes(graph, 3, now);

    expect(result.map((entry) => entry.id)).toEqual(['mc:weak', 'mc:mid', 'mc:strong']);
  });

  it('excludes notes and only reviews tracked nodes', () => {
    const tracked = node({ id: 'mc:tracked', status: 'tracked', strength: 0.6 });
    const note = node({ id: 'mc:note', status: 'note', strength: 0 });
    const graph = graphOf(tracked, note);

    const result = selectReviewNodes(graph, 5, now);

    expect(result.map((entry) => entry.id)).toEqual(['mc:tracked']);
  });

  it('respects count by returning at most that many nodes', () => {
    const a = node({ id: 'mc:a', strength: 0.1 });
    const b = node({ id: 'mc:b', strength: 0.2 });
    const c = node({ id: 'mc:c', strength: 0.3 });
    const graph = graphOf(a, b, c);

    const result = selectReviewNodes(graph, 2, now);

    expect(result.map((entry) => entry.id)).toEqual(['mc:a', 'mc:b']);
  });

  it('returns an empty array for a non-positive count', () => {
    const graph = graphOf(node({ id: 'mc:a', strength: 0.1 }));

    expect(selectReviewNodes(graph, 0, now)).toEqual([]);
    expect(selectReviewNodes(graph, -3, now)).toEqual([]);
  });

  it('breaks strength ties by earlier createdISO for stable ordering', () => {
    const later = node({
      id: 'mc:later',
      strength: 0.4,
      createdISO: '2026-02-01T00:00:00.000Z',
    });
    const earlier = node({
      id: 'mc:earlier',
      strength: 0.4,
      createdISO: '2026-01-01T00:00:00.000Z',
    });
    const graph = graphOf(later, earlier);

    const result = selectReviewNodes(graph, 2, now);

    expect(result.map((entry) => entry.id)).toEqual(['mc:earlier', 'mc:later']);
  });

  it('orders by decayed strength at now, not the stored value', () => {
    // Stored 0.9 but last seen two months ago decays far below a fresh 0.5.
    const stale = node({
      id: 'mc:stale',
      strength: 0.9,
      caught: 0,
      lastSeenISO: '2026-01-01T00:00:00.000Z',
    });
    const fresh = node({
      id: 'mc:fresh',
      strength: 0.5,
      caught: 0,
      lastSeenISO: '2026-03-01T00:00:00.000Z',
    });
    const graph = graphOf(stale, fresh);
    const later = new Date('2026-03-01T00:00:00.000Z');

    const result = selectReviewNodes(graph, 2, later);

    expect(result.map((entry) => entry.id)).toEqual(['mc:stale', 'mc:fresh']);
  });

  it('is deterministic for the same inputs and does not mutate the graph', () => {
    const a = node({ id: 'mc:a', strength: 0.3 });
    const b = node({ id: 'mc:b', strength: 0.1 });
    const c = node({ id: 'mc:c', strength: 0.2 });
    const graph = graphOf(a, b, c);
    const keysBefore = Object.keys(graph);

    const first = selectReviewNodes(graph, 3, now).map((entry) => entry.id);
    const second = selectReviewNodes(graph, 3, now).map((entry) => entry.id);

    expect(first).toEqual(['mc:b', 'mc:c', 'mc:a']);
    expect(second).toEqual(first);
    expect(Object.keys(graph)).toEqual(keysBefore);
  });
});
