# Agent-planned problem generation (no templates, no fallbacks)

Date: 2026-06-28
Status: Draft design, pending review

## Problem

The on-the-fly surfaces (Phase 1 "Review", three problems; Phase 5 "Solve", three
authored + three generated) generate each slot with an independent backend call,
and when that call fails the gate the frontend silently substitutes a **template
variant** or an **authored problem**. There are only two Coulomb templates, and the
fallback was not dedup-aware, so two failed slots produced two near-identical
"Force between two point charges" problems. Templates and fallbacks are silent
degradations: they hide that generation failed and they manufacture duplicates.

This redesign removes every template and every fallback. Generated problems are
produced by a two-stage agent pipeline:

1. a **planner agent** that proposes a set of mutually-distinct, moderately-specific
   problem descriptions (so duplication is impossible by construction), then
2. a **generator subagent** per description that writes the full problem, checked by
   a **verifier subagent** that independently solves it and must agree.

Nothing is ever substituted. If a stage fails after its retries, the surface fails
loudly through the existing retry UI.

## Goals

1. **Zero templates, zero fallbacks, zero runtime mocks.** The only static problems
   are the hard-coded authored JSON problems (`frontend/src/content/problems/*.json`)
   that back worked examples, the Phase-1 review seeds, and the three authored Phase-5
   problems. No `v1:` variants, no template re-derivation, no authored backfill of a
   generated slot.
2. **A planner agent guarantees distinctness.** For a set it returns one description
   per generated slot; all are mutually distinct in scenario, objects, and quantities,
   and distinct from any authored problem already in the set.
3. **A generator + verifier subagent pair** turns one description and its scope into a
   verified problem: the verifier independently solves the statement and its answer
   must match the generator's, else the problem is regenerated (bounded attempts).
4. **Failure is loud, never silent.** If the planner fails, or a problem cannot be
   verified within its attempts, the surface surfaces an error with retry (Review also
   keeps "skip"). No template/authored substitution for a generated slot, ever. If the
   code breaks, it stops working visibly.
5. **Keep the streaming reveal, per-problem persistence, and resume** built earlier.
   The plan is persisted too, so resume regenerates only the missing problems from the
   same descriptions (identity and distinctness are preserved across a mid-set exit).

## Non-goals

- Worked examples (Phase 4), Inquiry, and Learn are untouched. Authored JSON problems
  and their backend static keys are untouched.
