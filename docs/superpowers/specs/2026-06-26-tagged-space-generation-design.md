# Tagged-Space Problem Generation: Design Spec

Status: draft for review
Date: 2026-06-26
Unifies: the typed-slot composer in `2026-06-26-problem-assignment-system-design.md`
and the generate-to-target review in `2026-06-26-emergent-misconceptions-design.md`

## Goal

Every problem set is a sequence of N tagged spaces. Each space carries a bundle of
tags that describe what its problem must address (skills, principles,
misconceptions) and how it should feel (purpose, difficulty). A generator produces,
for each space, a verified problem that satisfies its bundle. The blueprint that
assigns the tags is personalized per student, so the whole set is personalized to
the learner. No problem is served unless it is verified correct, and there is no
fallback: if a verified, on-target problem cannot be produced for a space, the
system errors rather than shipping an unverified or off-target one.

## Relationship to the two existing specs

This spec is the unifying model the other two are reaching toward, not a third
independent system.

- The problem-assignment spec defined typed slots (single, synthesis,
  misconception-review) filled from a hybrid bank. This spec generalizes the slot
  into an open tag bundle and makes generate-to-spec the primary fill path, with
  authored problems and code templates demoted to verified seeds.
- The emergent-misconceptions spec defined a per-student misconception graph and
  generate-to-target review for one tag (a misconception's wrong belief). This spec
  keeps that graph as the source of misconception tags and generalizes
  generate-to-target into generate-to-bundle.
- Net: one loop. Tag the spaces (blueprint), generate to satisfy the tags
  (generator plus verification), record results back into the per-student graph
  (mastery), repeat.

## Locked decisions

1. A problem set is N tagged spaces. A space is a tag bundle, not a fixed type.
2. Tags split into content tags (skills, principles, misconceptions, unit) that the generator must satisfy, and context tags (purpose, difficulty) that shape intent and style.
3. Generation is the primary fill path. Authored problems and code templates are gold-standard seeds and a verified fast path, not the default served content.
4. Every served problem is verified correct before assignment: a code-computed key for templates, an independent re-solve consensus gate for AI problems. No fallback.
5. Bundles are focused and satisfiable. The blueprint emits coherent briefs (one skill plus at most one trap, or two skills for synthesis), and the generator may reject an infeasible bundle rather than force a contrived problem.
6. Personalization lives in the blueprint (tag assignment from the student's state and phase). Variety lives in a per-set seed with real entropy, minted once and persisted, over a deterministic generator core.
7. Misconception tags come from the per-student emergent graph, not a fixed catalog.
8. Two contexts remain, as two tag-assignment policies over the same machinery: `post-lesson` (anchored on the just-finished skill, gates progression) and `review` (skill-agnostic, targets global weak spots).

## The tag taxonomy

A space is a bundle of two tag kinds. Content tags define the subject and must all
be satisfied by the generated problem. Context tags shape how the problem is framed
and scaffolded, not what it is about.

```ts
type Space = {
  // Content: the generator must satisfy all of these.
  content: {
    skillIds: string[];        // course-map skill ids; 1 = single-topic, 2+ = synthesis
    principleIds: string[];    // the deep structures to exercise
    misconceptionIds: string[];// per-student emergent node ids, each carrying a wrongBelief to bait
    unitId?: string;
  };
  // Context: shapes intent and style, not subject matter.
  context: {
    purpose: 'new' | 'review' | 'synthesis' | 'diagnostic';
    difficultyBand: number;    // 1..5, AP-Classroom is the top bands
  };
};
```

Purposes:

- `new`: first cold exposure to a skill. Still AP-hard; scaffolding lives in the hint and feedback layer, never in easier numbers.
- `review`: spaced retrieval of something already seen, usually baiting a weak or decaying misconception.
- `synthesis`: chains two or more skills and principles.
- `diagnostic`: probes an area the student has not been measured on, to seed the graph (optional, later phase).

## Layer 1: The blueprint (tag-assignment policy)

`chooseBlueprint(learnerState, context) -> Space[]`

The blueprint reads the per-student state (the emergent misconception graph with
strength and decay, the set of mastered skills, the course position, and the recent
problem ids) and emits N bundles. This is where personalization lives, and it is a
direct generalization of the current `chooseBlueprint`.

- Length scales with course depth: `post-lesson` from about 6 at the first skill to about 18 at the last (averaging about 12); `review` about 8, with an optional quick or long session.
- Per-space tag assignment shifts with the target skill's phase:
  - Early phase: mostly `new` spaces tagged with the current skill, plus a few `review` spaces for the misconceptions that skill has just started forming.
  - Mid phase: more `review` spaces tagged with the weakest and most-decayed misconceptions (lowest current strength first).
  - Late phase: `synthesis` spaces tagging the current skill with a mastered one, chaining principles, added only once at least one other skill is mastered.
- Coherence and interleaving: bundles stay focused (one primary skill plus at most one misconception, or two skills for synthesis); consecutive spaces avoid sharing a principle; difficulty is fixed at the AP band.
- Contexts:
  - `post-lesson`, anchored on the finished skill S: tags skew to S and S-adjacent misconceptions; synthesis appears only when a second skill is mastered; the set gates progression.
  - `review`, no anchor: tags are drawn across all learned skills, weighted to the globally weakest and most-decayed misconceptions, broadly interleaved.

## Layer 2: The generator (generate-to-spec)

`fillSpace(space, seed) -> { problem, key }` (verified)

Given a bundle, produce a verified problem that satisfies all its content tags,
framed by its context tags. Two engines, selected per space.

1. Template engine (verified by construction): if a seed template's tags cover the
   bundle, draw parameters from a seeded RNG, render the public problem, and compute
   the answer key in code. Exact, cheap, offline. Covers the common single-skill
   bundles. This is the existing template plus variant-key path.
2. AI generate-to-spec (composition): prompt the model to compose a problem
   satisfying the content bundle (for example, "a problem on these skills exercising
   these principles that a student who believes <wrongBelief> would get wrong, at AP
   band b"), then run the verification gate. Covers arbitrary bundles, including
   synthesis and emergent-misconception review.

Selection rule, no fallback: use a template if one fits the bundle; otherwise run AI
generate-to-spec and verify; otherwise throw, logging the unsatisfiable bundle. A
space is never filled with an unverified or off-target problem.

### Verification gate (mandatory for AI problems)

1. Independent re-solve consensus on the final answer (solve several times, ideally with a second model); require agreement.
2. Units and numeric self-check.
3. Targeting check: each tagged misconception must yield a distinct, plausible wrong answer, so the trap the space asked for is actually present.
4. Confidence score. At or above threshold the problem enters the bank. Below threshold it goes to a human review queue, never served.

Output is a public `Problem` (no answers) plus a server-only `ProblemKey`
(statement, correctSolution, finalAnswer, rubric, flaws). The variant-id and
server-key derivation contract from the assignment spec carries over, so the public
problem and the key are both derivable and no answer ever reaches the client.

### Warm pool (cost and latency control)

Verified problems are stored in a pool keyed by a normalized tag-signature and
reused across students, replenished in the background. A space is usually filled
from the pool instantly; on-demand generation is the rare miss. The pool is what
makes composing and verifying a full set affordable.

## Layer 3: Record and close the loop (mastery)

- Grading returns `errorType` and, for conceptual errors, a `signature`, per the emergent-misconceptions spec. A conceptual miss runs match-or-create against the student's graph; a catch credits the targeted misconception with the spacing rule.
- The blueprint reads the updated graph next time. The loop closes: the blueprint tags from the graph, the generator realizes the tags, the grader writes back to the graph.

## Determinism and variety (the seed)

- The generator core is deterministic given a bundle and a seed: the same inputs produce the same problem. This is required so a set rebuilds identically on resume and across the same student's devices, and so the pure logic is unit-testable. No `Math.random` in the core.
- Variety comes from a per-set seed with real entropy, minted once when a set is first created and persisted on the session (`ProblemSetSession` gains a `seed`). On resume the set is reconstructed from the persisted problem ids (the existing rehydrate path), not regenerated. Practice mints a fresh seed per visit.
- This replaces the current low-entropy seed (`recentProblemIds.length`) and removes the practice equals post-lesson duplication, because the two contexts no longer share a seed base or always draw the first template.

## Integration with what exists

- Composer (`frontend/src/assign/*`): `Slot` becomes `Space` (a tag bundle); `chooseBlueprint` emits bundles; `composeAssignment` fills via `fillSpace`, preferring generation over canned authored problems.
- Templates (`frontend/src/content/templates`, `backend/functions/src/templates`): remain the verified fast path; authored problems demote to seeds.
- Synthesis and verification (the deploy-gated Wave 3 of the assignment spec): becomes the AI generate-to-spec engine, generalized from synthesis-only to any bundle.
- Emergent misconceptions: supplies the misconception tags and the generate-to-target review, now a special case of generate-to-bundle.
- Pages and persistence (`ProblemSetPage`, `problemSessionProgress`): `ProblemSetSession` gains a persisted `seed`; `rehydrateAssignment` already reconstructs a set from its ids.
- Grading contract unchanged: each problem carries a `ProblemKey` consumed by `gradeWithOpenAI` in `backend/functions/src/openai.ts`.

## Error handling (no fallback)

- A space that cannot be filled with a verified, on-target problem surfaces an explicit error or is dropped with a logged reason. It is never filled with an unverified or off-target problem.
- AI problems below the verification threshold route to the human queue, never served.
- A wrong answer key is the worst failure mode, since it would grade correct work as wrong. The gate exists specifically to prevent it.

## Testing strategy

- Pure, deterministic, unit tested: blueprint tag assignment (phase ratios, length scaling, coherence and interleave, the two contexts), generator selection (template vs AI), template draw plus key derivation (golden tests), the verification gate logic (with a mocked solver), seed determinism, and round-trip rehydrate.
- The model boundary (AI compose, AI judge, re-solve consensus) is mocked at the seam in unit tests. Live generation and verification quality is an integration check behind the deploy flag.

## Risks and costs (honest)

- Generation and verification quality is the make-or-break: a wrong key marks correct work wrong, and an off-target problem fails to bait the misconception the space asked for. The gate plus the template fast path are the mitigations.
- Cost and latency: composing and verifying N problems per set is many model calls. The warm pool keyed by tag-signature is the primary control; templates are free.
- Bundle feasibility: over-tagged or contradictory bundles produce contrived or impossible problems. The blueprint must emit focused, satisfiable bundles, and the generator must reject the rest.
- Cold start: a new student's misconception graph is empty, so early sets lean on `new` and skill tags until the graph grows.
- Deploy-gated: the AI engine needs the OpenAI key, a deploy, and the Blaze plan. The template path works offline today.

## Phasing

1. Generalize `Slot` to `Space` (a tag bundle) and `chooseBlueprint` to emit bundles; keep the template fill path; flip selection to generation-first over authored seeds; add the per-set persisted seed. Pure and testable, no new AI, works on the Coulomb templates today.
2. Build AI generate-to-spec plus the verification gate (generalize the Wave 3 synthesis engine to any bundle); add the warm pool keyed by tag-signature. Deploy-gated.
3. Wire emergent-misconception tags into the blueprint and route generate-to-target review through the same `fillSpace` path.
4. Expand seed templates across skills, then tune (match thresholds, pool sizes, cost controls).

## Out of scope (for now)

- Global cross-student problem sharing beyond the tag-signature pool.
- Non-E&M subjects.
- Full IRT difficulty calibration.

## Open / tunable parameters

- The tag vocabulary edges: which context tags beyond purpose and difficulty are worth modeling (for example a calculus-required flag or a format hint).
- The coherence bound (maximum content tags per bundle) and the exact phase ratios.
- Pool size per tag-signature and the replenishment cadence.
- Verification thresholds, and whether a second model is required for consensus.
