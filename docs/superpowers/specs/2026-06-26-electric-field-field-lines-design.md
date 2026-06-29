# Electric Field & Field Lines: Lesson Design Spec

Status: draft for review
Date: 2026-06-26
Lesson: #3 in AP Physics C: Electricity and Magnetism (the node after Charging, Conductors & Insulators)
Builds on: `frontend/src/content/lessons/lesson1.json` (Coulomb's Law), `frontend/src/content/lessons/lesson2.json` (Charging, Conductors & Insulators), and their bespoke players

## Goal

Build the third complete, learn-by-doing lesson, "Electric Field & Field Lines,"
to the same depth and craft as Coulomb's Law and Charging (about 27 steps, a mix
of concept cards and hands-on interactions, every scene a hand-built SVG, every
wrong answer hand-written). The lesson assumes everything Coulomb and Charging
taught and adds the field concept (E = F/q as a property of space), the field of a
point charge (E = kQ/r squared), the direction convention, superposition of
fields, and field lines (their rules and how to read single-charge, dipole, and
like-charge patterns). It ships behind the existing course path and is reachable,
playable end to end, and visually correct to the pixel.

The build itself is part of the design: a parallel, self-verifying subagent
pipeline driven by a ralph loop, specified below, identical in shape to the
Charging lesson build with the deltas called out explicitly.

## Locked decisions

1. Lesson is "Electric Field & Field Lines" (`skillId` `electric-field-field-lines`,
   already in `courseMap.ts`; a `lessonId` of the same value is added to make it
   live), lesson number 3, content file `lesson3.json`.
2. Depth matches Coulomb and Charging: about 27 steps, 11 concept cards and 16
   interactive. Final counts are a tunable parameter (see Open parameters); the
   step table below is the concrete target.
3. Build on Coulomb and Charging, do not re-teach them. Already covered and reused
   in at most a one-line recap: two charge signs, force across a gap,
   attraction/repulsion, the inverse-square law, and superposition of forces
   (Coulomb); conductors vs insulators and polarization (Charging). This lesson
   reframes force-between-two-charges as field-times-charge, and reuses the
   inverse-square and superposition ideas for the field.
4. Scope is point charges only. Continuous charge distributions (line, ring, disk,
   integration) are the next lesson, "Electric Fields of Charge Distributions,"
   and are out of scope here. The field inside and at the surface of a conductor is
   touched only as a one-line callback, not derived (it belongs to
   "Electrostatics with Conductors").
5. The lesson is the deliverable. The separate handwritten, server-graded problem
   set is out of scope for this build (see Out of scope).
6. Parallelism model: shared working tree with strict file ownership. Shared files
   are written once in a serial Foundation phase, then each step is built by
   exactly one subagent that owns only its own files.
7. Per-step pipeline: a builder subagent builds the step in its own loop, then an
   independent verifier subagent re-checks it from scratch. Only a verifier pass
   closes a step. Any defect re-opens the builder. The orchestrator runs a final
   hard verification at integration.
8. Subagents run on `claude-opus-4-8-thinking-max-fast` (opus 4.8, max reasoning,
   fast), inside a ralph loop (`.cursor/ralph-loop.local.md`, sentinel
   `.cursor/ralph-done`) that exits only when every gate is green.
9. Visual gate is pixel-level and animation-aware: many screenshots across the
   full timeline of every animation, not just first and last frame.
10. UI copy uses no em dashes and no extraneous controls or text. Follow impeccable
    (OKLCH, tinted neutrals, no banned patterns) and the existing hand-drawn theme.

## Persona and prerequisites

Same persona as Coulomb and Charging: a high school student in AP Physics C E&M,
or a self-studier, who learns by doing. Prerequisite in the data:
`["charging-conductors-insulators"]` (the immediate predecessor, matching how
lesson 2 declared `["coulombs-law"]`).

## Target intuitions

1. The electric field is a property of the space around a charge. A source charge
   fills space with a field; a second charge feels the local field where it sits,
   not the distant charge directly. The field is the messenger that carries the
   force across the gap.
2. The field is defined as force per unit positive test charge, E = F/q, in N/C.
   Its value at a point does not depend on the test charge you probe with; a bigger
   probe feels a bigger force but reports the same field.
