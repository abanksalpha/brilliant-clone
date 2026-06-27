// Slot filler. Walks a blueprint's slots in order and chooses a concrete
// problem for each. Single and synthesis slots prefer authored candidates of the
// right difficulty band, excluding recent and already-chosen problems and
// interleaving so consecutive picks avoid a shared principle; misconception
// review slots target emergent nodes with no authored problems, so they are
// filled by live generation. Asynchronous because that generation awaits the
// backend. Deterministic given its inputs: ties break by input order and there
// is no Math.random.
//
// No fallbacks: when a slot cannot be filled (nothing fits and the generator
// yields nothing or a mismatch), it throws rather than fabricating a problem.

import type { Assignment, CandidateProblem, LearnerState, Slot } from './types';

type ComposeParams = {
  slots: Slot[];
  candidates: CandidateProblem[];
  learnerState: LearnerState;
  now: Date;
  generateForSlot: (slot: Slot) => Promise<CandidateProblem | null>;
};

type Scored = {
  candidate: CandidateProblem;
  index: number;
};

/**
 * Whether an authored candidate is eligible to fill a slot. Misconception-review
 * slots target emergent nodes that have no authored problems, so no authored
 * candidate ever fits one; those slots are always filled by live generation.
 */
function fitsSlot(candidate: CandidateProblem, slot: Slot): boolean {
  if (slot.type === 'single') {
    return (
      candidate.kind === 'single' &&
      (!slot.targetSkillId || candidate.skillIds.includes(slot.targetSkillId))
    );
  }
  if (slot.type === 'synthesis') {
    return (
      candidate.kind === 'synthesis' &&
      (!slot.targetSkillId || candidate.skillIds.includes(slot.targetSkillId))
    );
  }
  return false;
}

function bandDistance(candidate: CandidateProblem, slot: Slot): number {
  return Math.abs(candidate.difficultyBand - slot.difficultyBand);
}

function sharesPrinciple(a: string[], b: string[]): boolean {
  return a.some((principle) => b.includes(principle));
}

/**
 * Pick the candidate for one slot from the already-sorted, eligible list. The
 * front-runner is the best fit; if it repeats a principle from the previous
 * pick, swap to the first equally-good alternative (tied on band match) that
 * introduces a fresh principle. If none is equally good, keep the front-runner.
 */
function pickWithInterleave(
  fitting: Scored[],
  slot: Slot,
  previousPrinciples: string[],
): CandidateProblem {
  const best = fitting[0];
  if (previousPrinciples.length === 0) return best.candidate;

  const bestDistance = bandDistance(best.candidate, slot);
  const equallyGood = fitting.filter((entry) => bandDistance(entry.candidate, slot) === bestDistance);
  const fresh = equallyGood.find(
    (entry) => !sharesPrinciple(entry.candidate.principleIds, previousPrinciples),
  );
  return (fresh ?? best).candidate;
}

/**
 * Compose an assignment by filling each slot in order. Asynchronous because a
 * misconception-review slot is filled by live generation against the backend.
 *
 * A misconception-review slot always generates: emergent nodes have no authored
 * problems, so the slot is filled by awaiting `generateForSlot` directly. For a
 * single or synthesis slot, eligible authored candidates are tried first, sorted
 * by closeness to the slot's difficulty band then by input order (stable), with
 * `recentProblemIds` and already-chosen ids skipped; only when none fit is
 * `generateForSlot` awaited, and its result must still pass `fitsSlot`.
 *
 * No fallbacks: when the chosen result is null (nothing fits and nothing could
 * be generated), it throws rather than fabricating a problem (break-loud).
 */
export async function composeAssignment(params: ComposeParams): Promise<Assignment> {
  const { slots, candidates, learnerState, generateForSlot } = params;

  const used = new Set<string>(learnerState.recentProblemIds);
  const assignment: Assignment = [];
  let previousPrinciples: string[] = [];

  for (const slot of slots) {
    let chosen: CandidateProblem | null = null;

    if (slot.type === 'misconception-review') {
      // Emergent nodes have no authored problems: always generate.
      chosen = await generateForSlot(slot);
    } else {
      const fitting: Scored[] = candidates
        .map((candidate, index) => ({ candidate, index }))
        .filter((entry) => !used.has(entry.candidate.problemId) && fitsSlot(entry.candidate, slot))
        .sort(
          (a, b) =>
            bandDistance(a.candidate, slot) - bandDistance(b.candidate, slot) || a.index - b.index,
        );

      if (fitting.length > 0) {
        chosen = pickWithInterleave(fitting, slot, previousPrinciples);
      } else {
        const generated = await generateForSlot(slot);
        // A generator must honor the same fit predicate as authored candidates;
        // a mismatched candidate is treated as none so the slot throws below.
        if (generated && fitsSlot(generated, slot)) {
          chosen = generated;
        }
      }
    }

    if (!chosen) {
      throw new Error(`cannot fill slot: ${slot.type}`);
    }

    assignment.push(chosen);
    used.add(chosen.problemId);
    previousPrinciples = chosen.principleIds;
  }

  return assignment;
}
