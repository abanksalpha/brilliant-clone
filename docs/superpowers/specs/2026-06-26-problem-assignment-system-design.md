# Problem Assignment System: Design Spec

Status: draft for review
Date: 2026-06-26
Scope: how krilliant chooses, generates, and verifies the problems it assigns

## Goal

Build an assignment composer backed by a hybrid problem bank. It assembles
AP-Classroom-hard problem sets with a deliberate mix of single-topic, synthesis,
and misconception-review problems, tuned to each learner. Every problem, authored
or AI generated, is verified correct before it can ever be assigned. Nothing is
mocked and nothing falls back: if a verified problem cannot be produced, the
system errors rather than shipping an unverified one.

## Locked decisions

1. Source: hybrid (authored seed templates + verified AI variants + verified AI synthesis).
2. Taxonomy: skills (the existing course-map nodes) plus a thin principle layer, plus the cross-cutting misconception catalog.
3. Composition: an adaptive blueprint of typed slots whose ratios shift with the learner's phase; slots are then filled adaptively.
4. Difficulty: uniform AP-Classroom hard from rep one. Scaffolding lives in the hint and feedback layer, never in easier problems.
5. Verification: layered auto-gate (code-computed keys for variants, independent re-solve consensus for synthesis, human review queue for the tail).
6. Set length: post-lesson sets average about 12 problems, scaling shorter at the start of the course and longer at the end.
7. Contexts: two distinct assignment contexts with different generation logic. `post-lesson` is anchored on the just-finished skill and gates progression. `review` (the dashboard Practice button) is skill-agnostic and targets the global mastery state.

## Definitions and taxonomy

- Skill: one of the roughly 35 nodes already in `frontend/src/content/courseMap.ts`. Each gets a stable `skillId` and keeps its teaching-order index, which is the prerequisite signal (a later skill in a unit depends on earlier ones).
- Principle: a new thin layer of roughly 12 deep structures that problems are also tagged with. A synthesis problem chains two or more principles. Draft set: `superposition`, `symmetry-gauss`, `field-concept`, `energy-potential`, `conductor-equilibrium`, `capacitance`, `circuit-conservation`, `ohmic-transport`, `magnetic-force`, `magnetic-source`, `induction`, `transients`.
- Misconception: the existing cross-cutting catalog in `frontend/src/content/misconceptions.ts`, expanded over time.
- Problem kinds: `single` (one skill tag), `synthesis` (two or more skill tags, chains two or more principles), `misconception-review` (seeded to bait one specific misconception).

## Layer 1: Content model

Extend the public `Problem` so the composer can reason about it. The key change
is `lessonId` becoming `skillIds[]`.

```ts
type ProblemKind = 'single' | 'synthesis' | 'misconception-review';

type Problem = {
  problemId: string;
  skillIds: string[];          // 1 = single-topic, 2+ = synthesis
  principleIds: string[];      // deep structures exercised
  misconceptionTags: string[];
  kind: ProblemKind;
  difficultyBand: number;      // 1..5, AP-Classroom = top bands
  difficultyFeatures: {
    steps: number; symbolic: boolean; calculus: boolean;
    multiPart: boolean; hasTrap: boolean;
  };
  provenance: 'authored' | 'variant' | 'synthesis';
  templateId?: string;
  prompt: string;
  givens?: { label: string; value: string }[];
  figure?: string;
};
```

The server-side answer key keeps the shape the grader already consumes (`backend/functions/src/problemKeys` and `backend/functions/src/types.ts`), so the
grading path in `backend/functions/src/openai.ts` barely changes.

The authored gold standard is a seed template. Variants are produced by drawing
new parameters and computing the key in code, so the key is exact by
construction.

```ts
type SeedTemplate = {
  templateId: string;
  skillIds: string[];
  principleIds: string[];
  difficultyBand: number;
  params: ParamSpec;                 // ranges plus constraints (e.g. r < R)
  promptTemplate: string;            // numbers filled from a param draw
  solve: (p: Params) => { correctSolution: string[]; finalAnswer: string };
  flaws: { misconceptionId: string; buggyPath: (p: Params) => string }[];
};
```

## Layer 2: Generation and verification pipeline

Runs server-side (Firebase Functions), since generation needs an LLM and the keys
must stay off the client.

- Variant generation: pick a seed template, draw parameters honoring constraints
  and an "interesting" filter (avoid degenerate or ugly numbers), render the
  prompt, compute the correct answer and each flaw's buggy answer in code. The
  only model-touched part is optional prompt wording; a cheap check confirms the
  rendered numbers match the parameters. Trustworthy by construction.
- Synthesis generation: an LLM composes a novel multi-principle problem, which
  must then pass the gate:
  1. Independent re-solve agreement: solve it several times independently (and
     ideally with a second model), require consensus on the final answer.
  2. Numeric and unit self-check.
  3. Buggy-path check: every declared misconception must yield a distinct,
     plausible wrong answer.
  4. Confidence score. Pass enters the bank. Below threshold goes to a human
     review queue. Never shipped unverified.
- Bank and pool: verified problems (public `Problem` plus server `ProblemKey`)
  are stored in Firestore and kept as a warm pool per skill and template, so
  assembling an assignment is fast and deterministic. The pool is replenished in
  the background.

## Layer 3: Assignment composer

Two pure, independently testable units, plus a context input.

### Blueprint chooser

`chooseBlueprint(learnerState, context) -> Slot[]`