3. The field of a point charge has magnitude E = kQ/r squared and points away from
   a positive charge and toward a negative one. (The Coulomb inverse-square law,
   now stated for one charge.)
4. Fields add by superposition: the net field at a point is the vector sum of the
   fields from each source. (The Coulomb superposition idea, now for fields.)
5. Field lines picture the field: the line's tangent gives the field direction,
   lines start on positive charges and end on negative charges, their density
   (lines per area) is proportional to field strength, the number of lines is
   proportional to the charge, and lines never cross.
6. A charge placed in a field feels F = qE: a positive charge along the field, a
   negative charge opposite it. Field lines are not trajectories; they show the
   direction of the force, not the path a released charge would follow.

## Learning arc

The action-at-a-distance puzzle (how does the force cross the gap?), then the
field as the property of space that carries it, then E = F/q probed with a test
charge, then the direction convention, then the field of a point charge
(E = kQ/r squared, inverse-square callback), then the field map of sampled arrows,
then superposition of fields and the null point (callback to Coulomb's balance
point, now as zero field), then field lines and their rules, then reading the
single-charge, dipole, and like-charge patterns, then back to force with F = qE,
then a summary that ties field, formula, superposition, and lines together.

## The 27 steps (content contract)

C = concept card, I = interactive. "Gate" notes per-step behavior gates copied
from the Coulomb and Charging engines: explore (choices hidden until the learner
interacts), stage-choice (answer chosen on the canvas), reveal (a control appears
only after a correct step). "Field" sandbox = the existing `ChargeSandbox` engine
in `display: 'field'` mode (it draws the field arrow, the force on a +1 test
charge, instead of a labeled force).

| # | Type | Title | Interaction | Correct answer / goal | Key misconception targeted | Gate / animation |
|---|------|-------|-------------|-----------------------|----------------------------|------------------|
| 1 | C | The invisible reach | none | n/a | "the charges must touch or send something visible" | static hook (two charges, a gap, a question mark over the gap) |
| 2 | C | Space itself carries it | none | n/a | "a charge acts directly on a distant charge" | static (one charge tinting the space around it) |
| 3 | I | Probe the push | field sandbox, drag a + test charge around a fixed +Q | a push everywhere, pointing away, stronger near | "empty space near a charge does nothing" | explore; live field arrow follows the probe |
| 4 | C | Field is force per charge | none | n/a | "field and force are the same thing" | static (F divided by q equals E, units N/C) |
| 5 | I | Does the probe change it? | multiple-choice | E is unchanged; only F doubles | "a bigger test charge means a bigger field" | none |
| 6 | I | Which way near a plus? | vector-aim near +Q | arrow points straight away from +Q | "the field points toward every charge" | none |
| 7 | I | Toward or away? | tap, two diagrams (near +Q, near -Q) | the field points toward the -Q | "the field always points away" | stage-choice |
| 8 | C | The field of a point charge | none | n/a | "you need two charges for a field" | static (E = kQ/r squared from one charge) |
| 9 | I | Compute the field | numeric | E = kQ/r squared at the given r | "plug both charges in like Coulomb" | none |
| 10 | I | Step back to 2r | slider | the field drops to one quarter | "doubling r halves the field" | explore; field readout updates with distance |
| 11 | I | Predict at 3r | numeric | one ninth of the field at r | "the falloff is linear in r" | reveal slider after a correct prediction |
| 12 | C | A map of arrows | none | n/a | "the field is only where you put a charge" | static (grid of sampled arrows around a charge) |
| 13 | I | Match the map | multiple-choice | the radial map that shrinks with distance | "all the arrows are the same length" | none |
| 14 | C | Fields add up | none | n/a | "the bigger charge cancels the smaller one's field" | static (two source arrows summing to a net arrow) |
| 15 | I | Net field near two | field sandbox, drag near a + and a - | net arrow points away from + and toward - | "you average the two fields" | explore; live near, far, and net arrows |
| 16 | I | Find the dead spot | field sandbox with goal, two like charges | the null point where net E = 0 (the midpoint for equal charges) | "the field is never zero between two charges" | goal: equilibrium; net arrow shrinks to zero |
| 17 | C | From arrows to lines | none | n/a | "field lines are extra arrows" | static (arrows connect into a continuous line) |
| 18 | C | The rules of field lines | none | n/a | "lines can start or stop anywhere" | static (tangent, start +, end -, density, never cross) |
| 19 | I | Spot the broken diagram | multiple-choice | the diagram with crossing lines (or a line into a +) is invalid | "field lines can cross" | none |
| 20 | I | Where is it strongest? | multiple-choice | where the lines are densest | "line density is just decoration" | none |
| 21 | I | Find the negative charge | tap, single-charge patterns | the pattern with lines pointing inward | "lines always point outward" | none |
| 22 | C | The dipole picture | none | n/a | "the lines go straight across plus to minus" | static (curved dipole field lines) |
| 23 | I | Read the dipole | field sandbox in the dipole field | the field arrow is tangent to the line through that point | "the field points straight at the nearest charge" | explore; arrow tracks the local line |
| 24 | C | Two of a kind | none | n/a | "like charges still have a line straight between them" | static (two + charges, lines bend away, null point between) |
| 25 | I | Count the lines | multiple-choice | +2Q has twice the lines; the extras run off to infinity | "charge size does not change the number of lines" | none |
| 26 | I | Back to force | vector-aim, a - charge in a known field | the force on the - charge points opposite the field | "every charge is pushed along the field" | none |
| 27 | C | You can read the field | none | n/a | n/a | static summary (field, E = kQ/r squared, superposition, lines) |

