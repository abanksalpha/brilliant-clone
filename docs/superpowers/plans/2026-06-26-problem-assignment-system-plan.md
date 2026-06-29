# Problem Assignment System Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Each task is dispatched to a fresh implementer doing TDD. The controller verifies the full suite and build after every wave.

Goal: build the assignment composer and hybrid problem bank from
`docs/superpowers/specs/2026-06-26-problem-assignment-system-design.md`, so the app
assembles AP-Classroom-hard problem sets with a deliberate mix of single-topic,
synthesis, and misconception-review problems, tuned to each learner, where every
problem is verified correct before it can be assigned.

Architecture: extend the content model with a skills + principles taxonomy and an
extended `Problem`. Author seed templates whose correct answer and each
misconception's buggy answer are computed in code, so re-numbered variants get
exact keys by construction. A variant's `problemId` encodes its template and
parameter draw, so the server re-derives the key at grade time with no database.
A pure composer chooses a blueprint of typed slots and fills them adaptively, in
two contexts (post-lesson and review). AI synthesis generation plus a verification
gate is the one deploy-gated, separately-flagged piece.

Tech stack: React 19 + Vite + TypeScript frontend, Firebase Functions v2 +
OpenAI backend (`backend/functions/src/openai.ts`), Vitest on both sides.

## Global Constraints

- No mocks and no fallbacks in product code. On any failure (bad input, unknown template, API error, malformed output) throw. Never fabricate or default a grade, key, or problem. Mocks appear only in `*.test.*` files, at boundaries.
- No em dashes anywhere in code, comments, or strings. Use commas, colons, parentheses, periods. The double hyphen as prose punctuation is also banned.
- TDD: write the failing test first, watch it fail, then implement. Pure logic must be deterministic (no `Math.random`; parameter draws use a seeded, deterministic RNG).
- Server-only answer keys: any correct answer, `solve`, `buggyPath`, rubric, or flaw signature lives ONLY under `backend/functions`. No answer ever appears in a `frontend/` file. Public problem content has no answer fields.
- Reuse existing styles. Any graphical change must be pixel-aligned and use existing tokens and classes; only append minimal CSS to the end of `frontend/src/styles.css` under a comment banner if a needed container truly does not exist. No side-stripe accent borders, no gradient text, no glassmorphism.
- Backward compatible: `Problem` keeps `lessonId` (single-topic home skill). New fields are added, existing tests stay green. Old progress documents still normalize.
- Stay strictly within the files listed per task. Do not run git and do not commit (the controller handles git).

## Variant id contract (shared by frontend render and backend key derivation)

A variant problemId encodes template and parameters so the public prompt
(frontend) and the answer key (backend) are both derived from the same numbers.

```
format: "v1:<templateId>:<k1>=<v1>;<k2>=<v2>;..."
example: "v1:cl-field-point-charge:q=3.0e-6;r=2.0"
```

- `serializeVariantId(templateId, params)` and `parseVariantId(id)` are defined once on each side from the same spec, and a test asserts round-trip equality.
- Authored static problems keep their plain ids (for example `cl-field-point-charge`). `getProblemKey` returns the static key for a plain id and derives the key for a `v1:` id.

## File Structure

Frontend content (`frontend/src/content`):
- `problemSchema.ts` (modify): extend `Problem`, add `SeedTemplatePublic`, `ProblemKind`.
- `principles.ts` (create): the principle catalog and `getPrinciple`.
- `courseMap.ts` (modify): add a stable `skillId` to each lesson node.
- `problems/*.json` (modify the 4), `problems/index.ts` (modify), `problems/problems.test.ts` (modify).
- `templates/index.ts` and `templates/*.ts` (create): the public half of seed templates (param spec, prompt render, tags, difficulty) and `serializeVariantId`/`parseVariantId`, plus tests.