- The three authored Phase-5 problems stay hard-coded (a curated subset of each
  module's `independentProblemIds`); they are never generated.
- No new templates and no new authored problems are written.
- The verification gate's correctness checks are reused; this is not a rewrite of how
  a problem is judged correct, only of who does the independent solve (one verifier
  subagent instead of the majority-of-three re-solve) and what happens on failure
  (regenerate, then fail loudly — no fallback).

## Removal: the "zero templates / mocks" requirement

Everything below is deleted, not deprecated. Authored JSON problems and their static
backend keys remain.

**Frontend**

- `frontend/src/content/templates/index.ts` and `index.test.ts` (the whole folder):
  `PUBLIC_TEMPLATES`, `PublicSeedTemplate`, `TEMPLATE_TITLES`, `generateVariantProblem`,
  `drawParams`, `serializeVariantId`, `parseVariantId`, `getPublicTemplate`, `VARIANT_PREFIX`.
- `frontend/src/assign/buildAssignment.ts` (+ test), `frontend/src/assign/blueprint.ts`
  (+ test), `frontend/src/assign/composer.ts` (+ test): the unwired assignment/blueprint/
  composer system (template- and placeholder-based, only referenced by its own tests).
- `pickSolveFallback` in `buildPersonalizedSolveSet.ts` and `pickAuthoredFallback` in
  `buildGeneratedReview.ts`, plus `MAX_FALLBACK_DRAWS` and the template imports they use.
- The `ProblemPlayer` lazy `pendingReview` materialization path (the `generating` /
  `genError` on-demand generation triggered only by `buildAssignment` placeholders),
  and the `PendingReview` type + `Problem.pendingReview` field.
- `generateReviewProblem` wrapper in `frontend/src/lib/grading.ts` (unused after the
  pendingReview path is gone).
- `Problem.templateId` and the `'variant'` member of `Problem.provenance`
  (`frontend/src/content/problemSchema.ts`); provenance becomes `'authored' | 'synthesis'`.
- Legacy `Problem.targetMisconceptionNodeId` (single) — keep only `targetMisconceptionNodeIds`.
- `frontend/src/mastery/reviewSelection.ts` `selectReviewNodes` if it has no remaining
  caller after the pendingReview path is removed (confirm during implementation).

**Backend**

- `backend/functions/src/templates/` (the five `SeedTemplate` files + `index.ts` + tests)
  and `backend/functions/src/generateVariant.ts` (+ test).
- The `v1:` branch of `getProblemKey` in `backend/functions/src/problemKeys/index.ts`
  (`parseVariantId` / `generateVariant` use); authored static-key resolution stays.
- `serializeVariantId` / `parseVariantId` and `VARIANT_PREFIX` wherever they live in the
  backend.
- The `generateReviewProblem` and `generateSynthesisProblem` callables in
  `backend/functions/src/index.ts`, and `synthesizeForMisconception` / `synthesizeProblem`
  in `synthesis.ts` if they have no remaining caller after those callables are removed.

A grep for `template`, `variant`, `v1:`, `fallback`, `pendingReview`, and `pickSolve`/
`pickAuthored` must return only test-deletion hits and authored-JSON-unrelated matches
after this work. That grep is the acceptance check for goal 1.

## Design

The two stages are OpenAI calls, not OS processes. "Planner agent" is one call that
sees the whole set; each "subagent" is a call scoped to a single problem.

### 1. Stage 1 - the planner (backend callable `planProblemSet`)

`backend/functions/src/index.ts` - new callable `planProblemSet`. One model call,
no verification (descriptions are never graded), so it is fast and cheap.

```ts
// Input (public; no answers anywhere)
type PlanSlot = {
  skillIds: string[];          // scope, for the prompt
  principleIds: string[];      // principles this slot exercises/chains
  difficultyBand: number;      // 4 standard, 5 synthesis
  kind: 'single' | 'synthesis';
  requireChain: boolean;
  targetMisconceptions: { nodeId: string; principleId: string; wrongBelief: string }[];
};

type PlanProblemSetInput = {
  slots: PlanSlot[];           // one entry per generated slot, in display order
  existingStatements: string[];// authored problems already in the set, to avoid
  lessonTitle: string;         // light context for better descriptions
};

// Output
type ProblemPlan = {
  slotIndex: number;           // index back into the input slots
  title: string;               // a specific, descriptive name (not "Practice")
  description: string;         // 1-2 sentence moderately-specific scenario sketch
};
type PlanProblemSetResult = { plans: ProblemPlan[] };
```

`backend/functions/src/synthesis.ts` - new `buildPlannerPrompt(input)` and
`planProblemSet(input, apiKey)`:

- The prompt frames the model as designing a *set*: "Here are N AP Physics problem
  slots, each with a scope and the learner's misconceptions to target. Propose one
  DISTINCT problem for each slot. Output a short scenario sketch and a specific title
  per slot - not the full problem, not the answer. All N must differ from each other
  in scenario, objects, given quantities, and what is asked, and must differ from
  these problems already in the set: [existingStatements]. Avoid clichés (no repeated
  inclined planes); vary the physical setup across the set." The synthesis slot's
  description must genuinely chain its principles.
- Returns exactly `slots.length` plans, one per `slotIndex`. Wrong count, missing
  index, or empty description throws (`response_format: json_object`, parsed strictly
  like `parseSynthesisResponse`). Break-loud: a malformed plan is never repaired.
- The planner does **not** assign misconceptions or scope; those come from the
  frontend per slot and are passed through unchanged to Stage 2.

### 2. Stage 2 - generator + verifier (backend callable `generatePlannedProblem`)

`generatePlannedProblem` replaces `generateScopedProblem`. It adds the planned
description/title and changes verification from majority-of-three re-solve to a single
verifier subagent that must agree.

```ts
type PlannedProblemInput = {
  skillIds: string[];
  principleIds: string[];
  difficultyBand: number;
  requireChain: boolean;
  targetMisconceptions: { nodeId: string; principleId: string; wrongBelief: string }[];
  pastPrincipleIds?: string[];
  description: string;         // the planned scenario this problem must realize
  title: string;               // the planned title (carried onto the Problem)
};

type PlannedProblemResult = {
  problemId: string;           // "syn:" + hash(statement)
  statement: string;
  title: string;
  skillIds: string[];
  principleIds: string[];
  misconceptionTags: string[];
  difficultyBand: number;
  targetMisconceptionNodeIds: string[];
};
```

Pipeline (`synthesizePlannedProblem`, up to `GENERATION_ATTEMPTS = 3`):

1. **Generator subagent.** OpenAI call with `buildPlannedProblemPrompt` (the existing
   scoped-synthesis prompt, plus "realize exactly this scenario: <description>" and
   "use this title: <title>"). Produces statement, correctSolution, finalAnswer,
   rubric, flaws, skillIds, principleIds, misconceptionTags, difficultyBand. Parsed by
   the existing `parseSynthesisResponse`.
2. **Verifier subagent + structural gate** (`verifyProblem`, refactored):
   - Structural checks unchanged: parseable `finalAnswer`; `requireChain` => >= 2
     principles; >= 1 flaw with a non-empty `misconceptionId`; each flaw's wrong answer
     parseable, distinct from the correct answer, and distinct from the other flaws.
   - Correctness: **one** independent verifier solve (`openAiSolve`, which sees only the
     statement) must `answersAgree` with the generator's `finalAnswer` (existing 2%
     tolerance, LaTeX/markdown-tolerant unit normalization). The `resolveCount`/majority
     logic is replaced by this single agreement check (`verifyProblem` keeps the same
     signature; `resolveCount` defaults to 1).