Counts: concepts at 1, 2, 4, 8, 12, 14, 17, 18, 22, 24, 27 (11). Interactive at 3,
5, 6, 7, 9, 10, 11, 13, 15, 16, 19, 20, 21, 23, 25, 26 (16). Total 27.

Every interactive step carries hand-written `feedback.correct`, per-choice
`feedback.wrong`, and an `explanation` revealed only after a correct answer, in the
Coulomb and Charging style. The full copy is authored in `lesson3.json` during
Foundation.

## Interaction inventory

Reused without change (read-only dependencies):
- `NumericInput` (steps 9, 11), the multiple-choice and tap rail (5, 7, 13, 19,
  20, 21), `VectorAim` (6, 26), the slider rail (10), the stage-choice pattern
  (7), and all of `scenes/primitives.tsx` (`Charge`, `Arrow`, `DragHandle`,
  `Legend`, `ReadoutRow`, `MiniPanel`, `Figure`, `usePointerDrag`, `clamp`).
- The pure force helpers in `components/lesson/physics.ts`
  (`forceOnCharge`, `netForceFromCharges`, `magnitude`, `angleDegrees`,
  `angleDifferenceDegrees`, `inverseSquare`, `COULOMB_K`). The field is the force
  on a +1 test charge, so the field helpers below are thin, exact wrappers over
  these.