Composer (`frontend/src/assign`, create):
- `types.ts`: `Slot`, `Assignment`, `AssignmentContext`, `LearnerState`.
- `blueprint.ts` + `blueprint.test.ts`: `chooseBlueprint`.
- `composer.ts` + `composer.test.ts`: `composeAssignment` (slot filling over authored problems plus generated variants).

Backend (`backend/functions/src`):
- `types.ts` (modify): add `SeedTemplate`, `ParamSpec`, `VariantParams`.
- `templates/index.ts` and `templates/*.ts` (create): the private half (`solve`, `buggyPath`) and `serializeVariantId`/`parseVariantId` mirror, plus tests.
- `generateVariant.ts` (create) + test: pure params to `ProblemKey`.
- `problemKeys/index.ts` (modify): `getProblemKey` handles `v1:` derived ids.
- `synthesis.ts` + `verifyProblem.ts` (create, Phase 3, flagged): AI synthesis and the verification gate. Pure gate logic tested, model boundary mocked.

Wiring (`frontend/src`):
- `pages/ProblemSetPage.tsx` (modify): use `composeAssignment` in `post-lesson` context.
- `pages/PracticePage.tsx` (modify): use `composeAssignment` in `review` context.
- `components/problem/ProblemPlayer.tsx` and `lib/grading.ts` (modify only if needed): carry variant `problemId` through to grading unchanged.

## Waves

Wave 1 (parallel, file-disjoint): Task A (frontend content model), Task B (backend templates + variant keys), Task C (composer). Different directories, minimal cross-imports (C defines local input types like the existing `mastery/types.ts`).

Wave 2 (after Wave 1 verified): Task D (wire composer into the two pages, pixel-aligned). Touches shared page files, so it is its own wave.

Wave 3 (flagged, no-fallback): Task F (AI synthesis + verification gate). Pure parts tested, model and Firestore boundary mocked, live path flagged for the user.

Each wave ends with the controller running the full frontend suite, the backend
build and suite, and the frontend build, and only proceeding when all are green.

## Task A: Frontend content model and migration

Files: `problemSchema.ts`, `principles.ts` (new), `courseMap.ts`, `misconceptions.ts` (only if a tag is needed), `problems/*.json` (4), `problems/index.ts`, `problems/problems.test.ts`.

Interfaces produced (other tasks rely on these exact shapes):

```ts
type ProblemKind = 'single' | 'synthesis'; // by skill count; misconception-review is a slot concept, not a problem kind

type Problem = {
  problemId: string;
  lessonId: string;            // kept: the home skill for single-topic problems
  unitId: string;
  skillIds: string[];          // 1 = single-topic, 2+ = synthesis; includes lessonId
  principleIds: string[];
  misconceptionTags: string[];
  kind: ProblemKind;
  difficultyBand: number;      // 1..5, AP-Classroom = 4..5
  difficultyFeatures: { steps: number; symbolic: boolean; calculus: boolean; multiPart: boolean; hasTrap: boolean };
  provenance: 'authored' | 'variant' | 'synthesis';
  templateId?: string;
  title: string;
  prompt: string;
  givens?: { label: string; value: string }[];
  figure?: string;
};

type Principle = { id: string; name: string; description: string };
```

- `principles.ts`: export `PRINCIPLES: Principle[]` with the 12 ids from the spec and `getPrinciple(id)`.
- `courseMap.ts`: add `skillId` to `CourseLesson`. The live lesson `coulombs-law` gets `skillId: 'coulombs-law'`; give every node a stable kebab-case `skillId`.
- Migrate the 4 problem JSONs: add `skillIds` (= `[lessonId]` for the existing single-topic ones), `principleIds` (Coulomb problems: `["superposition","field-concept"]` as appropriate; the field problems use `field-concept`, the force problem uses `superposition`), `kind` (`single` or `misconception-review`), `difficultyBand` (= existing `difficulty`), `difficultyFeatures`, `provenance: "authored"`. No answers (still none).
- Tests: keep `getProblemsForLesson('coulombs-law')` count correct; assert every problem has nonempty `skillIds`, valid `kind`, `difficultyBand` in 1..5, every `principleIds` entry exists in `PRINCIPLES`, every `misconceptionTags` entry exists in `MISCONCEPTIONS`, and no answer-bearing key (`answer`, `solution`, `correct`, `finalAnswer`) appears.

