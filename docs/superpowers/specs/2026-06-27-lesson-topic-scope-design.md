# Lesson topic scope (anti-drift guardrail)

Date: 2026-06-27
Status: Approved design, ready for implementation plan

## Problem

Each lesson is a `LessonModule` (`frontend/src/content/modules/`) that references
problems by id in its `workedSequence` and `independentProblemIds`. Every problem
JSON already declares the big ideas it exercises in `principleIds` (ids catalogued
in `principles.ts`), but nothing checks that a lesson only references problems
whose principles belong to that lesson. As a result, lesson 1 (Coulomb's Law) has
drifted into electric fields:

- `cl-field-point-charge` (worked) carries principle `field-concept`; its home is
  the field lesson.
- `cl-two-charge-superposition` (completion) carries `superposition`, `field-concept`;
  home `electric-fields-of-charge-distributions`.
- `cl-midpoint-field-potential` (completion) carries `field-concept`, `energy-potential`;
  home `electric-fields-of-charge-distributions`.
- `cl-field-and-force` (independent) carries `coulomb-force`, `field-concept`; home
  `coulombs-law`.

`validateLessonModule` checks structure (slide count, em dashes, self-explain
prompts, inquiry screens) but never topical scope, so this drift ships silently.

## Goals

1. Give every lesson an authored, enforced list of the topics it is allowed to
   cover, anchored to the existing `principleIds` taxonomy.
2. Fail the test suite when a lesson references a problem whose principles fall
   outside that list, so drift cannot return.
3. Fix the Coulomb lesson so it is entirely Coulomb's law, keeping a full worked
   ladder plus six difficult, unique independent problems.

## Non-goals

- Auditing or tightening lessons 2 and 3. Their scopes are authored to pass their
  current intended content as-is. A future full audit can narrow them.
- Checking authored prose (inquiry, explanation slides) for scope. Prose is not
  machine-taggable; enforcement covers referenced problems only.
- Adding `mechanics-newtons-laws` to Coulomb's scope. The six new problems are
  designed to stay within `coulomb-force` and `superposition`, so pendulum and
  other force-balance problems that mix in mechanics are out of scope here.

## Design

### 1. Data model

Add one authored field to `LessonModule` in `frontend/src/content/schema.ts`:

```ts
// The big ideas this lesson is allowed to cover (ids from principles.ts). Every
// referenced problem's principleIds must be a subset of this list. The scope
// guardrail (validateLessonScope) enforces it.
topicPrincipleIds: string[];
```

It holds principle ids, which are enforced and readable (each maps to a
`PRINCIPLES[].name`).

### 2. The checker

A pure function in `schema.ts`, taking the module plus a resolver so the schema
stays catalog-free and `validateLessonModule` is untouched:

```ts
export function findScopeViolations(
  module: LessonModule,
  resolveProblem: (id: string) => { principleIds: string[] } | undefined,
): string[];
```

It walks every id in `workedSequence` and `independentProblemIds`, resolves each
problem, and reports any `principleId` not in `module.topicPrincipleIds`, for
example `problem cl-field-point-charge references off-scope principle field-concept`.
Unresolved ids are skipped (resolution is already covered by an existing test).

A bound convenience in `frontend/src/content/index.ts`, where the catalog and the
principles list are reachable:

```ts
export function validateLessonScope(module: LessonModule): string[];
```

It first checks every `topicPrincipleId` is a real catalogued principle (mirrors
the existing "references only catalogued principles" problem test), then appends
`findScopeViolations(module, getProblemById)`.

### 3. Enforcement

Extend `frontend/src/content/content.test.ts` with a test that every course
module passes `validateLessonScope` with no violations, alongside the existing
"ships only modules that pass validateLessonModule" test.

### 4. Authored scopes

- Coulomb's Law: `['coulomb-force', 'superposition']`
- Charging, Conductors & Insulators: `['conductor-equilibrium', 'coulomb-force', 'field-concept', 'energy-potential']`
  (the union of principles its current problems use, so it passes as-is)
- Electric Field & Field Lines: `['field-concept', 'superposition', 'coulomb-force']`
  (passes as-is; `coulomb-force` is the prior idea behind `F = qE`)

### 5. Coulomb content rebuild

All problems below are Coulomb's law only (principles within `coulomb-force` and
`superposition`).

Worked-to-faded ladder (Phase 4), rebuilt from existing on-topic problems, no new
authoring:

- Worked analogical pair on `analogyGroup: 'inverse-square'`:
  - `cl-coulomb-force-two-charges` (direct computation of F). Already has
    `solutionSteps` and `selfExplainPrompt` in the module.
  - `cl-coulomb-scaling` (proportional reasoning, same law, different surface).
    Add `solutionSteps` and a `selfExplainPrompt` to its module entry.
- Scaffolded completion:
  - `cl-coulomb-collinear-net` (three collinear charges, net force, introduces
    superposition). Add `prefilledSteps` to its module entry.

Independent set (Phase 5): six difficult (band 5), unique Coulomb problems.

Kept (already band 5, distinct configurations):

- `cl-coulomb-net-2d`: net force at an off-axis point from two charges (2D
  components). As cleanup aligned with "all Coulomb's law", change its `skillIds`
  from `['coulombs-law', 'electric-fields-of-charge-distributions']` to
  `['coulombs-law']` and `kind` from `synthesis` to `single`. Principles are
  unchanged (`coulomb-force`, `superposition`).
