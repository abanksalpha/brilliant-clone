// Phase 3 (generate-to-target review). selectReviewNodes is the first half of a
// producer that picks a student's weakest tracked nodes, calls the
// generateReviewProblem callable for each, and feeds the generated problems into
// ProblemPlayer. That producer is deploy-gated and not yet integrated: it has no
// caller in the app yet because wiring it needs a live deploy to verify the
// server-side OpenAI synthesis path. This module is pure selection logic only.

import { trackedNodes, type MisconceptionGraph, type MisconceptionNode } from './misconceptionGraph';
// currentStrength is defined in masteryModel (the graph module consumes it from
// there too). A MisconceptionNode is a structural superset of the mastery shape
// it reads, so a node can be scored directly.
import { currentStrength } from './masteryModel';

// Weakest first: the tracked nodes whose current strength is lowest, since those
// most need review. Ties break by earlier createdISO for stability. Returns up to
// `count` nodes. Pure and deterministic given `now`.
export function selectReviewNodes(
  graph: MisconceptionGraph,
  count: number,
  now: Date,
): MisconceptionNode[] {
  if (count <= 0) return [];

  return trackedNodes(graph)
    .sort((a, b) => {
      const byStrength = currentStrength(a, now) - currentStrength(b, now);
      if (byStrength !== 0) return byStrength;
      if (a.createdISO < b.createdISO) return -1;
      if (a.createdISO > b.createdISO) return 1;
      return 0;
    })
    .slice(0, count);
}
