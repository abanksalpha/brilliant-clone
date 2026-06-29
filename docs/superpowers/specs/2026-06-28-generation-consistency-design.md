# Generation consistency: bounded scope, consensus verify, per-slot resilience

Date: 2026-06-28
Status: Draft design, pending review

## Problem

In lesson 2 the third review problem (the synthesis) never appears: the build gets
stuck on "Generating…" with no retry. The function logs show why. The synthesis slot
is scoped to chain FIVE principles
(`coulomb-force, superposition, field-concept, conductor-equilibrium,
mechanics-newtons-laws`, band 5, `requireChain`), and the dominant failure is:

```
synthesis verification failed: independent re-solve disagreed with the stated answer
```

The generator writes a genuine multi-step problem chaining all five; the single
independent verifier cannot reproduce the exact answer, so it is rejected three times
and the callable throws. Because generation is serial with no fallback, the earlier
slots already streamed and the build then threw on the synthesis, leaving a permanent
"Generating…" with no recovery.

Five concrete weaknesses (all evidence-backed):

1. **Scopes chain too many principles.** "All past concepts" expands to every principle
   of every past skill (5 for lesson 2); `coulombs-law` alone is 4. A correct,
   independently-verifiable chain of that length is nearly impossible. This is the
   dominant cause of "re-solve disagreed".
2. **"Focused" slots are not focused.** A band-4 `coulombs-law` slot (4 principles) also
   failed re-solve.
3. **The single verifier solve has no tolerance.** One flaky solve disagreeing rejects a
   correct problem; the previous majority-of-three absorbed that.
4. **One failed slot blocks the set.** Serial generation with no fallback throws the
   whole build on a single slot's failure; the missing slot is then stuck on
   "Generating…" with no retry or skip.
5. **Minor:** a band-5 slot with no tracked misconceptions still forces a fabricated
   distinct flaw, adding failure surface.

This design keeps the agent-planned pipeline (planner → generator → verifier, no
templates/fallbacks) and makes generation reliable and non-blocking.

## Goals

1. **Bound scope so problems verify.** A synthesis chains at most 3 principles; a focused
   slot at most 2. The chosen principles prioritize the learner's weakest tracked nodes
   in scope, then the scope's core principles.
2. **Tolerant verification.** The verifier solves up to 3 times and accepts on majority
   agreement; on no majority it regenerates, then fails loudly. No fallback.
3. **Per-slot resilience.** Slots generate independently: the ones that succeed render
   and are usable immediately; a slot that fails all attempts shows its own retry; the
   rest of the set is never blocked, and nothing is silently substituted.
4. **Identity-based resume/retry.** Each generated problem records the plan slot it
   realizes, so resume and per-slot retry regenerate exactly the missing slot from its
   persisted description (no duplication, no skipped slot, no stuck "Generating…").

## Non-goals

- No templates, fallbacks, or mocks return (the prior redesign holds). A failed slot is
  visibly retryable, never replaced by a stand-in.
- No change to the planner's role (still returns N distinct descriptions) beyond the
  smaller principle lists it now receives per slot.
- Worked examples, authored problems, and grading are untouched.

## Design

### 1. Bounded scope (frontend, pure)

New pure helper `frontend/src/content/index.ts`:

```ts
// Returns at most `cap` principle ids: the priority ones (the learner's weakest
// tracked-node principles, already in scope) first, then the rest of the scope in
// catalog order, deduped. Pure; order-stable.
export function capScopePrinciples(
  scopePrincipleIds: string[],
  priorityPrincipleIds: string[],
  cap: number,
): string[];
```

Constants (in the builders): `MAX_SYNTHESIS_PRINCIPLES = 3`, `MAX_FOCUSED_PRINCIPLES = 2`,
`MIN_CHAIN_PRINCIPLES = 2`.

Both builders, per slot:
- Select target nodes as today (`selectNodesForScope`, weakest-first, capped).
- `priorityPrincipleIds` = the distinct `principleId`s of those target nodes.
- `principleIds = capScopePrinciples(fullScopePrincipleIds, priorityPrincipleIds, cap)`
  where `cap` is `MAX_SYNTHESIS_PRINCIPLES` for a synthesis slot, else
  `MAX_FOCUSED_PRINCIPLES`.
- **Chain floor:** if a synthesis slot's capped list has fewer than `MIN_CHAIN_PRINCIPLES`
  (only possible for a near-empty scope), it generates as a focused slot
  (`requireChain: false`) rather than forcing an unverifiable chain.