Extended (small, additive, done once in Foundation):
- `ChargeSandbox` and `SandboxConfig`: add an optional `display?: 'force' | 'field'`
  (default `'force'`) and an optional `showFieldLines?: boolean`. In `'field'` mode
  the sandbox draws the field vector (force on a unit positive probe, that is, the
  net force with the probe's q normalized to 1) and labels it E, reusing the same
  drag engine, arrow scaling, and equilibrium goal logic already used by Coulomb's
  superposition steps. No new `InteractionType` is introduced; field probing is the
  `sandbox` type in field mode. This keeps the schema churn minimal and the engine
  shared.

New, built and tested in Foundation because many steps depend on them:
- Field physics helpers in `physics.ts` (pure, unit-tested):
  - `fieldAtPoint(point: Vec2, sources: PointCharge[], k?): Vec2` (net field by
    superposition; equals `netForceFromCharges` with a unit positive probe).
  - `fieldMagnitude(Q: number, r: number, k?): number` (kQ/r squared).
  - `traceFieldLines(charges, options): FieldLine[]`: a numerical streamline
    tracer. It seeds lines evenly around each positive charge (count proportional
    to the charge), integrates along the local field direction with a small fixed
    step (RK2 or normalized Euler), and terminates a line when it reaches a
    negative charge, leaves the viewBox, or exceeds a max length. This is the one
    genuinely new, nontrivial algorithm and the headline technical risk.
- `FieldVectorField.tsx`: an SVG primitive that samples the field on a grid and
  draws a small arrow at each sample (length and opacity scaled to magnitude, with
  a shared scale constant). Used by the field-map steps (12, 13).
- `FieldLines.tsx`: an SVG primitive that renders the traced streamlines as smooth
  paths with arrowheads placed along them, plus the source charge glyphs. Used by
  the field-line steps (17 through 25).
- `FieldExperience.tsx`: the per-step driver (a switch over step numbers to scenes,
  with the gating sets), mirroring `CoulombExperience.tsx` and
  `ChargingExperience.tsx`. See "Known tradeoff" below.

Bespoke animated scenes (one file per step, built by per-step subagents) follow
the established pattern (a single elapsed-time input drives the timeline, a
reduced-motion fallback jumps to the final state), reusing the shared primitives
and the field helpers above.

## Contracts and structural choices

- Per-step file layout. As with Charging, this lesson uses one file per step under
  `frontend/src/components/lesson/scenes/field/` so the fan-out is conflict-free.
  Primitives and physics stay shared and read-only after Foundation.
- Co-located CSS. Each scene imports its own stylesheet (`StepNN_Name.css`) so no
  two subagents edit one stylesheet. All classes are namespaced with an `eff-`
  prefix plus the step number to guarantee no global collisions. Theme tokens come
  from `styles.css` and are only referenced, never edited, by scenes.
- Dev Scene Gallery. The DEV-only, unprotected gallery route
  (`/dev/scene/:lessonId/:step`) is already generalized to pick the experience per
  lesson; Foundation only adds the `FieldExperience` branch and confirms
  `/dev/scene/electric-field-field-lines/1` renders. For animated steps it exposes
  a deterministic time control so a verifier can screenshot the whole timeline.
- Known tradeoff (driver duplication). Coulomb, Charging, and now Field each get a
  near-identical per-step driver. A third copy is the safe, parallel-friendly
  choice and is kept for this build, but the growing duplication is flagged as a
  candidate for a later refactor into one generic experience that takes a scene
  map and gating sets. That refactor is explicitly out of scope here.

## File structure and ownership

Shared, written once in Foundation (serial; no per-step subagent touches these):
- Create `frontend/src/content/lessons/lesson3.json` (all 27 steps, full copy).
- Modify `frontend/src/content/schema.ts` (extend `SandboxConfig` with `display`
  and `showFieldLines`; no new `InteractionType`).
- Modify `frontend/src/content/index.ts` (import and register `lesson3`).
- Modify `frontend/src/content/content.test.ts` (validate lesson 3 like 1 and 2:
  counts, ids, feedback presence, answer configs; update the lesson count to 3).
- Modify `frontend/src/components/lesson/physics.ts` (add `fieldAtPoint`,
  `fieldMagnitude`, `traceFieldLines`, and the `FieldLine` type) plus its test file
  `physics.test.ts` (field helpers and the tracer's invariants).
- Create `frontend/src/components/lesson/scenes/primitives` additions or new files
  `FieldVectorField.tsx` and `FieldLines.tsx` (+ tests), as shared read-only
  primitives.
- Modify `frontend/src/components/lesson/interactions/ChargeSandbox` (add the
  `display: 'field'` rendering path; keep `'force'` the default and unchanged) plus
  its test.
- Create `frontend/src/components/lesson/FieldExperience.tsx` (per-step driver,
  mirroring the other two). Imports all 27 scene files; scenes start as labeled
  placeholder stubs.
- Modify `frontend/src/components/lesson/LessonRenderer.tsx` (branch to
  `FieldExperience` when `lesson.lessonId === FIELD_LESSON_ID`, mirroring the
  Coulomb and Charging branches).
- Modify `frontend/src/progress/dashboardProgress.ts` (add lesson 3 to
  `LIVE_LESSONS` with `sequence: 3`).
- Modify `frontend/src/content/courseMap.ts` (add `lessonId:
  'electric-field-field-lines'` to the existing node so the dashboard treats it as
  live, mirroring how Charging was made live).
- Modify `frontend/src/pages/DevSceneGalleryPage.tsx` (add the `FieldExperience`
  branch to the experience selection).
- Modify `frontend/src/test/lessonDriver.ts` (add `revealLessonThreeGates()` for
  the lesson-3 explore controls; see the plan for the explore-trigger contract).
- Pre-create empty per-step files so no two subagents ever create the same path:
  `scenes/field/StepNN_Name.tsx`, `StepNN_Name.css`, `StepNN_Name.test.tsx` for all
  27 steps.

Per-step, owned by exactly one builder subagent (parallel; conflict-free):
- `frontend/src/components/lesson/scenes/field/StepNN_Name.tsx`
- `frontend/src/components/lesson/scenes/field/StepNN_Name.css`
- `frontend/src/components/lesson/scenes/field/StepNN_Name.test.tsx`

A subagent reads the lesson JSON, the schema, the primitives (including the new
field primitives), the physics module, and the gallery, and writes only its three
files.

## Build and verification pipeline

Phase 1, Foundation (serial). Produce every shared file above so all contracts
(types, JSON, field helpers and tracer, the two field primitives, the sandbox
field mode, driver wiring, gallery branch, registration, ownership stubs) exist and
the app compiles with placeholder scenes. The field helpers, `traceFieldLines`,
`FieldVectorField`, and `FieldLines` are built test-first and each pass their own
independent verifier before any per-step fan-out, because most line and map steps
depend on them. Gate: `npm run build` and the Foundation test set pass with
placeholders; the gallery renders each placeholder step; the lesson is reachable at
its URL when signed in.

Phase 2, Per-step build (parallel, batched). For each of the 27 steps:
- Builder subagent (opus 4.8 max, fast): implements the scene and interaction in
  its three files, writing tests first (TDD), and loops on its own until tests,
  typecheck, and its own visual check pass.
- Verifier subagent (opus 4.8 max, fast), dispatched independently after the
  builder reports done: re-runs the step's tests, typechecks, and performs the
  visual gate from scratch against the gallery. It returns PASS or a concrete
  defect list. A defect list re-opens the builder. A step closes only on a verifier
  PASS.

Phase 3, Integration (serial, orchestrator). Full `npm run build`, full `npm test`,
then a Playwright playthrough of all 27 real steps in sequence with a signed-in dev
account navigating straight to the lesson URL, screenshotting each step, confirming
step-to-step flow, gating/progress wiring, XP and completion, and cross-step visual
rhythm with Coulomb and Charging. The orchestrator does its own hard verification
here. Any regression re-opens that step.

The ralph loop wraps all phases. Its task prompt re-checks a status ledger each
iteration, repairs or completes Foundation, dispatches builders and verifiers for
any not-yet-green step, runs integration, and writes `.cursor/ralph-done` only when
Foundation, all 27 steps, and Integration pass every gate. It never writes the
sentinel to exit early.

## Visual and animation verification gate

For every step, against the DEV Scene Gallery (no auth):
- Static correctness: the resting frame matches the step's intent and the
  hand-drawn theme.
- Pixel alignment: charge glyphs baseline centered; field arrows anchored at their
  sample points and scaled by a single shared constant; field lines smooth, not
  self-intersecting, terminating cleanly on charges or the viewBox edge, with
  arrowheads evenly placed; nothing clipped at the SVG viewBox; the rail prompt,
  choices, and feedback aligned to the same vertical rhythm as Coulomb and
  Charging.
- Field-specific correctness: for line diagrams, lines never cross, density tracks
  magnitude, the count is proportional to charge, single-charge maps are radial and
  symmetric, the dipole is symmetric about its axis, and like-charge maps show the
  null point with no line through it.
- Animation correctness: drive the timeline with the gallery time control across
  the full duration and capture a dense series of frames (at least 12 evenly
  spaced). Verify motion progresses (no frozen or skipped frames), is monotonic
  where intended, lands on the correct end state, and that the reduced-motion path
  jumps straight to the correct final frame.
- Behavior: tests cover correct and incorrect answers, the explore gate, the
  stage-choice (step 7), the reveal (step 11), and the equilibrium goal (step 16).

A step is done only when both pixel alignment and full-timeline animation checks
pass under the independent verifier.

## Integration points (exact, for reachability)

- Routing: `/lesson/:lessonId` is generic and protected by auth only (`App.tsx`).
  A registered lessonId routes automatically; no route change for the lesson
  itself. The gallery route already accepts any `:lessonId`.
- Liveness: a lesson is live when its id is in `LIVE_LESSONS`
  (`dashboardProgress.ts`), registered in `content/index.ts`, and carries a
  `lessonId` in `courseMap.ts`. Adding all three makes lesson 3 load by id and
  count in progress.
- Dashboard gating (UI only): a live lesson node becomes clickable when the prior
  lesson is completed, its problem set is solved, and the mastery gate passes
  (`DashboardPage.tsx`). The integration playthrough navigates directly to the
  lesson URL, so it does not depend on completing the Charging problem set. Dev
  mode (`?dev=1`) unlocks the node for manual checks.

## Constraints (apply to every subagent)

- No em dashes anywhere in UI copy. No extraneous UI: only the controls the step
  needs.
- Pixel-perfect alignment on all graphical work.
- Follow the existing hand-drawn theme and the established scene conventions;
  namespace new classes `eff-` plus the step number.
- impeccable design laws: OKLCH, tinted neutrals, no banned patterns (no
  side-stripe borders, no gradient text, no glassmorphism by default).
- TDD: write the failing test first; keep files small and single-purpose.

## Risks and mitigations (honest)

- Field-line tracing quality is the headline risk. Streamlines must look right
  (radial for a single charge, symmetric dipole, like-charge null point), never
  cross, and terminate cleanly. Mitigation: build `traceFieldLines` first in
  Foundation, test-first, with explicit invariants (radial symmetry, line count
  proportional to charge, termination on negative charges, no crossing within a
  tolerance); build one template line scene before fan-out to set the visual bar.
- Performance. Sampling a vector grid and tracing many lines every animation frame
  can be heavy. Mitigation: keep field maps and line diagrams static (computed
  once), animate only a single probe or a single moving element; memoize traced
  lines.
- Conceptual subtlety (field independent of the probe; sign of the force on a
  negative charge; lines are not trajectories). Mitigation: these are the named
  misconceptions in steps 5, 26, and 17 through 19, with hand-written wrong-answer
  feedback.
- Sandbox extension blast radius. Adding a field display path to the shared
  `ChargeSandbox` could regress Coulomb's force steps. Mitigation: `'force'` stays
  the default and unchanged; the field path is additive and covered by a new test;
  run Coulomb's sandbox tests in the Foundation gate.
- Driver duplication (third near-identical experience). Accepted for this build;
  flagged for a later refactor (see Known tradeoff).
- Scene count and cost: 27 builder plus 27 verifier subagents on opus 4.8 is heavy.
  Mitigation: batch the parallel fan-out; the gallery keeps each verification fast
  and isolated.

## Out of scope (for now)

- Continuous charge distributions and integration (the next lesson, "Electric
  Fields of Charge Distributions").
- Derivations of the field inside or at the surface of a conductor (the later
  "Electrostatics with Conductors" node); only a one-line callback here.
- Uniform fields and parallel-plate capacitors beyond a passing mention (they
  belong to the Capacitors unit).
- The handwritten, server-graded problem set for this lesson.
- Any backend, mastery model, or grading change, and any change to Coulomb or
  Charging content.
- The generic-experience refactor that would collapse the three per-step drivers.

## Open / tunable parameters

- Final step count and concept/interactive split (target 27, 11C/16I).
- Whether step 11 uses numeric or multiple-choice, and whether step 16 fixes equal
  charges (midpoint null) or unequal charges (off-center null).
- Field-line tracer settings: seeds per unit charge, integration step size, and max
  line length, tuned during the Foundation template step.
- Exact frame count and sampling for animation verification (default at least 12).
- Parallel batch size for the fan-out (throughput vs machine load).
- Whether to keep a human checkpoint after the template line scene or run fully
  autonomous (current plan: automated independent verification, no human stop).