- `cl-coulomb-equilibrium`: find the position on a line where the net force on a
  third charge is zero (quadratic).

New, to author (client JSON + server key each, band 5, `provenance: 'authored'`,
principles within `coulomb-force`/`superposition`, non-empty `misconceptionTags`):

1. `cl-coulomb-square-corner-net`: four equal charges at the corners of a square,
   net force on one corner charge. Surface: square symmetry, diagonal plus two
   sides, 2D components. Principles `coulomb-force`, `superposition`.
2. `cl-coulomb-triangle-net`: three charges at the vertices of an equilateral
   triangle, net force on one vertex. Surface: 60-degree component geometry.
   Principles `coulomb-force`, `superposition`.
3. `cl-coulomb-solve-charge`: inverse problem, given the measured net force on a
   target charge in a known two-source configuration, solve for the unknown
   magnitude of one source charge. Surface: algebra for an unknown charge rather
   than a position (distinct from `cl-coulomb-equilibrium`, which solves for a
   position at zero net force). `symbolic` true. Principles `coulomb-force`,
   `superposition`.
4. `cl-coulomb-charge-split-max`: a total charge Q is split into q and Q minus q a
   fixed distance apart; find the split that maximizes the force (q = Q/2). Surface:
   optimization. `calculus` true. Principle `coulomb-force`.

Removed from the Coulomb module (no longer referenced, kept in the catalog under
their home lessons, server keys untouched): `cl-field-point-charge`,
`cl-two-charge-superposition`, `cl-midpoint-field-potential`, `cl-field-and-force`.
`cl-coulomb-force-ap` (band 4, a basic two-charge force) is also dropped from the
module references in favor of the harder, unique set; it stays in the catalog.

## Data flow and how it fits

`validateLessonScope` is a pure-ish function used by tests, the same way
`validateLessonModule` is. No runtime path changes; the composer, player, and
dashboard keep reading the modules and problems as before. The new problems flow
through the existing client catalog (`problems/index.ts`) and server registry
(`problemKeys/index.ts`).

## Edge cases

- A `topicPrincipleId` that is not a catalogued principle: reported by
  `validateLessonScope`.
- A referenced problem id that does not resolve: skipped by `findScopeViolations`
  (the existing "resolves every problemId" test catches missing ids).
- A problem with an empty `principleIds`: contributes no violations, which is
  acceptable; principle tagging is enforced elsewhere.

## Testing

- `content.test.ts`: new "every module within its declared topic scope" test;
  existing analogical-pair, completion, and no-skeleton assertions still hold
  (`cl-coulomb-force-two-charges` and `cl-coulomb-scaling` share `inverse-square`;
  `cl-coulomb-collinear-net` carries `prefilledSteps`).
- `problems.test.ts`:
  - Update "groups Coulomb and field problems under their home lesson skills":
    `getProblemsForLesson('coulombs-law')` gains the four new `cl-coulomb-*` ids.
  - Update "keeps the six Phase 5 independent problems at the AP-Classroom bands"
    to the new six: `cl-coulomb-net-2d`, `cl-coulomb-equilibrium`,
    `cl-coulomb-square-corner-net`, `cl-coulomb-triangle-net`,
    `cl-coulomb-solve-charge`, `cl-coulomb-charge-split-max`.
  - The `kind` test stays green after `cl-coulomb-net-2d` becomes `single`.
- Backend `parse.test.ts` and key tests: the four new keys follow the existing
  `ProblemKey` shape (`statement`, `correctSolution`, `finalAnswer`, `rubric`,
  `flaws`).

## Files touched

Frontend:

- `content/schema.ts`: add `topicPrincipleIds`; add `findScopeViolations`.
- `content/index.ts`: add `validateLessonScope`; re-export `findScopeViolations`.
- `content/modules/coulombs-law.ts`: add scope; rebuild ladder and independents.
- `content/modules/charging-conductors-insulators.ts`: add scope.
- `content/modules/electric-field-field-lines.ts`: add scope.
- `content/problems/cl-coulomb-square-corner-net.json` (new)
- `content/problems/cl-coulomb-triangle-net.json` (new)
- `content/problems/cl-coulomb-solve-charge.json` (new)
- `content/problems/cl-coulomb-charge-split-max.json` (new)
- `content/problems/cl-coulomb-net-2d.json`: skillIds/kind cleanup.
- `content/problems/index.ts`: register the four new problems.
- `content/content.test.ts`: scope enforcement test.
- `content/problems/problems.test.ts`: update the two hardcoded Coulomb lists.

Backend:

- `functions/src/problemKeys/cl-coulomb-square-corner-net.ts` (new)
- `functions/src/problemKeys/cl-coulomb-triangle-net.ts` (new)
- `functions/src/problemKeys/cl-coulomb-solve-charge.ts` (new)
- `functions/src/problemKeys/cl-coulomb-charge-split-max.ts` (new)
- `functions/src/problemKeys/index.ts`: register the four new keys.

## Risks

- Authoring four band-5 problems with correct physics, final answers, rubrics, and
  misconception flaws is the main effort and the main source of error. Each new
  problem's `finalAnswer` and `correctSolution` must be computed and checked.
- The two hardcoded test lists must be kept in lockstep with the module changes,
  or the suite goes red for the wrong reason.
