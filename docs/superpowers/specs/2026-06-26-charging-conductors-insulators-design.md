# Charging, Conductors & Insulators: Lesson Design Spec

Status: draft for review
Date: 2026-06-26
Lesson: #2 in AP Physics C: Electricity and Magnetism (the node after Coulomb's Law)
Builds on: `frontend/src/content/lessons/lesson1.json` (Coulomb's Law) and its bespoke player

## Goal

Build the second complete, learn-by-doing lesson, "Charging, Conductors &
Insulators," to the same depth and craft as Coulomb's Law (about 26 steps, a mix
of concept cards and hands-on interactions, every scene a hand-built SVG, every
wrong answer hand-written). The lesson assumes everything Coulomb taught and adds
conductors vs insulators, polarization, the three charging methods (friction
recap, conduction, induction), grounding, why a charged object attracts a neutral
one, and where charge sits on a conductor. It ships behind the existing course
path and is reachable, playable end to end, and visually correct to the pixel.

The build itself is part of the design: a parallel, self-verifying subagent
pipeline driven by a ralph loop, specified below.

## Locked decisions

1. Lesson is "Charging, Conductors & Insulators" (`skillId`/`lessonId`
   `charging-conductors-insulators`, already in `courseMap.ts`), lesson number 2,
   content file `lesson2.json`.
2. Depth matches Coulomb: 26 steps, 11 concept cards and 15 interactive.
3. Build on Coulomb, do not re-teach it. Coulomb already covered: two charge
   signs, charging by electron transfer (triboelectric), conservation of charge,
   force across a gap, attraction/repulsion, and the inverse-square law. This
   lesson references those in at most a one-line recap and reuses the
   inverse-square idea for the neutral-attraction payoff.
4. The lesson is the deliverable. The separate handwritten, server-graded problem
   set is out of scope for this build (see Out of scope).
5. Parallelism model: shared working tree with strict file ownership. Shared
   files are written once in a serial Foundation phase, then each step is built by
   exactly one subagent that owns only its own files.
6. Per-step pipeline: a builder subagent builds the step in its own loop, then an
   independent verifier subagent re-checks it from scratch. Only a verifier pass
   closes a step. Any defect re-opens the builder. The orchestrator runs a final
   hard verification at integration.
7. Subagents run on `claude-opus-4-8-thinking-max-fast` (opus 4.8, max reasoning,
   fast), inside a ralph loop (`.cursor/ralph-loop.local.md`, sentinel
   `.cursor/ralph-done`) that exits only when every gate is green.
8. Visual gate is pixel-level and animation-aware: many screenshots across the
   full timeline of every animation, not just first and last frame.
9. UI copy uses no em dashes and no extraneous controls or text. Follow impeccable
   (OKLCH, tinted neutrals, no banned patterns) and the existing hand-drawn theme.

## Persona and prerequisites

Same persona as Coulomb: a high school student in AP Physics C E&M, or a
self-studier, who learns by doing. Prerequisite in the data:
`["coulombs-law"]`.

## Target intuitions

1. Conductors (metals) have free electrons that roam; insulators (rubber, glass,
   plastic) hold their electrons locked to atoms.
2. A charged object polarizes a nearby neutral object, separating its charge.
   Because the near side is the opposite charge and closer, inverse-square makes
   the net force an attraction. (The Coulomb callback, and the resolution of the
   sticky-balloon hook.)
3. Charging by conduction (touch) leaves the same sign; charging by induction (no
   touch, using a ground) leaves the opposite sign.
4. Grounding connects an object to the earth, a limitless reservoir, so electrons
   flow in or out freely.
5. Insulators polarize too, molecule by molecule, with no free flow.
6. Excess charge on a conductor spreads out and rides the outer surface.

## Learning arc

The sticky-balloon puzzle, then conductors vs insulators (free vs bound), then
polarization, then why neutral objects attract (near side wins by inverse
square), then conduction (same sign), then grounding, then induction (opposite
sign, ordered correctly), then insulator polarization (resolving the hook), then
charge on the surface, then a summary that closes the puzzle.

## The 26 steps (content contract)

C = concept card, I = interactive. "Gate" notes per-step behavior gates copied
from the Coulomb engine: explore (choices hidden until the learner interacts),
stage-choice (answer chosen on the canvas), reveal (a control appears only after a
correct step).