Effect: lesson-2 synthesis drops from 5 principles to the 3 highest-priority; P2 drops
from 4 to 2. The problems stay multi-step and on-target but become verifiable.

This is the only change to what the planner and generator receive; both already accept a
`principleIds` array, so the prompts are unchanged.

### 2. Consensus verifier (backend)

`backend/functions/src/verifyProblem.ts`: restore majority consensus. The verifier solves
`resolveCount` times (default 3) and the stated answer must agree with a MAJORITY
(`floor(resolveCount / 2) + 1`). All other structural checks are unchanged (parseable
answer; `requireChain` ⇒ ≥2 principles; ≥1 distinct diagnosable flaw; distinct flaw wrong
answers). The solves run in parallel, so three solves cost roughly one solve of latency.

`synthesizePlannedProblem` keeps its retry loop (`GENERATION_ATTEMPTS`, bumped 3 → 4): an
attempt that fails the gate (or a no-majority verify) regenerates; after the last attempt
it throws. No fallback.

Cost: up to 4 attempts × (1 generate + 3 parallel solves). With the bounded scope most
problems pass on the first attempt, so the common cost is one generate + three parallel
solves.

### 3. Per-slot resilience + identity-based assembly (frontend)

**Identity.** Add `planSlotIndex?: number` to `Problem` (`content/problemSchema.ts`), set by
the builders to the plan slot a generated problem realizes. It is persisted in
`generatedSets` and validated by `coerceGeneratedSet` (optional finite integer). This makes
every persisted generated problem self-describe its slot, so assembly and resume are by
identity, not by array position or count.

**Builders** return per-slot outcomes instead of throwing on the first failure:

```ts
type BuildResult = { problems: Problem[]; failedSlotIndices: number[] };
```

- Plan once (or reuse the cached plan), as today.
- Compute the missing slot indices = plan slot indices with no problem already present
  (matched by `planSlotIndex`), so resume regenerates exactly what is absent.
- Generate the missing slots concurrently with `Promise.allSettled` (independent; one
  rejection never rejects the batch). Each fulfilled result → a `Problem` tagged with its
  `planSlotIndex` → `onProblem(problem)` (streamed + persisted). Each rejected slot →
  `onSlotError(slotIndex)` and is added to `failedSlotIndices`.
- The builder throws ONLY if the planner fails (a whole-set, loud failure). A slot
  failure is reported, never thrown.

**LessonSession** keeps a slot-indexed view of each set:
- On open: read `generatedPlans[key]` (N entries) and `generatedSets[key]` (successes).
  Build `bySlot: (Problem | undefined)[]` of length N by placing each success at its
  `planSlotIndex`. Show it immediately; call the builder to fill the gaps.
- `onProblem` places the problem at its `planSlotIndex`, updates `bySlot`, and persists
  the successes. `onSlotError` records the slot in a `failedSlots` set (component state,
  not persisted; on reload a failed slot is simply "missing" and regenerates).
- **Per-slot retry:** `retrySlot(slotIndex)` clears that slot from `failedSlots` and
  regenerates just that slot from the cached plan's description; on success it persists,
  on failure it re-marks it failed. (The whole-set retry/skip stays for a planner failure.)

**ProblemPlayer** renders N positions from `expectedTotal`/the plan length; each position is
one of: ready (the problem), generating (in flight), or failed (a retry control wired to
`onRetrySlot(slotIndex)`). The existing "Generating the next problem…" panel gains a failed
variant. This removes the stuck-forever state: a slot is always either ready, visibly
generating, or visibly retryable.

Because assembly and resume are now identity-based, generation can run concurrently again
(the earlier serial-in-slot-order workaround for count-based resume is no longer needed and
is removed).

### 4. Failure semantics (loud, non-blocking)

- **Planner fails:** whole-set error with retry (Review also "skip"). Loud.
- **A slot fails all attempts:** that slot shows a retry in place; every other slot remains
  usable. Loud per-slot, never silent, never substituted. Review's "skip" still advances
  the formative phase; Solve requires each generated slot to eventually succeed.

## Data model changes

- `Problem.planSlotIndex?: number` (optional finite integer), persisted in `generatedSets`,
  validated by `coerceGeneratedSet`.