## Task B: Backend seed templates, variant generator, key derivation

Files: `backend/functions/src/types.ts`, `templates/index.ts` + `templates/*.ts` (new), `generateVariant.ts` (new), `generateVariant.test.ts` (new), `templates/templates.test.ts` (new), `problemKeys/index.ts`.

- Add to `types.ts`: `ParamSpec` (per-parameter range + step + constraint), `VariantParams = Record<string, number>`, `SeedTemplate` (private):

```ts
type SeedTemplate = {
  templateId: string;
  skillIds: string[];
  principleIds: string[];
  difficultyBand: number;
  paramSpec: ParamSpec;
  renderStatement: (p: VariantParams) => string;
  solve: (p: VariantParams) => { correctSolution: string[]; finalAnswer: string };
  rubric: string;
  flaws: { misconceptionId: string; buggyPath: (p: VariantParams) => string }[];
};
```

- Author at least 3 templates by porting the existing static problems: `cl-field-point-charge` (field of a point charge, flaw `inverse-square-error`), `cl-midpoint-field-potential` (dipole midpoint, flaw `field-potential-conflation`), `cl-two-charge-superposition` (midpoint of equal charges, flaw `superposition-magnitude-add`). Numbers from the existing keys, generalized to params (k fixed, q and r drawn from ranges; keep answers physically sane, for example round-ish magnitudes).
- `serializeVariantId` / `parseVariantId` per the contract above, with a round-trip test.
- `generateVariant(templateId, params)` returns the server `ProblemKey` (statement, correctSolution, finalAnswer, rubric, flaws as `{misconceptionId, signature}` where signature is `buggyPath(params)` text). Pure. Throws on unknown template or out-of-spec params.
- `getProblemKey(id)`: plain id returns the static authored key (unchanged); a `v1:` id parses to `{templateId, params}` and returns `generateVariant(...)`. Throws on unknown.
- Tests (golden, with fixed params): each template's `solve` produces the known correct answer; each `buggyPath` produces the known wrong answer distinct from correct; `getProblemKey` derives a `v1:` id correctly and still returns static keys for plain ids; round-trip id test.

## Task C: The composer (pure)

Files: `frontend/src/assign/types.ts`, `blueprint.ts`, `blueprint.test.ts`, `composer.ts`, `composer.test.ts`. Define local minimal input types (do not import from content or progress), mirroring `frontend/src/mastery/types.ts`.

```ts
type AssignmentContext = 'post-lesson' | 'review';

type SlotType = 'single' | 'synthesis' | 'misconception-review';
type Slot = {
  type: SlotType;
  targetSkillId?: string;
  targetMisconceptionId?: string;
  difficultyBand: number;
};

type LearnerState = {
  masteryMap: MasteryMap;                 // from mastery/types
  masteredSkillIds: string[];
  recentProblemIds: string[];
};

type CandidateProblem = {                 // structural superset of Problem
  problemId: string; skillIds: string[]; principleIds: string[];
  misconceptionTags: string[]; kind: 'single' | 'synthesis'; difficultyBand: number;
};
```

- `chooseBlueprint({ context, targetSkillId?, skillCourseIndex?, totalSkills?, learnerState, now })` returns `Slot[]`.
  - `post-lesson`: length = `clamp(round(lerp(6, 18, skillCourseIndex / (totalSkills - 1))), 6, 18)`. Slots: majority `single` on `targetSkillId` at the AP band; one to a few `misconception-review` slots for that skill's weak or decaying misconceptions (lowest `currentStrength` first); add `synthesis` slots only when at least one other mastered skill exists, count growing with `skillCourseIndex`. Phase ratios shift with the target skill's mastery (early favors single, later adds synthesis).
  - `review`: length default 8. Slots weighted to the globally weakest and most-decayed misconceptions (`misconception-review`), plus `single` spaced retrieval across mastered skills, plus `synthesis` across mastered skills. No anchor skill.