| # | Type | Title | Interaction | Correct answer / goal | Key misconception targeted | Gate / animation |
|---|------|-------|-------------|-----------------------|----------------------------|------------------|
| 1 | C | The sticky balloon | none | n/a | "neutral means no electric effect" | static hook (balloon on wall) |
| 2 | C | Two kinds of material | none | n/a | "all materials behave the same" | static (metal vs plastic) |
| 3 | I | Where can electrons move? | tap/drag electrons | electrons slide in metal, stuck in insulator | "charge moves through everything" | explore; animated drift |
| 4 | C | The sea of free electrons | none | n/a | "electrons are fixed to their atom" | static (electron sea) |
| 5 | I | Conductor or insulator? | multiple-choice | copper conducts, rubber insulates | "metal vs non-metal is about being shiny" | none |
| 6 | C | Charge nearby disturbs it | none | n/a | "a far charge does nothing to a neutral object" | static |
| 7 | I | Polarize the metal | drag rod toward sphere | electrons gather far side, near side positive | "the whole object takes the rod's sign" | explore; electrons slide as rod nears |
| 8 | I | Which side turns positive? | tap/stage-choice on canvas | the near side (closest to the rod) | "the far side faces the rod" | stage-choice |
| 9 | C | Why neutral things attract | none | n/a | "equal and opposite cancels to zero" | static (near big arrow, far small arrow) |
| 10 | I | See the net pull | sandbox (drag rod) | net arrow points toward the rod | "attraction needs opposite net charge" | explore; live near/far/net arrows |
| 11 | I | Attract or repel? | multiple-choice | always attract, either rod sign | "a positive rod repels a neutral object" | none |
| 12 | C | Three ways to charge | none | n/a | "touching is the only way to charge" | static (friction recap, conduction, induction) |
| 13 | I | Charging by conduction | tap to touch rod to sphere | sphere ends same sign as rod | "touching makes the opposite sign" | explore; electrons spread on, rod leaves |
| 14 | I | What sign after touching? | multiple-choice | same sign as the rod | "conduction gives the opposite sign" | none |
| 15 | C | Grounding | none | n/a | "ground adds positive charge" | static (wire to earth) |
| 16 | I | Drain it to ground | tap to ground | sphere goes neutral | "grounding makes it positive" | electrons flow out to earth |
| 17 | C | The induction trick | none | n/a | "you must touch to charge" | static |
| 18 | I | Charging by induction | stepwise multi-stage scene | sphere left opposite the rod | "remove the rod before the ground" | explore; 4 staged frames (approach, ground, unground, withdraw) |
| 19 | I | What sign after induction? | multiple-choice | opposite the rod | "induction copies the rod's sign" | none |
| 20 | I | Order the induction steps | ordering (new widget) | bring rod, ground, remove ground, remove rod | "ungrounding order does not matter" | none |
| 21 | C | Insulators polarize too | none | n/a | "insulators cannot be affected" | static (molecular dipoles) |
| 22 | I | Polarize an insulator | drag rod near insulator | dipoles rotate to face the rod | "only metals polarize" | explore; dipoles rotate as rod nears |
| 23 | C | Charge rides the surface | none | n/a | "charge spreads through the volume" | static |
| 24 | I | Spread to the surface | sandbox (add electrons) | electrons push apart onto the surface | "added charge clumps where you put it" | explore; electrons relax to surface |
| 25 | I | Share the charge | numeric | each sphere ends Q/2 | "charge stays all on the first sphere" | none |
| 26 | C | You explained the balloon | none | n/a | n/a | static summary, resolves the hook |

Counts: concepts at 1, 2, 4, 6, 9, 12, 15, 17, 21, 23, 26 (11). Interactive at 3,
5, 7, 8, 10, 11, 13, 14, 16, 18, 19, 20, 22, 24, 25 (15). Total 26.

Every interactive step carries hand-written `feedback.correct`, per-choice
`feedback.wrong`, and an `explanation` revealed only after a correct answer, in
the Coulomb style. The full copy is authored in `lesson2.json` during Foundation.

## Interaction inventory

Reused from Coulomb without change (read-only dependencies): `NumericInput`,
`ChargeSandbox` (steps 10, 24 reuse the sandbox engine and arrows), the
multiple-choice and tap rail, the stage-choice pattern (step 8), and all of
`scenes/primitives.tsx` (`Charge`, `Arrow`, `DragHandle`, `Legend`,
`ReadoutRow`, `MiniPanel`, `Figure`, `usePointerDrag`, `clamp`).

New, built in Foundation because steps depend on them:
- `interactions/Ordering.tsx` (+ test): a reusable widget that asks the learner to
  put N labeled steps in the correct order (drag to reorder or tap-to-sequence),
  with a Check control and correct/incorrect result. Used by step 20. Schema adds
  an `OrderingConfig` and `interactionType: 'ordering'`.

