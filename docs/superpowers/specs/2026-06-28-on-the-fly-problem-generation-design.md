# On-the-fly problem generation in the lesson loop

Date: 2026-06-28
Status: Approved design, ready for implementation plan

## Problem

Today the in-lesson loop is almost entirely static. Phase 1 ("Review") is composed
by `buildLessonReview` over the authored bank plus deterministic template variants
(`frontend/src/assign/`), and Phase 5 ("Solve") renders a fixed list of six
hand-authored problems from each module's `independentProblemIds`
(`frontend/src/content/modules/*.ts`). Neither adapts to what an individual learner
has actually studied or gotten wrong.

The app already has the machinery to do better but only uses a sliver of it: an
OpenAI synthesis path with an independent re-solve verification gate
(`backend/functions/src/synthesis.ts`, `verifyProblem.ts`), a persisted
content-addressed problem store (`synthesisStore.ts`), and a live per-student
emergent misconception graph (`frontend/src/mastery/misconceptionGraph.ts`) that
records a "concept" miss on every graded attempt but is only ever *credited* with
a catch through a review-generation path that is not wired into any page.

This design makes the two practice surfaces generate to the individual learner,
and closes the misconception mastery loop, while keeping worked examples (Phase 4)
exactly as they are: 100% hand-authored.

## Goals

1. Replace Phase 1 ("Review") with three problems generated on the fly: one
   synthesizing all past concepts, one on the previous lesson, one on the lesson
   before that. Each is comprehensive, multi-principle, and deliberately traps the
   learner's tracked misconceptions in scope.
2. Make Phase 5 ("Solve") half authored, half personalized: three hand-authored
   problems plus three generated problems, all primarily on the lesson topic, with
   one of the generated three chaining in a past concept.
3. Personalize the generated problems to the learner's tracked misconceptions
   (embed traps) and **credit a spaced catch** when the learner solves one
   correctly, so review and practice actually drive `isNodeMastered`.
4. Reuse the existing verification gate, synthesis store, and grading path
   unchanged, so a generated problem is never shown or graded unless it has been
   independently re-solved and verified server side. Answers never reach the client.

## Non-goals

- Worked examples (Phase 4) and the other three phases (Inquiry, Learn) are
  untouched. Worked examples stay hand-authored.
- The standalone post-lesson problem set (`buildPostLessonAssignment`) and
  dashboard review (`buildReviewAssignment`) remain as they are (unwired). This
  design only changes the two in-lesson surfaces.
- Removing the now-unused lazy `pendingReview` materialization path in
  `ProblemPlayer` and the old `buildLessonReview`/review-3 blueprint is optional
  cleanup, deferred to keep this change focused.
- No daily expiry of a generated set. A generated set persists for resume until the
  lesson's phase is finished.
- Authoring new static problems. The "authored 3" in Phase 5 are a curated subset
  of each module's existing `independentProblemIds`.

## Design

### 1. The generation backbone (backend)

One new callable generalizes the existing `generateReviewProblem` (which targets a
single misconception) to a scoped, multi-misconception, optionally cross-topic
synthesis. Both new surfaces call it.

`backend/functions/src/index.ts` — new callable `generateScopedProblem`:

```ts
// Input (public; no answers cross the wire in either direction)
type ScopedProblemInput = {
  skillIds: string[];          // human-readable scope, for the prompt
  principleIds: string[];      // in-scope principles to chain (gate requires >= 2)
  difficultyBand: number;      // 4 standard, 5 synthesis
  targetMisconceptions: {      // embed each as a required, diagnosable flaw
    nodeId: string;            // the misconception graph node id
    principleId: string;
    wrongBelief: string;
  }[];
  pastPrincipleIds?: string[]; // optional past-concept principles to chain in
};

// Output (public fields only)
type ScopedProblemResult = {
  problemId: string;           // "syn:" + hash(statement)
  statement: string;
  skillIds: string[];
  principleIds: string[];
  misconceptionTags: string[];
  difficultyBand: number;
  targetMisconceptionNodeIds: string[]; // node ids whose belief the verified problem traps
};
```

`backend/functions/src/synthesis.ts` — new `buildScopedReviewPrompt(params)` and
`synthesizeScopedProblem(params)`:

- The prompt extends the existing synthesis prompts. It asks for ONE comprehensive
  AP Physics C problem that genuinely chains the listed `principleIds` (plus any
  `pastPrincipleIds`), and for each entry in `targetMisconceptions` it requires a
  declared `flaw` whose `misconceptionId` is **exactly that entry's `nodeId`**,
  whose `signature` is the wrong step that belief produces, and whose `wrongAnswer`
  is the distinct quantity that belief yields. With an empty `targetMisconceptions`
  it still requires at least one declared flaw (mirrors the existing gate), but
  none is pinned to a node. The "never reveal the final answer; plain prose; no em
  dashes" rules carry over verbatim.
- `synthesizeScopedProblem` calls OpenAI (`response_format: json_object`,
  `SYNTHESIS_MAX_TOKENS`), parses with the existing `parseSynthesisResponse`, runs
  the existing `verifyProblem` gate with the existing `openAiSolve` re-solver, and
  returns the verified `SynthesisCandidate`. Any failure (no text, bad shape, gate
  fail) propagates so nothing unverified is ever persisted (break-loud).
- The callable persists via the existing `saveSynthesisProblem(toProblemKey(candidate))`
  and returns the public fields. `targetMisconceptionNodeIds` is computed as the
  verified candidate's `flaws.map(f => f.misconceptionId)` intersected with the
  input `nodeId`s, so only beliefs that survived verification are reported back for
  crediting.

No change to `verifyProblem`, `synthesisStore`, `keyResolver`, or grading: a `syn:`
id already resolves to its persisted key at grade time via `resolveProblemKey`.

### 2. Shared selection helpers (frontend, pure)

- `frontend/src/content/index.ts` — `principleIdsForSkills(skillIds: string[]): string[]`:
  the union of `principleIds` across authored `PROBLEMS` whose `skillIds` intersect
  the input. This derives a scope's principles from the bank (the skill -> principle
  mapping is not 1:1 by name, e.g. skill `mechanics-forces` -> principle
  `mechanics-newtons-laws`), so scopes stay correct without a separate table.
- `frontend/src/mastery/misconceptionGraph.ts` — `selectNodesForScope(graph, principleIds, count, now)`:
  the tracked nodes whose `principleId` is in `principleIds`, weakest decayed
  strength first (ties by `createdISO`), capped at `count`. A thin reuse of the
  existing `trackedNodes` + `currentStrength`, parallel to `selectReviewNodes`.

**Two-principle floor.** The gate requires at least two chained principles, but a
scope built from a single prior skill (or a single mechanics seed) can resolve to
one principle. Each builder therefore guarantees `principleIds.length >= 2` per
slot by widening a thin scope with the next-broader scope's principles before
calling the backend: a Review P2/P3 widens toward P1's principle set, and a Phase 5
topic problem widens with the one past principle it already carries. A scope that
still cannot reach two principles (only possible with a near-empty bank) drops that
slot rather than generating an ungatable problem.

### 3. Feature A: Phase 1 "Review" (three generated problems)

New builder `frontend/src/assign/buildGeneratedReview.ts`:

```ts
export async function buildGeneratedReview(
  progress: DashboardProgress,
  module: LessonModule,
  now: Date,
): Promise<Problem[]>;
```

Scopes (derived from authored `module.reviewSkillIds`, which is already authored
most-recent-first, and `progress.completedLessonIds`):

| Slot | Meaning | skillIds | principleIds | Band | Targets |
| - | - | - | - | - | - |
| P1 | all past concepts | all completed lessons' skills, else all of `reviewSkillIds` | `principleIdsForSkills(P1 skills)` (>= 2) | 5 | `selectNodesForScope(graph, P1 principles, 3, now)` |
| P2 | previous lesson | `[reviewSkillIds[0]]` | `principleIdsForSkills([reviewSkillIds[0]])` | 4 | `selectNodesForScope(graph, P2 principles, 2, now)` |
| P3 | the lesson before that | `[reviewSkillIds[1]]` (else mechanics fallback) | `principleIdsForSkills(P3 skills)` | 4 | `selectNodesForScope(graph, P3 principles, 2, now)` |