- No change to `generatedPlans` (already `ProblemPlan[]` with `slotIndex`).
- `verifyProblem` `resolveCount` default 3 (majority).

## Data flow

1. Learner opens a phase. `LessonSession` reads the cached plan + successes, places each
   success at its `planSlotIndex`, and shows the slot-indexed view.
2. Builder plans (or reuses the plan), computes missing slots by identity, and generates
   them concurrently. Each slot: generator writes the problem (bounded principles);
   verifier solves 3× and must agree by majority; on pass it persists the `syn:` key and
   returns; on exhausting attempts the slot rejects.
3. Successes stream in at their slot positions and persist; failed slots surface a retry.
4. Resume/retry regenerates only the missing slots from their persisted descriptions.
5. A correct solve credits a catch on each `targetMisconceptionNodeIds` (unchanged).

## Edge cases

- **Scope with < 2 principles for a synthesis:** generate it focused (`requireChain: false`)
  rather than forcing an unverifiable chain.
- **No tracked misconceptions:** `priorityPrincipleIds` is empty, so the cap just takes the
  first `cap` core principles; generation still requires one unpinned flaw (unchanged).
- **All slots fail:** Review shows per-slot retries plus the skip affordance; nothing is
  fabricated. Solve shows the authored three plus per-slot retries for the generated ones.
- **Resume after a partial/failed build:** missing slots (by `planSlotIndex`) regenerate
  from the persisted plan; present ones are reused exactly. No duplicate, no skipped slot.
- **Corrupt cached `planSlotIndex`:** `coerceGeneratedSet` drops a malformed entry, so that
  slot is treated as missing and regenerates.

## Testing

- `capScopePrinciples`: priority-first ordering, dedupe, cap, scope-order fill; empty
  priority; cap larger than scope.
- Builders: each slot's `principleIds` is capped (synthesis ≤ 3, focused ≤ 2) and leads
  with the target-node principles; a synthesis whose capped scope has < 2 principles
  degrades to focused; `Promise.allSettled` so one slot rejecting yields
  `failedSlotIndices` with the others succeeding (no throw); each success carries the right
  `planSlotIndex`; resume regenerates only missing slots by identity (including a non-prefix
  partial) with no duplication.
- `verifyProblem`: majority-of-3 (2 agree → pass, 1 agrees → fail); structural checks
  unchanged.
- `dashboardProgress`: `planSlotIndex` round-trips and a malformed one is dropped.
- `ProblemPlayer`: a failed slot renders a retry that calls `onRetrySlot`; a ready slot
  renders the problem; the stuck-forever state is gone.
- `LessonSession`: per-slot retry regenerates a single slot and persists it; a planner
  failure still shows the whole-set retry.

## Files touched

**Backend**
- `verifyProblem.ts`: majority consensus (`resolveCount` 3) + test.
- `synthesis.ts`: `GENERATION_ATTEMPTS` 3 → 4.

**Frontend**
- `content/index.ts`: `capScopePrinciples` + test.
- `content/problemSchema.ts`: `planSlotIndex`.
- `progress/dashboardProgress.ts`: validate `planSlotIndex` in `coerceGeneratedSet` + test.
- `assign/buildGeneratedReview.ts`, `assign/buildPersonalizedSolveSet.ts`: bounded scope,
  `Promise.allSettled` per-slot generation, `planSlotIndex` tagging, `failedSlotIndices`,
  identity-based resume + tests.
- `components/lesson/LessonSession.tsx`: slot-indexed assembly, `onSlotError`, per-slot
  `retrySlot`, persistence by identity.
- `components/problem/ProblemPlayer.tsx`: failed-slot state + `onRetrySlot`.

## Risks

- **Verify cost/latency:** three solves per attempt (parallel, so ~one solve of latency) ×
  up to four attempts. The bounded scope makes first-attempt success the common case;
  durable plan + per-slot persistence avoid regeneration on resume.
- **Bounded scope drops a principle from a synthesis:** a "synthesis of all past concepts"
  now exercises the 3 highest-priority principles, not all of them. This is the intended
  trade for reliability; the choice prioritizes the learner's weakest tracked nodes, so the
  most useful principles are kept.
- **Player complexity:** three per-slot states (ready/generating/failed) add UI surface;
  contained to the existing progressive-reveal panel.
- **`planSlotIndex` on `Problem`:** an orchestration field on the content type. Optional and
  only set on generated problems; authored problems never carry it.