- `composeAssignment(slots, candidates, learnerState, now, generateVariantPublic)` returns an ordered list of public problems.
  - Fill each slot with the best candidate: matches `type`, target, and `difficultyBand`; for misconception slots prefer the weakest target (reuse the priority idea from `mastery/selectProblems.ts`); skip `recentProblemIds`; interleave so consecutive picks avoid sharing a principle.
  - If no authored candidate fits, call `generateVariantPublic(slot)` (injected, returns a public problem from a template) so variety is unbounded. If that also yields nothing, throw (no fallback).
- Tests: post-lesson length scales with course index; early course produces no synthesis slot, late course does; synthesis gated on a mastered second skill; review weights weakest misconceptions and uses no anchor; `composeAssignment` respects type/target/band, avoids recent repeats, interleaves principles, and throws when a slot cannot be filled.

## Task D: Wire the composer into the pages (Wave 2)

Files: `frontend/src/pages/ProblemSetPage.tsx`, `frontend/src/pages/PracticePage.tsx`, and only if required `frontend/src/components/problem/ProblemPlayer.tsx`, `frontend/src/lib/grading.ts`.

- `ProblemSetPage`: build `LearnerState` from `useProgress`, compute the target skill's course index from `courseMap`, call `chooseBlueprint('post-lesson', ...)` then `composeAssignment(...)`, pass the resulting problems to `ProblemPlayer`. Replace the current `selectPostLessonSet` usage.
- `PracticePage`: same with `review` context, no anchor skill.
- Variant problems flow through `ProblemPlayer` and `gradeAttempt` unchanged because the `problemId` carries the template and params; the backend `getProblemKey` derives the key. Confirm no answer data is needed on the client.
- Pixel alignment: reuse the existing `lesson-shell`, `experience-panel`, `feedback-panel`, `secondary-button`, `secondary-link`, session chrome classes exactly. No new layout unless a container is missing, and then minimal and token-based.
- Tests: the two pages render an assignment from a mocked composer boundary and pass it to a stubbed `ProblemPlayer`; the full suite stays green (these touch routing-adjacent code).

## Task F: AI synthesis and verification gate (Wave 3, flagged)

Files: `backend/functions/src/synthesis.ts`, `verifyProblem.ts`, tests, and a thin callable in `index.ts`.

- `verifyProblem(candidate, solveTwice)` is pure given an injected solver: requires independent re-solve consensus on the final answer, a units and numeric self-check, and that each declared misconception yields a distinct wrong answer; returns pass or fail with reasons. Unit tested with a mocked solver.
- `synthesizeProblem(...)` calls the model to compose a multi-principle problem, then runs `verifyProblem`. No fallback: on gate failure it throws or routes to a review record, never returns an unverified problem.
- Persistence of verified synthesis problems (Firestore) and the live model path are deploy-gated. Build them no-fallback, test the pure gate, mock the model boundary, and flag the live check for the user (needs OpenAI key, deploy, Blaze).

## Verification (controller, every wave)

```
cd frontend && npm test
cd frontend && npm run build
cd backend/functions && npm run build && npm test
```

All must be green before the next wave. After all waves, dispatch one
whole-branch reviewer (most capable model) over the full diff, then fix Critical
and Important findings in one pass.

## Self-review notes

- Spec coverage: content model (A), hybrid generation via code-computed variants (B) and AI synthesis (F), composer with both contexts and the mix and length scaling and synthesis gating (C), wiring (D), verification gate (F), no-fallback and server-only keys (global constraints). Phase 4 data calibration is intentionally out of scope.
- Type consistency: `Problem`, `SeedTemplate`, `Slot`, and the variant id contract are defined once here and copied verbatim into each task brief.
