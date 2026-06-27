import { describe, expect, it } from 'vitest';
import {
  applyCatch,
  applyConceptMiss,
  emptyGraph,
  isNodeMastered,
  knownSignatures,
  localDayStamp,
  nodeIdFor,
  trackedNodes,
} from './misconceptionGraph';
import type { ConceptMatch, MisconceptionNode } from './misconceptionGraph';

const now = new Date('2026-01-01T00:00:00.000Z');

function nullMatch(
  principleId: string,
  wrongBelief: string,
  specificNote: string,
): ConceptMatch {
  return { matchedNodeId: null, principleId, wrongBelief, specificNote };
}

describe('nodeIdFor', () => {
  it('is stable for the same inputs', () => {
    expect(nodeIdFor('P1', 'rise over run inverted')).toBe(
      nodeIdFor('P1', 'rise over run inverted'),
    );
  });

  it('prefixes ids with mc:', () => {
    expect(nodeIdFor('P1', 'belief A').startsWith('mc:')).toBe(true);
  });

  it('differs for a different wrongBelief', () => {
    expect(nodeIdFor('P1', 'belief A')).not.toBe(nodeIdFor('P1', 'belief B'));
  });

  it('differs for a different principleId', () => {
    expect(nodeIdFor('P1', 'belief A')).not.toBe(nodeIdFor('P2', 'belief A'));
  });
});

describe('localDayStamp', () => {
  it('formats a local date as YYYY-MM-DD with zero padding', () => {
    expect(localDayStamp(new Date(2026, 0, 5, 9, 30, 0))).toBe('2026-01-05');
    expect(localDayStamp(new Date(2026, 11, 31, 23, 0, 0))).toBe('2026-12-31');
  });
});

describe('emptyGraph', () => {
  it('is an empty record', () => {
    expect(emptyGraph()).toEqual({});
  });
});

describe('applyConceptMiss', () => {
  it('creates a note on the first miss of an unseen signature', () => {
    const graph = applyConceptMiss(emptyGraph(), nullMatch('P', 'W', 'first note'), now);
    const id = nodeIdFor('P', 'W');

    expect(Object.keys(graph)).toEqual([id]);
    expect(graph[id]).toEqual({
      id,
      status: 'note',
      principleId: 'P',
      wrongBelief: 'W',
      specificNote: 'first note',
      caught: 0,
      missed: 1,
      strength: 0,
      lastSeenISO: now.toISOString(),
      caughtDayStamps: [],
      createdISO: now.toISOString(),
    });
  });

  it('promotes a note to tracked on a second miss with the same matchedNodeId', () => {
    const first = applyConceptMiss(emptyGraph(), nullMatch('P', 'W', 'a'), now);
    const id = nodeIdFor('P', 'W');
    const second = applyConceptMiss(
      first,
      { matchedNodeId: id, principleId: 'P', wrongBelief: 'W', specificNote: 'b' },
      now,
    );

    expect(Object.keys(second)).toEqual([id]);
    expect(second[id].status).toBe('tracked');
    expect(second[id].missed).toBe(2);
  });

  it('promotes via the hashed id when the second miss has a null matchedNodeId (dedup safety net)', () => {
    const first = applyConceptMiss(emptyGraph(), nullMatch('P', 'W', 'a'), now);
    const id = nodeIdFor('P', 'W');
    expect(first[id].status).toBe('note');

    const second = applyConceptMiss(first, nullMatch('P', 'W', 'refreshed'), now);

    expect(Object.keys(second)).toEqual([id]);
    expect(second[id].status).toBe('tracked');
    expect(second[id].missed).toBe(2);
    expect(second[id].specificNote).toBe('refreshed');
  });

  it('decays stored strength by the miss retention on a repeat miss', () => {
    const first = applyConceptMiss(emptyGraph(), nullMatch('P', 'W', 'a'), now);
    const id = nodeIdFor('P', 'W');
    const caught = applyCatch(first, id, now); // strength 0 -> 0.5
    const second = applyConceptMiss(caught, nullMatch('P', 'W', 'b'), now);

    // stored 0.5 -> 0.5 * 0.4 = 0.2
    expect(second[id].strength).toBeCloseTo(0.2, 10);
  });

  it('keys an unknown matchedNodeId under the hashed signature so a later null match dedupes', () => {
    const ghost: ConceptMatch = {
      matchedNodeId: 'mc:ghost',
      principleId: 'P',
      wrongBelief: 'W',
      specificNote: 'first',
    };
    const id = nodeIdFor('P', 'W');

    expect(() => applyConceptMiss(emptyGraph(), ghost, now)).not.toThrow();

    // The provided id does not exist, so the new note lands under the hashed
    // signature id, not the unknown id the grader handed back.
    const first = applyConceptMiss(emptyGraph(), ghost, now);
    expect(first['mc:ghost']).toBeUndefined();
    expect(Object.keys(first)).toEqual([id]);
    expect(first[id].status).toBe('note');
    expect(first[id].missed).toBe(1);

    // A later null-match miss of the same signature promotes that same node,
    // with no duplicate created under a different id.
    const second = applyConceptMiss(first, nullMatch('P', 'W', 'second'), now);
    expect(Object.keys(second)).toEqual([id]);
    expect(second[id].status).toBe('tracked');
    expect(second[id].missed).toBe(2);
  });

  it('does not mutate the input graph or its nodes', () => {
    const first = applyConceptMiss(emptyGraph(), nullMatch('P', 'W', 'a'), now);
    const id = nodeIdFor('P', 'W');
    const beforeNode = first[id];

    const second = applyConceptMiss(
      first,
      { matchedNodeId: id, principleId: 'P', wrongBelief: 'W', specificNote: 'b' },
      now,
    );

    expect(second).not.toBe(first);
    expect(first[id]).toBe(beforeNode);
    expect(first[id].missed).toBe(1);
    expect(first[id].status).toBe('note');
  });
});