The mechanics fallback is automatic: `reviewSkillIds` for lesson 1 is the three
mechanics seeds (`mechanics-forces`, `mechanics-energy`, `mechanics-kinematics`),
and for lesson 2 it is `['coulombs-law', 'mechanics-forces']`. So early in the
course the slots are scoped to mechanics with no special-casing. When
`reviewSkillIds[1]` is absent, P3 falls back to the last available `reviewSkillIds`
entry (or P1's mechanics scope), so the review is always three problems.

The builder fires the three `generateScopedProblem` calls in parallel (via the
client wrapper in section 6) and assembles each into a `Problem`:
`provenance: 'synthesis'`, `kind: 'synthesis'` for P1 else `'single'`,
`prompt = statement`, `gradeId = problemId` (the `syn:` id), and
`targetMisconceptionNodeIds` from the result. Titles: "Review: synthesis",
"Review: <previous lesson title>", "Review: <lesson-before title>".

### 4. Feature B: Phase 5 "Solve" (three authored + three personalized)

New builder `frontend/src/assign/buildPersonalizedSolveSet.ts`:

```ts
export async function buildPersonalizedSolveSet(
  progress: DashboardProgress,
  module: LessonModule,
  now: Date,
): Promise<Problem[]>;
```

- **Authored 3:** the three ids of `module.independentProblemIds` resolved via
  `getProblemById` (each module is curated to exactly three authored ids; see
  section 9). An unresolved id throws (break-loud, matching the current Phase 5).
- **Generated 3**, all primarily on the lesson topic (`module.topicPrincipleIds`):
  - **2 topic problems:** scope skill `[module.lessonId]`, principles
    `module.topicPrincipleIds`, band 4, targets
    `selectNodesForScope(graph, topicPrincipleIds, 2, now)`.
  - **1 synthesis problem:** same topic scope plus `pastPrincipleIds = [one
    principle from the most recently completed prior lesson's `topicPrincipleIds`]`,
    band 5, targets `selectNodesForScope(graph, topic + past principles, 2, now)`.
    On lesson 1 (no prior lesson) the past principle is a mechanics seed principle,
    so the synthesis problem chains the topic with mechanics.
- When the learner has no tracked misconceptions in scope, `targetMisconceptions`
  is empty: the problems are still freshly generated lesson-topic problems, just
  without pinned traps (the gate still requires one declared flaw, unpinned).
- **Order** (deterministic, gentle ramp, synthesis last):
  `authored[0], generated.topic[0], authored[1], generated.topic[1], authored[2],
  generated.synthesis`.

The two topic calls and the synthesis call run in parallel; the authored three are
resolved synchronously and are always present.

### 5. Closing the misconception loop (crediting)

`frontend/src/content/problemSchema.ts`: replace the single
`targetMisconceptionNodeId?: string` with `targetMisconceptionNodeIds?: string[]`
(a generated problem can trap more than one belief).

`frontend/src/components/problem/ProblemPlayer.tsx`: on a fully-correct solve,
credit a catch on **every** id in `problem.targetMisconceptionNodeIds` via the
existing `recordNodeCatch`, guarded once per problem by the existing
`recordedRef`. The existing `recordConceptMiss` path on a wrong "concept" attempt
is unchanged, so a trap the learner falls for still deepens or promotes that node.
This is what lets spaced-correct solves reach `isNodeMastered` (catches across
three distinct days). Catches are credited only on a fully-correct solve, never on
a partial or incorrect one (the grader only reports the first error).

### 6. Client call + persistence

- `frontend/src/lib/grading.ts`: add `generateScopedProblem(input)` wrapping the
  callable, mirroring the existing `generateReviewProblem` wrapper.
- Generated `syn:` statements are not client-re-derivable, so each built set is
  cached durably for resume. Add `generatedSets: Record<string, GeneratedProblem[]>`
  to `DashboardProgress` (`frontend/src/progress/dashboardProgress.ts`), keyed
  `${lessonId}:review` and `${lessonId}:solve`, where `GeneratedProblem` is the
  public `Problem` subset already produced by the builders. Add a
  `normalizeGeneratedSets` validator (drop malformed entries, like the other
  normalizers) and include the field in `EMPTY_PROGRESS`, `normalizeProgress`, the
  serialize path, and `cloudStore.ts`.
- `LessonSession` reads `generatedSets[key]` first; only if absent does it call the
  builder and persist the result. The existing per-key `ProblemSetSession`
  (`reviewKey`, `independentKey`) keeps handling the resume index and whiteboard
  work unchanged.

### 7. Generation timing, loading, failure

- Both sets are built up front: Review when Phase 1 first opens, Solve when Phase 5
  first opens. `LessonSession` shows the existing `LoadingScreen` while a set
  resolves (Phase 1 already does this for `reviewProblems === null`).
- **Failure is break-loud but never traps the learner** (matching `WorkedExample`
  and `ProblemPlayer`'s `genError`/`genAttempt` retry):
  - Review: a failed build shows a retry; after retry it also offers "Skip review"
    to advance to Phase 2 (review is formative).
  - Solve: the authored three always render. Each generated slot retries on
    failure; if a generated call stays down, that slot is dropped and the set can
    be completed on the remaining problems, so the post-lesson gate
    (`markProblemSetComplete`, which unlocks the next lesson) is never blocked.

### 8. Scope guardrail interaction

`validateLessonScope` (`2026-06-27-lesson-topic-scope-design.md`) validates only
*authored* module references (`workedSequence`, `independentProblemIds`) against
`topicPrincipleIds`. Runtime-generated problems are not module references, so they
are governed by the generation prompt's scope, not the build-time guardrail. The
one Phase 5 synthesis problem intentionally includes a past-concept principle; this
is allowed precisely because it is generated, not authored. The authored three in
Phase 5 still pass the guardrail.

### 9. Module curation

Each module's `independentProblemIds` is trimmed to exactly three on-topic authored
ids (the generated three fill the rest). `coulombs-law.ts`,
`charging-conductors-insulators.ts`, and `electric-field-field-lines.ts` each keep
their three strongest on-topic problems; the rest stay in the catalog under their
home lessons (server keys untouched). `topicPrincipleIds` already exists on each
module and is reused as the Phase 5 topic scope.

## Data flow and how it fits

1. Learner opens Phase 1 (or Phase 5). `LessonSession` checks
   `progress.generatedSets[key]`; if empty it calls the builder.
2. The builder derives scopes and per-scope target nodes from `progress`
   (`completedLessonIds`, `reviewSkillIds`/`topicPrincipleIds`, `misconceptionGraph`),
   then calls `generateScopedProblem` in parallel.
3. The callable synthesizes, verifies (independent re-solve consensus, >= 2
   principles, distinct diagnosable wrong answers), persists the `syn:` key, and
   returns public fields plus `targetMisconceptionNodeIds`.
4. The builder assembles `Problem[]`, `LessonSession` persists the set to
   `generatedSets`, and `ProblemPlayer` renders it. Grading resolves the `syn:`
   `gradeId` server side (unchanged).
5. A correct solve credits a catch on each targeted node; a wrong "concept" attempt
   records a miss (unchanged). Both flow through the existing `ProgressContext`
   reducers and cloud sync.

## Edge cases

- **No completed lessons (lesson 1):** P1 scope is all `reviewSkillIds` (mechanics);
  P2/P3 are the first two mechanics seeds. Phase 5's synthesis chains the topic with
  a mechanics principle.
- **Only one prior lesson (lesson 2):** P3 falls back to the trailing
  `reviewSkillIds` entry (a mechanics seed), which is already authored.
- **No tracked misconceptions:** `targetMisconceptions` empty; problems still
  generate (unpinned flaw), nothing is credited until the learner has nodes.
- **A targeted belief fails verification** (its wrong answer collides with another
  or with the final answer): the candidate fails the gate and the call retries;
  `targetMisconceptionNodeIds` only ever reports beliefs that survived.
- **A scope resolves to one principle** (single prior skill, or a mechanics seed):
  the builder widens it to two (section 2); if it still cannot, the slot is dropped
  rather than generating a problem the gate will always reject.
- **Resume mid-set:** the cached `generatedSets` entry restores the exact problems;
  the `ProblemSetSession` restores the index and whiteboard work. No regeneration.
- **Corrupt cloud `generatedSets`:** `normalizeGeneratedSets` drops malformed
  entries, so the builder regenerates rather than crashing.

## Testing

Pure units (no live OpenAI; the model call stays a deploy-gated boundary, as in
the existing synthesis code):

- `buildGeneratedReview`: scope derivation for lesson 1 (mechanics), lesson 2 (one
  prior + mechanics fallback), lesson 3 (two prior); P1 union; band assignment;
  target-node selection per scope. The `generateScopedProblem` boundary is injected
  and stubbed.
- `buildPersonalizedSolveSet`: authored-three resolution, the 2-topic + 1-synthesis
  split, `pastPrincipleIds` selection (incl. lesson-1 mechanics), final ordering,
  empty-misconceptions behavior.
- `selectNodesForScope` and `principleIdsForSkills`: in-scope filtering, weakest-first
  ordering, capping; union correctness against the bank.
- `ProblemPlayer`: a correct solve credits a catch on every `targetMisconceptionNodeIds`
  entry exactly once (extends the existing single-id test).
- `dashboardProgress`: `normalizeGeneratedSets` round-trips valid sets and drops
  malformed ones; `generatedSets` survives serialize/normalize.
- Backend: `parseSynthesisResponse` + `verifyProblem` already cover the candidate
  shape; add a `buildScopedReviewPrompt` test asserting each `targetMisconceptions`
  entry's `nodeId` appears as a required `misconceptionId` and that
  `pastPrincipleIds` are requested.

Integration: `LessonSession` shows `LoadingScreen` then the built set; a stubbed
build failure shows retry and (Review) the skip affordance; Solve completes on the
authored three when generation is down.

## Files touched

Backend:

- `functions/src/synthesis.ts`: `buildScopedReviewPrompt`, `synthesizeScopedProblem`.
- `functions/src/index.ts`: `generateScopedProblem` callable.
- `functions/src/synthesis.test.ts`: prompt assertions.

Frontend:

- `content/problemSchema.ts`: `targetMisconceptionNodeId` -> `targetMisconceptionNodeIds: string[]`.
- `content/index.ts`: `principleIdsForSkills`.
- `mastery/misconceptionGraph.ts`: `selectNodesForScope`.
- `assign/buildGeneratedReview.ts` (new) + test.
- `assign/buildPersonalizedSolveSet.ts` (new) + test.
- `lib/grading.ts`: `generateScopedProblem` wrapper.
- `progress/dashboardProgress.ts`: `generatedSets` + `normalizeGeneratedSets`.
- `progress/cloudStore.ts`: sync `generatedSets`.
- `progress/ProgressContext.tsx`: persist/read `generatedSets` (a getter/setter pair).
- `components/lesson/LessonSession.tsx`: Phase 1 -> `buildGeneratedReview`, Phase 5
  -> `buildPersonalizedSolveSet`, cache-first, loading/retry/skip.
- `components/problem/ProblemPlayer.tsx`: credit all `targetMisconceptionNodeIds`.
- `content/modules/coulombs-law.ts`, `charging-conductors-insulators.ts`,
  `electric-field-field-lines.ts`: trim `independentProblemIds` to three.
- Corresponding tests: `ProblemPlayer.test.tsx`, `LessonSession.test.tsx`,
  `dashboardProgress.test.ts`, `content.test.ts`.

## Implementation phases (for a parallel one-pass build)

Contracts in sections 1, 5, and 6 are fixed first so phases integrate cleanly.

- **Phase 1 (foundation, fully parallel, disjoint files):**
  1. Backend callable + prompt + synthesize (`functions/src/synthesis.ts`,
     `functions/src/index.ts`).
  2. Frontend pure helpers (`content/index.ts` `principleIdsForSkills`,
     `mastery/misconceptionGraph.ts` `selectNodesForScope`).
  3. Data model + persistence (`content/problemSchema.ts`,
     `progress/dashboardProgress.ts`, `progress/cloudStore.ts`,
     `progress/ProgressContext.tsx`).
- **Phase 2 (parallel, after Phase 1):**
  1. `lib/grading.ts` wrapper.
  2. `assign/buildGeneratedReview.ts` + test.
  3. `assign/buildPersonalizedSolveSet.ts` + test.
- **Phase 3 (parallel, after Phase 2; disjoint files):**
  1. `LessonSession.tsx` wiring + loading/retry/skip.
  2. `ProblemPlayer.tsx` crediting.
  3. Module curation (three module files).
- **Phase 4:** test sweep + `verify.sh` (typecheck, lint, build, tests).

## Risks

- **Cost and latency:** up to six synthesis calls per lesson visit, each with a
  two-call verification re-solve. Mitigated by parallelism, durable caching in
  `generatedSets` (no regeneration on resume), and lazy build per phase. If latency
  is poor, `SYNTHESIS_MAX_TOKENS` and the re-solve count are the tuning knobs.
- **Generation quality at breadth:** a "synthesize all past concepts" problem is the
  hardest ask; the verification gate is the backstop (it discards anything the
  re-solver disagrees with), so a weak generation fails closed and retries rather
  than shipping a wrong problem.
- **Progress document growth:** `generatedSets` stores statements. Keyed per lesson
  phase and overwritten on rebuild, so it stays bounded; a later cleanup on lesson
  completion is a possible follow-up.
- **Field rename churn:** `targetMisconceptionNodeId` -> array touches the (now
  unused) lazy review path in `ProblemPlayer`; update it to a one-element array for
  safety even though Phase 1 no longer uses it.