Bespoke animated scenes (one file per step, built by per-step subagents) follow
the `RubTransferScene` pattern from Coulomb (requestAnimationFrame timeline,
reduced-motion fallback to the final state). The reusable pure helpers they need
(net force from charges, inverse-square magnitudes) come from the existing
`components/lesson/physics.ts`; any genuinely new pure helper (for example a
1-D electron relaxation toward the surface) is added there with unit tests.

## Contracts and structural choices

- New per-step file layout. Coulomb groups scenes into three big files
  (`conceptScenes.tsx`, `interactiveScenes.tsx`). For safe parallelism this
  lesson uses one file per step under
  `frontend/src/components/lesson/scenes/charging/`. This is a deliberate,
  bounded change that serves the parallel build; primitives and physics stay
  shared and read-only.
- Co-located CSS. Each scene imports its own stylesheet
  (`StepNN_Name.css`) so no two subagents edit one stylesheet. All classes are
  namespaced with a `cci-` prefix plus the step number to guarantee no global
  collisions. Theme tokens (OKLCH vars, sketch variables) continue to come from
  `styles.css` and are only referenced, never edited, by scenes.
- Dev Scene Gallery. A DEV-only, unprotected route renders any single step in
  isolation at a fixed viewport: `/dev/charging/:step`. For animated steps it
  exposes a deterministic time control (`?t=<ms>`) that drives the scene's
  timeline to an exact frame, so a verifier can screenshot the entire animation
  frame by frame. Gated by `import.meta.env.DEV`; absent from production builds.

## File structure and ownership

Shared, written once in Foundation (serial; no per-step subagent touches these):
- Create `frontend/src/content/lessons/lesson2.json` (all 26 steps, full copy).
- Modify `frontend/src/content/schema.ts` (add `OrderingConfig`, extend
  `InteractionType` and `InteractiveStep`).
- Modify `frontend/src/content/index.ts` (import and register `lesson2`).
- Modify `frontend/src/content/content.test.ts` (validate lesson 2 like lesson 1:
  counts, ids, feedback presence, answer configs).
- Create `frontend/src/components/lesson/ChargingExperience.tsx` (the per-step
  driver: a switch over step numbers to scenes, with the gating sets, mirroring
  `CoulombExperience.tsx`). Imports all 26 scene files; scenes start as labeled
  placeholder stubs.
- Modify `frontend/src/components/lesson/LessonRenderer.tsx` (branch to
  `ChargingExperience` when `lesson.lessonId === CHARGING_LESSON_ID`, mirroring
  the existing Coulomb branch).
- Create `frontend/src/components/lesson/interactions/Ordering.tsx` (+ test).
- Modify `frontend/src/progress/dashboardProgress.ts` (add lesson 2 to
  `LIVE_LESSONS` with `sequence: 2`).
- Modify `frontend/src/components/lesson/physics.ts` only if a new pure helper is
  needed (added once, with tests).
- Create the Scene Gallery route and wire it into `frontend/src/App.tsx`
  (DEV-only, unprotected).
- Pre-create empty per-step files so no two subagents ever create the same path:
  `scenes/charging/StepNN_Name.tsx`, `StepNN_Name.css`, `StepNN_Name.test.tsx`
  for all 26 steps.

Per-step, owned by exactly one builder subagent (parallel; conflict-free):
- `frontend/src/components/lesson/scenes/charging/StepNN_Name.tsx`
- `frontend/src/components/lesson/scenes/charging/StepNN_Name.css`
- `frontend/src/components/lesson/scenes/charging/StepNN_Name.test.tsx`

A subagent reads the lesson JSON, the schema, the primitives, the physics module,
and the gallery, and writes only its three files.

## Build and verification pipeline

Phase 1, Foundation (serial). Produce every shared file above so all contracts
(types, JSON, driver wiring, gallery, registration, ownership stubs) exist and the
app compiles with placeholder scenes. Gate: `npm run build` and `npm test` pass
with placeholders; the gallery renders each placeholder step; the lesson is
reachable at its URL when signed in.

Phase 2, Per-step build (parallel, batched). For each of the 26 steps:
- Builder subagent (opus 4.8 max, fast): implements the scene and interaction in
  its three files, writing tests first (TDD), and loops on its own until tests,
  typecheck, and its own visual check pass.
- Verifier subagent (opus 4.8 max, fast), dispatched independently after the
  builder reports done: re-runs the step's tests, typechecks, and performs the
  visual gate from scratch against the gallery (see next section). It returns
  PASS or a concrete defect list. A defect list re-opens the builder with those
  defects. A step closes only on a verifier PASS.

Phase 3, Integration (serial, orchestrator). Full `npm run build`, full
`npm test`, then a Playwright playthrough of all 26 real steps in sequence with a
signed-in dev account navigating straight to the lesson URL, screenshotting each
step, confirming step-to-step flow, gating/progress wiring, XP and completion, and
cross-step visual rhythm. The orchestrator does its own hard verification here.
Any regression re-opens that step.

