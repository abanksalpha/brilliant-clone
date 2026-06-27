// Per student misconception graph. Pure and deterministic: every function takes
// the current time as an explicit Date, node ids derive from a stable hash of
// the signature, and nothing reads a global clock or uses Math.random. The graph
// grows from graded results: a conceptual miss leaves a note on first sight and
// promotes that note to a tracked misconception on the second matching miss,
// while spaced catches across distinct days build toward mastery.

import { MASTERY_STRENGTH_THRESHOLD, currentStrength } from './masteryModel';

export type NodeStatus = 'note' | 'tracked';

export type MisconceptionNode = {
  id: string;
  status: NodeStatus;
  principleId: string;
  wrongBelief: string;
  specificNote: string;
  caught: number;
  missed: number;
  strength: number; // stored retrievability at lastSeen, 0..1
  lastSeenISO: string;
  caughtDayStamps: string[]; // distinct local YYYY-MM-DD days a catch counted
  createdISO: string;
};

export type MisconceptionGraph = Record<string, MisconceptionNode>;

export type ConceptMatch = {
  matchedNodeId: string | null;
  principleId: string;
  wrongBelief: string;
  specificNote: string;
};

export type KnownMisconception = {
  id: string;
  principleId: string;
  wrongBelief: string;
};

/** On a catch, stored strength moves halfway toward 1 (mirrors masteryModel). */
const CATCH_GAIN = 0.5;

/** On a miss, stored strength is cut to this fraction (mirrors masteryModel). */
const MISS_RETENTION = 0.4;

/** Mastery requires catches spread across at least this many distinct days. */
const MASTERY_MIN_DISTINCT_DAYS = 3;

/**
 * A small deterministic FNV-1a 32 bit string hash rendered as zero padded hex.
 * Math.imul keeps the multiply in 32 bit space and `>>> 0` makes it unsigned,
 * so the same input always yields the same eight character digest.
 */
function hashString(input: string): string {
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193); // FNV prime
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Stable id for a misconception signature. Identical principleId + wrongBelief
 * pairs always map to the same id, so a grader that proposes a "new" miss for a
 * signature we already track dedupes onto the existing node.
 */
export function nodeIdFor(principleId: string, wrongBelief: string): string {
  return 'mc:' + hashString(principleId + '|' + wrongBelief);
}

/** Local calendar day as YYYY-MM-DD, using the machine local timezone. */
export function localDayStamp(now: Date): string {
  const year = now.getFullYear().toString().padStart(4, '0');
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** A graph with no nodes yet. */
export function emptyGraph(): MisconceptionGraph {
  return {};
}

/**
 * Every node mapped to its matchable signature. Notes are included alongside
 * tracked nodes because a note must be matchable to be promoted on a later miss.
 */
export function knownSignatures(graph: MisconceptionGraph): KnownMisconception[] {
  return Object.values(graph).map((node) => ({
    id: node.id,
    principleId: node.principleId,
    wrongBelief: node.wrongBelief,
  }));
}

/**
 * Record one conceptual miss and return a new graph (the input graph and its
 * nodes are never mutated). The target is the grader supplied matchedNodeId only
 * when that id actually exists in the graph; a provided id we do not track (a
 * grader slip) or a null id both fall back to the hashed signature id, so an
 * identical signature always dedupes onto the same node.
 *
 * Existing node: increment missed, refresh the specific note, set lastSeen to
 * now, decay stored strength by MISS_RETENTION, and promote a note to tracked
 * (this miss is its second matching sighting).
 *
 * New node: a fresh note with missed 1, caught 0, strength 0.
 */
export function applyConceptMiss(
  graph: MisconceptionGraph,
  match: ConceptMatch,
  now: Date,
): MisconceptionGraph {
  const targetId =
    match.matchedNodeId !== null && graph[match.matchedNodeId] !== undefined
      ? match.matchedNodeId
      : nodeIdFor(match.principleId, match.wrongBelief);
  const existing = graph[targetId];
  const nowISO = now.toISOString();

  if (existing) {
    const updated: MisconceptionNode = {
      ...existing,
      status: existing.status === 'note' ? 'tracked' : existing.status,
      specificNote: match.specificNote,
      missed: existing.missed + 1,
      strength: existing.strength * MISS_RETENTION,
      lastSeenISO: nowISO,
    };
    return { ...graph, [targetId]: updated };
  }

  const created: MisconceptionNode = {
    id: targetId,
    status: 'note',
    principleId: match.principleId,
    wrongBelief: match.wrongBelief,
    specificNote: match.specificNote,
    caught: 0,
    missed: 1,
    strength: 0,
    lastSeenISO: nowISO,
    caughtDayStamps: [],
    createdISO: nowISO,
  };
  return { ...graph, [targetId]: created };
}

/**
 * Record one catch against an existing node and return a new graph (immutable).
 * A catch on a missing node leaves the graph untouched. Strength moves halfway
 * toward 1, lastSeen advances, and the local day is recorded once per calendar
 * day so only spaced practice builds toward mastery.
 */
export function applyCatch(
  graph: MisconceptionGraph,
  nodeId: string,
  now: Date,
): MisconceptionGraph {
  const existing = graph[nodeId];
  if (!existing) return graph;

  const dayStamp = localDayStamp(now);
  const caughtDayStamps = existing.caughtDayStamps.includes(dayStamp)
    ? existing.caughtDayStamps
    : [...existing.caughtDayStamps, dayStamp];

  const updated: MisconceptionNode = {
    ...existing,
    caught: existing.caught + 1,
    strength: existing.strength + (1 - existing.strength) * CATCH_GAIN,
    lastSeenISO: now.toISOString(),
    caughtDayStamps,
  };
  return { ...graph, [nodeId]: updated };
}

/**
 * A tracked misconception counts as mastered once it has been caught on at least
 * MASTERY_MIN_DISTINCT_DAYS distinct days and its decayed strength right now is
 * at or above the shared mastery threshold. Notes are never mastered.
 */
export function isNodeMastered(node: MisconceptionNode, now: Date): boolean {
  return (
    node.status === 'tracked' &&
    node.caughtDayStamps.length >= MASTERY_MIN_DISTINCT_DAYS &&
    currentStrength(node, now) >= MASTERY_STRENGTH_THRESHOLD
  );
}

/** Every node that has been promoted to a tracked misconception. */
export function trackedNodes(graph: MisconceptionGraph): MisconceptionNode[] {
  return Object.values(graph).filter((node) => node.status === 'tracked');
}
