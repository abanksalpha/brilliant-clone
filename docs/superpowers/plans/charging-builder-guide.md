# Charging lesson: per-step builder and verifier guide

Shared instructions for every Phase 2 subagent. Read this plus your own step in
`frontend/src/content/lessons/lesson2.json` and the spec
`docs/superpowers/specs/2026-06-26-charging-conductors-insulators-design.md`.

## Read first (patterns to copy)
- `frontend/src/components/lesson/scenes/primitives.tsx` (Charge, Arrow, DragHandle, Figure, Legend, ReadoutRow, MiniPanel, usePointerDrag, clamp, VIEW, CHARGE_R)
- `frontend/src/components/lesson/scenes/conceptScenes.tsx` and `interactiveScenes.tsx` (the Coulomb scenes; match their visual language)
- `frontend/src/components/lesson/scenes/interactiveScenes.tsx` `RubTransferScene` (the animation pattern: a single elapsed-time input via requestAnimationFrame, with a reduced-motion / non-browser fallback that jumps to the final frame)
- `frontend/src/components/lesson/physics.ts` (forceOnCharge, netForceFromCharges, inverseSquare, magnitude) for any force arrows
- `frontend/src/components/lesson/ChargingExperience.tsx` (how your scene is called)

## You own exactly three files (edit nothing else)
- `frontend/src/components/lesson/scenes/charging/StepNN_Name.tsx` (replace the stub)
- `frontend/src/components/lesson/scenes/charging/StepNN_Name.css` (new; import it from the tsx)
- `frontend/src/components/lesson/scenes/charging/StepNN_Name.test.tsx` (new)

Do not touch `styles.css`, the JSON, the schema, the driver, or any other step's files.

## Component signature must match how ChargingExperience calls your step
- Concept steps (1, 2, 4, 6, 9, 12, 15, 17, 21, 23, 26): `export function StepNN_Name()`, no props. Render only the stage figure; the rail shows the concept body.
- Plain interactive with rail choices (5, 11, 14, 19) and numeric (25) and ordering (20): `export function StepNN_Name()`, no props. Render a static supporting figure; the rail shows the choices / NumericInput / Ordering widget.
- Explore-gated steps (3, 7, 10, 13, 16, 18, 22, 24): `export function StepNN_Name({ onExplore }: { onExplore?: () => void })`. Call `onExplore()` once the learner performs the real interaction.
- Stage-choice step (8): `export function Step08_WhichSidePositive({ choices, disabled, onChoose, selectedId }: { choices: LearnerChoice[]; disabled?: boolean; onChoose: (c: LearnerChoice) => void; selectedId?: string })`. Import `LearnerChoice` from `../../lessonExperience`. Render two tappable regions (mirror Coulomb's `CompareSignsTapScene`).

## Explore-trigger contract (explore-gated steps only)
Your scene must expose, and trip `onExplore` from, ONE of:
- an SVG `DragHandle` whose `label` is `Charged rod` or `Test charge` (drag or arrow keys), or
- a `<button data-testid="cci-explore-trigger">` (for tap/animation/staged scenes; staged scenes keep the same testid on the advance button).
This is what the test driver (`revealLessonTwoGates`) operates, so it is required.

## Style and craft
- Use the shared primitives and the existing scene visual language. Reuse `Charge`, `Arrow`, `Figure` so charges and arrows match Coulomb exactly.
- Co-located CSS only; namespace every class `cci-NN-...` (NN = your step number). Reference theme tokens (the OKLCH and sketch variables already in the app); never hardcode `#000`/`#fff`.
- No em dashes anywhere. No extraneous UI: only the controls the step needs.
- Pixel alignment: center elements on the 360x220 grid; baseline-center charge glyphs; anchor arrows to charge edges, not over the glyph; keep everything inside the viewBox.
- Animations: derive every frame from one elapsed-time value; honor `prefers-reduced-motion` by jumping to the final frame (copy `rubCanAnimate` from `RubTransferScene`).

## Builder loop (do not stop until green)
1. Write the failing test first (TDD) in `StepNN_Name.test.tsx`: render the scene, assert its key behavior (explore fires `onExplore`; stage-choice calls `onChoose`; animation end-state; correct static content).
2. Implement the scene and its CSS.
3. Run only your test: `cd frontend && npm test src/components/lesson/scenes/charging/StepNN_Name`. Do NOT run the full `npm run build` (other builders may be mid-edit); the orchestrator runs the full build at integration.
4. Visual self-check: the dev server is ALREADY running on http://localhost:5174 (do not start another). Screenshot your step with Python Playwright (chromium is installed) at `http://localhost:5174/dev/charging/NN`. For animated steps, trigger the animation and capture several frames across the whole timeline. Confirm pixel alignment and that the animation progresses and lands correctly.
5. Loop until the test passes and the visual is correct. Then set your step's "Built" cell to [x] in `docs/superpowers/plans/charging-build-status.md` and report what you did.

## Verifier loop (independent, separate subagent)
1. Re-run the step test.
2. Independent visual gate at `http://localhost:5174/dev/charging/NN`: capture the resting frame plus, for animations, at least 12 frames evenly across the full duration (drive time with Playwright's `page.clock` or by triggering and stepping). Check: progresses with no frozen/skipped frames, correct end state, pixel alignment, reduced-motion final frame.
3. PASS: set the "Verified" cell to [x]. FAIL: list concrete defects in the ledger row and leave Verified [ ] so the builder is re-opened.