The ralph loop wraps all phases. Its task prompt re-checks a status ledger each
iteration, repairs or completes Foundation, dispatches builders and verifiers for
any not-yet-green step, runs integration, and writes `.cursor/ralph-done` only
when Foundation, all 26 steps, and Integration pass every gate. It never writes
the sentinel to exit early.

## Visual and animation verification gate

For every step, against the DEV Scene Gallery (no auth):
- Static correctness: the resting frame matches the step's intent and the
  hand-drawn theme.
- Pixel alignment: elements centered on the scene grid; charge glyphs baseline
  centered; arrows anchored to charge edges, not overlapping glyphs; nothing
  clipped at the SVG viewBox; the rail prompt, choices, and feedback aligned to
  the same vertical rhythm as Coulomb; consistent shared scale constants.
- Animation correctness: drive the timeline with `?t=<ms>` across the full
  duration and capture a dense series of frames (at least 12 evenly spaced, plus
  the exact transition boundaries for staged scenes like induction). Verify the
  animation actually progresses (no frozen or skipped frames), motion is smooth
  and monotonic where intended, the end state is correct (for example wool stays
  positive, balloon negative; induction leaves the opposite sign), and the
  reduced-motion path jumps straight to the correct final frame.
- Behavior: tests cover correct and incorrect answers, the explore gate, and the
  reveal/stage-choice behavior where applicable.

A step is done only when both pixel alignment and full-timeline animation checks
pass under the independent verifier.

## Integration points (exact, for reachability)

- Routing: `/lesson/:lessonId` is generic and protected by auth only
  (`App.tsx`). A registered lessonId routes automatically; no route change for the
  lesson itself. The gallery route is added separately, DEV-only and unprotected.
- Liveness: a lesson is live when its id is in `LIVE_LESSONS`
  (`dashboardProgress.ts`) and registered in `content/index.ts`. Adding both makes
  lesson 2 load by id and count in progress.
- Dashboard gating (UI only): a live lesson node becomes clickable when the prior
  lesson is completed, its problem set is solved, and the mastery gate passes
  (`DashboardPage.tsx` line ~209). This affects the dashboard node, not direct
  navigation. The integration playthrough navigates directly to the lesson URL, so
  it does not depend on completing Coulomb's problem set. A dev helper (mirroring
  `dev/devReset.ts`) seeds a signed-in account so the dashboard node is also
  openable when checked manually.

## Constraints (apply to every subagent)

- No em dashes anywhere in UI copy. No extraneous UI: only the controls the step
  needs.
- Pixel-perfect alignment on all graphical work.
- Follow the existing hand-drawn theme and the `cl1-`/scene conventions; namespace
  new classes `cci-`.
- impeccable design laws: OKLCH, tinted neutrals, no banned patterns
  (no side-stripe borders, no gradient text, no glassmorphism by default).
- TDD: write the failing test first; keep files small and single-purpose.

## Risks and mitigations (honest)

- Parallel transient states: a verifier could screenshot mid-edit. Mitigation:
  verifiers run only after a builder reports done, and re-run on a clean state;
  the ralph loop re-checks.
- Animation determinism: RAF timelines are time-based, so screenshots must be
  deterministic. Mitigation: the gallery `?t=<ms>` control drives exact frames;
  scenes derive all motion from a single elapsed-time input (as `RubTransferScene`
  already does).
- Visual consistency across 26 independently built scenes. Mitigation: shared
  primitives, shared scale constants, a fixed gallery viewport, and the
  integration rhythm check; build two template steps first (one interactive, the
  induction animation) to set the bar.
- Full-playthrough auth. Mitigation: gallery is unprotected for per-step work; the
  playthrough uses a seeded dev account and direct URL navigation.
- Scene count and cost: 26 builder plus 26 verifier subagents on opus 4.8 is
  heavy. Mitigation: batch the parallel fan-out; the gallery keeps each
  verification fast and isolated.
- Schema change blast radius: adding `ordering` touches shared types and tests.
  Mitigation: done once in Foundation, with content tests, before any fan-out.

## Out of scope (for now)

- The handwritten, server-graded problem set for this lesson (answer keys in Cloud
  Functions, problem templates, problem JSON, verification).
- Any backend, mastery model, or grading change.
- New lessons beyond #2, and any change to Coulomb's content.

## Open / tunable parameters

- Exact frame count and sampling for animation verification (default at least 12,
  plus staged boundaries).
- Parallel batch size for the fan-out (throughput vs machine load).
- Whether to keep the two template steps as a human checkpoint or run fully
  autonomous (current plan: automated independent verification, no human stop).