3. **On pass:** persist via `saveSynthesisProblem(toProblemKey(candidate))`, return the
   public fields + `title` + `targetMisconceptionNodeIds` (the requested `nodeId`s whose
   belief survived as a declared flaw).
4. **On fail:** retry from step 1 (a fresh generation for the same description). After
   `GENERATION_ATTEMPTS` failures, throw (`HttpsError('internal', ...)`, logged via
   `logger.error` so the reason is visible). No fallback, no substitution.

No change to `synthesisStore`, `keyResolver` for `syn:` ids, or grading: a `syn:` id
resolves to its persisted key at grade time as today.

### 3. Frontend orchestration (two-step, parallel, streaming)

Both builders become: compute slots -> plan once -> generate each planned problem.
Because the planner guarantees distinct descriptions, generation runs **in parallel**
again (the serial `avoidStatements` dedup is no longer needed and is removed); each
result still streams in via `onProblem` and is persisted as it arrives.

`frontend/src/lib/grading.ts`: add `planProblemSet(input)` and `generatePlannedProblem(input)`
wrappers; remove `generateScopedProblem` and `generateReviewProblem`.

`buildGeneratedReview(progress, module, now, plan, generate, onProblem?, prebuilt?, prebuiltPlan?)`:

- Compute the P2/P3/P1 slots and their target nodes exactly as today.
- If `prebuiltPlan` is present (resume), use it; else call `plan({ slots, existingStatements: [], lessonTitle })`.
- For each slot whose problem is not already in `prebuilt`, call
  `generate({ ...slotScope, description, title })` in parallel; stream + persist each.
- Reuse already-built problems from `prebuilt` for their slots (resume), emit only new.

`buildPersonalizedSolveSet(progress, module, now, plan, generate, onProblem?, prebuilt?, prebuiltPlan?)`:

- Resolve the three authored problems (`getProblemById`, break-loud) and the three
  generated slots (2 topic, 1 synthesis) as today.
- Plan with `existingStatements = authoredThree.map(p => p.prompt)` so the generated
  three never echo the authored three. Reuse `prebuiltPlan` on resume.
- Emit the authored three instantly; generate the three planned problems in parallel;
  stream + persist each.

`plan` and `generate` are injected (like the current `ScopedGenerator`) so both
builders stay pure and unit-testable with stubs; the live model call is a deploy-gated
seam.

### 4. Persistence (plan + problems)

- `frontend/src/progress/dashboardProgress.ts`: add
  `generatedPlans: Record<string, ProblemPlan[]>` beside the existing
  `generatedSets: Record<string, Problem[]>`, keyed the same
  (`${lessonId}:review:v6`, `${lessonId}:solve:v6`). Add `normalizeGeneratedPlans`
  (drop malformed entries, like the other normalizers), include it in `EMPTY_PROGRESS`,
  `normalizeProgress`, `toDocument` (`cloudStore.ts`), and the firestore rules
  allow-list/size guard.
- `ProgressContext`: add `getGeneratedPlan(key)` / `saveGeneratedPlan(key, plans)`
  beside the existing generated-set getter/setter.