describe('applyCatch', () => {
  const day1morning = new Date(2026, 0, 1, 9, 0, 0);
  const day1afternoon = new Date(2026, 0, 1, 17, 0, 0);
  const day2 = new Date(2026, 0, 2, 9, 0, 0);

  function seededNote(): {
    graph: ReturnType<typeof emptyGraph>;
    id: string;
  } {
    const graph = applyConceptMiss(emptyGraph(), nullMatch('P', 'W', 'a'), day1morning);
    return { graph, id: nodeIdFor('P', 'W') };
  }

  it('increments caught, raises strength, and records one distinct day', () => {
    const { graph, id } = seededNote();
    const next = applyCatch(graph, id, day1morning);

    expect(next[id].caught).toBe(1);
    // stored 0 -> 0 + (1 - 0) * 0.5 = 0.5
    expect(next[id].strength).toBeCloseTo(0.5, 10);
    expect(next[id].caughtDayStamps).toEqual(['2026-01-01']);
    expect(next[id].lastSeenISO).toBe(day1morning.toISOString());
  });

  it('does not add a second day stamp for a same-day catch', () => {
    const { graph, id } = seededNote();
    const once = applyCatch(graph, id, day1morning);
    const twice = applyCatch(once, id, day1afternoon);

    expect(twice[id].caught).toBe(2);
    expect(twice[id].caughtDayStamps).toEqual(['2026-01-01']);
  });

  it('adds a new day stamp for a catch on a different local day', () => {
    const { graph, id } = seededNote();
    const once = applyCatch(graph, id, day1morning);
    const next = applyCatch(once, id, day2);

    expect(next[id].caughtDayStamps).toEqual(['2026-01-01', '2026-01-02']);
  });

  it('returns the graph unchanged for a missing node', () => {
    const graph = emptyGraph();
    expect(applyCatch(graph, 'mc:nope', day1morning)).toBe(graph);
  });

  it('does not mutate the input graph or its nodes', () => {
    const { graph, id } = seededNote();
    const beforeNode = graph[id];
    const next = applyCatch(graph, id, day1morning);

    expect(next).not.toBe(graph);
    expect(graph[id]).toBe(beforeNode);
    expect(graph[id].caught).toBe(0);
    expect(graph[id].caughtDayStamps).toEqual([]);
  });
});

describe('isNodeMastered', () => {
  function craft(overrides: Partial<MisconceptionNode>): MisconceptionNode {
    return {
      id: 'mc:x',
      status: 'tracked',
      principleId: 'P',
      wrongBelief: 'W',
      specificNote: 'n',
      caught: 3,
      missed: 1,
      strength: 1,
      lastSeenISO: now.toISOString(),
      caughtDayStamps: ['2026-01-01', '2026-01-02', '2026-01-03'],
      createdISO: now.toISOString(),
      ...overrides,
    };
  }

  it('is false for a note even when strong and well practiced', () => {
    expect(isNodeMastered(craft({ status: 'note' }), now)).toBe(false);
  });

  it('is false for a tracked node with fewer than three distinct catch days', () => {
    expect(
      isNodeMastered(craft({ caughtDayStamps: ['2026-01-01', '2026-01-02'] }), now),
    ).toBe(false);
  });

  it('is true for a tracked node with three distinct days and strength at the threshold', () => {
    expect(isNodeMastered(craft({ strength: 0.8 }), now)).toBe(true);
  });
});

describe('knownSignatures', () => {
  it('returns id, principleId, wrongBelief for both notes and tracked nodes', () => {
    let graph = applyConceptMiss(emptyGraph(), nullMatch('P1', 'W1', 'a'), now); // note
    graph = applyConceptMiss(graph, nullMatch('P2', 'W2', 'b'), now); // note
    graph = applyConceptMiss(graph, nullMatch('P2', 'W2', 'b2'), now); // tracked

    const id1 = nodeIdFor('P1', 'W1');
    const id2 = nodeIdFor('P2', 'W2');
    const byId = Object.fromEntries(knownSignatures(graph).map((s) => [s.id, s]));

    expect(Object.keys(byId).sort()).toEqual([id1, id2].sort());
    expect(byId[id1]).toEqual({ id: id1, principleId: 'P1', wrongBelief: 'W1' });
    expect(byId[id2]).toEqual({ id: id2, principleId: 'P2', wrongBelief: 'W2' });
  });
});

describe('trackedNodes', () => {
  it('returns only nodes with tracked status', () => {
    let graph = applyConceptMiss(emptyGraph(), nullMatch('P1', 'W1', 'a'), now); // note
    graph = applyConceptMiss(graph, nullMatch('P2', 'W2', 'b'), now); // note
    graph = applyConceptMiss(graph, nullMatch('P2', 'W2', 'b2'), now); // tracked

    const tracked = trackedNodes(graph);
    expect(tracked).toHaveLength(1);
    expect(tracked[0].id).toBe(nodeIdFor('P2', 'W2'));
    expect(tracked[0].status).toBe('tracked');
  });
});