```ts
type Slot = {
  type: ProblemKind;
  target: { skillId?: string; principleId?: string; misconceptionId?: string };
  difficultyBand: number;     // AP band by default
  constraints?: { mustChainPrincipleIds?: string[] };
};
```

- `context = 'post-lesson'`, anchored on the just-finished skill S:
  - Length scales with S's course index: `length = round(lerp(6, 18, index / (N - 1)))`, clamped, averaging about 12.
  - Mostly single-topic slots on S, all at the AP band.
  - One to a few misconception-review slots for S's known traps and any weak or decaying misconceptions related to S.
  - Synthesis slots pairing S with previously mastered skills and principles. Their count grows with S's mastery and course depth. Gated: a synthesis slot is only added when its component skills are each already at or near mastery, so the learner is never drowned and a failure is diagnosable.
  - Net effect: early skills produce short sets (few priors, few accumulated misconceptions), late skills produce long sets. This reinforces decision 6 without a separate rule.
- `context = 'review'` (Practice button), skill-agnostic:
  - Composes from the whole set of learned skills, not the most recent lesson.
  - Weighted toward weakest and most-decayed misconceptions (misconception-review slots), plus general spaced retrieval across all learned skills (single-topic slots, including skills that are not currently weak, to prevent decay), plus synthesis across mastered skills.
  - Interleaved broadly. Default length moderate (about 8 to 10), optionally a learner-chosen quick or long session.

Phase logic (how ratios shift on a skill): early phase favors single-topic to
build the model, mid phase adds misconception-review of shaky ideas, late phase
adds synthesis once the parts are solid. Phase is read from the per-skill mastery
estimate.

### Slot filler

`fillSlot(slot, learnerState, bank) -> Problem`

- Select the best matching verified problem from the bank for this slot and
  learner: matches the slot type, target, and difficulty band; targets the
  weakest or most-decayed misconception when relevant (reuse the priority logic
  in `frontend/src/mastery/selectProblems.ts`); avoids recent repeats using the
  learner's `problemAttempts` history; interleaves so consecutive problems avoid
  sharing a principle (extend the existing tag-interleave logic from principle to
  principle).
- If the bank has no fitting verified problem, trigger verified generation
  (variant or synthesis) and fill. With a warm pool this is rare.

Output: an `Assignment` = ordered `Problem[]` plus a short rationale per problem
("targets the field vs potential mix-up you missed twice"), for transparency and
learner autonomy.

## Effectiveness rationale

Every lever maps to evidence already gathered for this product:

- Retrieval practice: problems are cold, no pre-scaffolding.
- Interleaving: mix skills and principles, no back-to-back same principle.
- Spacing: misconception strength decays over time and drives review slots.
- Desirable difficulty: uniform AP band, kept productive by tiered hints.
- Expert categorization: synthesis forces the learner to choose which principle applies, the deep-structure skill that separates experts from novices.
- Misconception confrontation: review slots are seeded to bait a specific wrong model, then the handwriting grader catches and names it.

## Integration with existing systems

- Grading: each assigned problem already carries a `ProblemKey`, consumed by `gradeWithOpenAI` in `backend/functions/src/openai.ts`. No change to the grading contract.
- Mastery: grading results flow through `recordProblemResult` (`frontend/src/progress/ProgressContext.tsx`) into the per-misconception model in `frontend/src/mastery/masteryModel.ts`. The composer reads that map, the grader writes to it. Closed loop.
- Gating: a skill is mastered when the learner clears AP-band single and synthesis problems on it without hints and its misconceptions are recently caught. This drives the soft gate in `frontend/src/mastery/gating.ts`.
- Dashboard: the post-lesson set is reached from a finished lesson; Practice and Mastery map are the existing dashboard entries.

## Error handling (no fallback)

- If a slot cannot be filled with a verified problem, the assignment surfaces an explicit error or drops the slot with a logged reason. It never inserts a fabricated or unverified problem.
- Verification failures route to the human queue, never silently shipped.
- A wrong answer key is treated as the worst failure mode, since it would grade correct work as wrong. The layered gate exists specifically to prevent it.

## Testing strategy

- Pure logic, deterministic, unit tested: blueprint chooser (phase ratios, length scaling, synthesis gating, the two contexts), slot filler (selection priority, no-repeat, interleaving), difficulty rubric scoring, template `solve` and `buggyPath` correctness (golden tests with known parameters), mastery integration.
- Generation and verification: tested with seeded fixtures, the LLM boundary mocked in unit tests. Live verification is an integration check with real model calls.

## Implementation phasing

1. Content model and taxonomy: extend `Problem`, add principles, add `SeedTemplate`, migrate the existing Coulomb problems and keys to the new shape.
2. Authored templates plus code-computed variants populating the pool, and the composer (both contexts) selecting from the pool. No AI generation yet.
3. AI synthesis generation plus the verification gate and human review queue.
4. Data-calibrated difficulty refinement once there is solve-rate volume.

## Tunable parameters (defaults)

- Post-lesson set length: lerp 6 to 18 by course index, average about 12.
- Practice set length: about 8 to 10, optional quick or long.
- Phase thresholds, blueprint ratios per phase, and synthesis-gating mastery threshold: start from sensible defaults, refine with data.

## Out of scope (for now)

- Full IRT difficulty calibration (phase 4 only).
- Cross-student crowd-sourced misconception mining.
- Non-E&M subjects.

## Open questions

- Exact phase thresholds and per-phase slot ratios (will propose concrete numbers in the plan).
- Whether the composer runs as a callable returning a full assignment, or client-side selection over a synced pool with a callable only for generation.