- `LessonSession`: on a set's first open, read the cached plan and problems. If a plan
  is cached, skip planning and resume; else plan, persist the plan, then generate.
  Persisting the plan is what makes resume regenerate the *same* missing problems
  rather than re-planning into a different set.
- Bump the cache version (`:v5` -> `:v6`) since the cached shape now pairs with a plan.

### 5. Failure (loud, no fallback)

- **Planner fails** (model error, wrong count, malformed): the builder rejects;
  `LessonSession` shows the existing set-level error with retry (Review also "skip").
- **A generated problem fails** all attempts: its slot stays in the existing
  "Generating..."/error state with a retry; the set is never completed with a
  substitute. Review keeps the "skip review" affordance (formative). Solve renders the
  authored three and surfaces a retry for the failed generated slot (no substitute);
  this can block set completion, which is the intended loud behavior. Solve gets no
  "skip" (only Review does), so a generated Solve problem must succeed to finish the set.
- No code path returns a template or authored problem in place of a generated one.

### 6. Data-model changes (summary)

- `Problem.provenance`: `'authored' | 'synthesis'` (drop `'variant'`).
- Remove `Problem.templateId`, `Problem.pendingReview`, `PendingReview`,
  `Problem.targetMisconceptionNodeId`.
- Add `ProblemPlan` type (shared shape: `{ slotIndex, title, description }`).
- `DashboardProgress.generatedPlans` added; `generatedSets` unchanged in shape.

## Data flow

1. Learner opens Phase 1 (or Phase 5). `LessonSession` reads
   `generatedPlans[key]` + `generatedSets[key]`.
2. No cached plan -> builder calls `planProblemSet({ slots, existingStatements, lessonTitle })`;
   the planner returns N distinct descriptions; the plan is persisted.
3. For each not-yet-built slot, builder calls `generatePlannedProblem({ scope, description, title })`
   in parallel. Each call: generator subagent writes the problem; verifier subagent
   independently solves it and must agree; structural gate passes; the `syn:` key is
   persisted; public fields return.
4. Each problem streams into the player and is persisted to `generatedSets`. Resume uses
   the cached plan + problems to finish only the missing slots.
5. A correct solve credits a catch on each `targetMisconceptionNodeIds` entry; a wrong
   "concept" attempt records a miss (both unchanged). Grading resolves the `syn:`
   `gradeId` server-side (unchanged).

## Edge cases

- **No tracked misconceptions:** `targetMisconceptions` empty; the planner still
  produces distinct descriptions and the generator still declares one unpinned flaw
  (gate unchanged). Nothing is credited until the learner has nodes.
- **Resume mid-set:** cached plan + cached problems restore exactly; only missing slots
  regenerate, from their original descriptions. No re-planning, no duplicates.
- **Planner returns a near-duplicate anyway:** the description is the dedup mechanism;
  if two descriptions still collide the verifier does not catch it (it only checks
  correctness). Mitigation: the planner prompt makes distinctness the primary
  instruction and lists the existing statements; a post-plan structural check rejects a
  plan with fewer than N distinct descriptions and retries the plan once, then fails
  loudly. (No silent substitution.)
- **Verifier disagrees with a correct problem (flaky solve):** counts as a failed
  attempt; regenerate. After `GENERATION_ATTEMPTS`, fail loudly. (Tradeoff of a single
  verifier solve vs. majority-of-three: fewer calls, no outlier tolerance; bounded
  retries absorb the occasional flaky solve.)
- **Corrupt cloud `generatedPlans`/`generatedSets`:** the normalizers drop malformed
  entries, so the builder re-plans/regenerates rather than crashing.

## Testing

Pure units (model calls injected/stubbed, as today):

- `buildGeneratedReview` / `buildPersonalizedSolveSet`: slot derivation unchanged;
  planner is called once with the right slots and `existingStatements`; each planned
  description is generated; parallel streaming; resume from `prebuiltPlan` + `prebuilt`
  generates only missing slots; **no fallback path exists** (a stubbed generation
  failure rejects rather than returning a template/authored problem).
- `dashboardProgress`: `normalizeGeneratedPlans` round-trips valid plans and drops
  malformed ones; `generatedPlans` survives serialize/normalize.
- Backend `synthesis.test.ts`: `buildPlannerPrompt` requests N distinct descriptions
  and lists `existingStatements`; `buildPlannedProblemPrompt` embeds the description and
  title; `parseProblemPlan` enforces count/shape.
- Backend `verifyProblem.test.ts`: single verifier-solve agreement (resolveCount 1)
  accepts on agree, rejects on disagree; structural checks unchanged.
- Deletion guards: a test (or CI grep) asserting no `v1:`, `template`, `pickSolve`,
  `pickAuthored`, or `pendingReview` symbols remain in `src` (outside deletions).

Integration: `LessonSession` shows the loading/streaming states, then the planned set;
a stubbed planner failure shows retry; a stubbed per-problem failure shows the loud
per-slot retry with no substitution.

## Files touched

**Create**

- `backend/functions/src/synthesis.ts`: `buildPlannerPrompt`, `planProblemSet`,
  `buildPlannedProblemPrompt`, `synthesizePlannedProblem`, `parseProblemPlan` (same file).
- `docs/superpowers/plans/2026-06-28-agent-planned-problem-generation.md` (the plan).

**Modify**

- `backend/functions/src/index.ts`: add `planProblemSet` + `generatePlannedProblem`
  callables; remove `generateScopedProblem`, `generateReviewProblem`,
  `generateSynthesisProblem`.
- `backend/functions/src/verifyProblem.ts`: single verifier-solve agreement (default
  `resolveCount` 1); structural checks unchanged.
- `backend/functions/src/problemKeys/index.ts`: drop the `v1:` branch.
- `backend/functions/src/types.ts`: drop `SeedTemplate` and variant types if unused.
- `frontend/src/content/problemSchema.ts`: provenance union, remove `templateId`,
  `pendingReview`, `PendingReview`, legacy single node id; add `ProblemPlan` (or place
  it in a small shared types module).
- `frontend/src/assign/buildGeneratedReview.ts` and `buildPersonalizedSolveSet.ts`:
  two-step plan+generate, parallel streaming, resume from plan, no fallback.
- `frontend/src/lib/grading.ts`: `planProblemSet` + `generatePlannedProblem` wrappers;
  remove `generateScopedProblem`, `generateReviewProblem`.
- `frontend/src/progress/dashboardProgress.ts`, `cloudStore.ts`, `ProgressContext.tsx`:
  `generatedPlans` field, normalizer, sync, getter/setter.
- `frontend/src/components/lesson/LessonSession.tsx`: plan-aware build + persistence,
  cache version bump.
- `frontend/src/components/problem/ProblemPlayer.tsx`: remove the `pendingReview`
  materialization path; keep `targetMisconceptionNodeIds` crediting.
- `backend/firestore.rules`: add `generatedPlans` to the allow-list + size guard.

**Delete**

- `frontend/src/content/templates/` (folder), `frontend/src/assign/buildAssignment.ts`
  (+ test), `blueprint.ts` (+ test), `composer.ts` (+ test).
- `backend/functions/src/templates/` (folder), `backend/functions/src/generateVariant.ts`
  (+ test), and the variant id helpers.
- Corresponding obsolete tests (`templates/index.test.ts`, `generateVariant.test.ts`,
  the variant cases in `keyResolver.test.ts`/`problemKeys` tests, `buildAssignment.test.ts`,
  `blueprint.test.ts`, `composer.test.ts`, the `v1:` fallback assertions in
  `buildPersonalizedSolveSet.test.ts`).

## Risks

- **Latency / cost:** per set, one planner call plus N generations, each with one
  verifier solve and up to three attempts. Parallelism across slots and the persisted
  plan/problems (no regeneration on resume) bound it; per-problem calls stay small so
  none approaches the 120s function timeout (the single-call alternative was rejected
  for this reason).
- **Single-verifier flakiness:** one solve has no outlier tolerance, so a flaky verifier
  can cost a regeneration; bounded attempts absorb it, then it fails loudly. If false
  rejections are common in practice, the knob is attempts (or re-introducing a small
  consensus), tuned from the now-logged failure reasons.
- **Loud failure can block a lesson:** with no fallback, a persistently failing slot
  blocks set completion. This is the intended behavior per the requirement; Review's
  "skip" keeps the formative phase unblockable, while Solve has retry only.
- **Deletion blast radius:** removing the unwired assignment/blueprint/composer and the
  pendingReview path touches several tests; the deletion grep is the guard that the
  removal is complete.
