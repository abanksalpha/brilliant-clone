# Electric Field & Field Lines Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement this plan. Each step (Phase 2) is built by one builder subagent and closed only by an independent verifier subagent. Steps use checkbox (`- [ ]`) syntax for tracking in the status ledger.

**Goal:** Build lesson 3, "Electric Field & Field Lines," to the depth and craft of Coulomb's Law and Charging (27 steps, hand-built SVG scenes, hand-written feedback), reachable and playable end to end and pixel-correct.

**Architecture:** Content is a typed JSON document (`lesson3.json`) rendered by a bespoke per-step driver (`FieldExperience.tsx`), exactly like Coulomb and Charging. Shared/contract files are written once in a serial Foundation phase; each step's scene is then built in its own file by one subagent so the fan-out is conflict-free. The one new technical core is the field math: pure helpers plus a field-line streamline tracer, and two new SVG primitives (`FieldVectorField`, `FieldLines`) built and independently verified in Foundation before any step depends on them. The DEV Scene Gallery (already generalized to `/dev/scene/:lessonId/:step`) renders any step in isolation for screenshot verification.

**Tech Stack:** React 19, React Router 7, TypeScript, SVG scenes, Vitest + Testing Library, Playwright for visual verification, Vite.

## Global Constraints

- Lesson id `electric-field-field-lines`, lessonNumber 3, file `lesson3.json`.
- 27 steps: 11 concept, 16 interactive. Build on Coulomb and Charging; do not re-teach them (one-line recap max). Point charges only; no continuous distributions.
- No em dashes in any UI copy. No extraneous UI: only the controls a step needs.
- Pixel-perfect alignment on all graphical work. Follow the hand-drawn theme; namespace new CSS classes `eff-` plus the step number.
- impeccable laws: OKLCH, tinted neutrals, no banned patterns (no side-stripe borders, no gradient text, no default glassmorphism).
- TDD: failing test first. Keep one file per scene; files small and single-purpose.
- Tests: `cd frontend && npm test`. Build: `cd frontend && npm run build`.
- Subagents run on `claude-opus-4-8-thinking-max-fast`.
- Shared files (Phase 1) are edited only in Foundation. Phase 2 subagents edit only their three owned files.

---

## Phase 1: Foundation (serial, one pass)

Locks every contract so Phase 2 fan-out cannot conflict. The field math and
primitives (F2 through F5) are built test-first and each pass an independent
verifier before any per-step fan-out, because most map and line steps depend on
them.

### Task F1: Extend the schema for field display

**Files:**
- Modify: `frontend/src/content/schema.ts`

**Produces:** an additive way to ask the shared sandbox to draw the field.

- [ ] Add to `SandboxConfig`: `display?: 'force' | 'field';` (default `'force'`) and `showFieldLines?: boolean;`.
- [ ] Do not add a new `InteractionType`. Field probing is the existing `sandbox` type in `display: 'field'` mode.
- [ ] Confirm `npm run build` still passes (additive optional fields only).

### Task F2: Field physics helpers and the line tracer (test-first, verified)

**Files:**
- Modify: `frontend/src/components/lesson/physics.ts`
- Modify/create: `frontend/src/components/lesson/physics.test.ts`

**Produces:**

```ts
export type FieldLine = { points: Vec2[]; fromChargeId: string };

// Net field at a point by superposition (force on a unit positive probe).
export function fieldAtPoint(point: Vec2, sources: PointCharge[], k?: number): Vec2;

// Magnitude of a point charge's field, kQ / r^2.
export function fieldMagnitude(Q: number, r: number, k?: number): number;

// Trace streamlines: seed lines around each positive charge (count ∝ |Q|),
// integrate along the local field direction, terminate on a negative charge,
// at the viewBox edge, or at a max length.
export function traceFieldLines(
  charges: Array<PointCharge & { id: string }>,
  options: { bounds: { w: number; h: number }; seedsPerUnitCharge: number; stepSize: number; maxSteps: number },
): FieldLine[];
```

- [ ] Write failing tests first, asserting the invariants:
  - `fieldAtPoint` of a single +Q points radially away and equals `fieldMagnitude(Q, r)`; of a single -Q points toward it.
  - `fieldAtPoint` superposes (two sources sum); the midpoint between two equal like charges is the zero vector.
  - `fieldMagnitude` follows inverse square (value at 2r is one quarter of value at r).
  - `traceFieldLines`: a single +Q yields radially symmetric lines; line count scales with |Q|; lines terminate on negative charges in a dipole; no two traced polylines cross within a small tolerance; a like-charge pair leaves a gap (no line) through the null point.
- [ ] Implement until tests pass. Keep all functions pure and framework-free.
- [ ] Independent verifier: re-run `npm test physics` from scratch; confirm invariants. Close F2 only on PASS.

### Task F3: `FieldVectorField` primitive

**Files:**
- Create: `frontend/src/components/lesson/scenes/FieldVectorField.tsx`
- Create: `frontend/src/components/lesson/scenes/FieldVectorField.test.tsx`

Samples the field on a grid (via `fieldAtPoint`) and draws a small arrow at each
sample, length and opacity scaled to magnitude by a single shared scale constant.
Props: `charges`, `bounds`, `gridStep`, optional `maxArrow`. Pure render from the
helpers; no animation.

- [ ] Failing test: renders one arrow per grid sample; arrows near the charge are longer than far ones; a +Q produces outward arrows.
- [ ] Implement until tests pass. Namespace classes if any with `eff-vfield-`.

### Task F4: `FieldLines` primitive

**Files:**
- Create: `frontend/src/components/lesson/scenes/FieldLines.tsx`
- Create: `frontend/src/components/lesson/scenes/FieldLines.test.tsx`

Renders `traceFieldLines(...)` output as smooth SVG paths with arrowheads placed
along each line, plus the source charge glyphs (reusing `Charge` from primitives).
Props: `charges`, `bounds`, plus tracer options with sensible defaults. Static.

- [ ] Failing test: renders the expected number of path elements for a given charge set; a dipole renders lines that start near the + and end near the -; arrowheads are present.
- [ ] Implement until tests pass. Namespace classes `eff-lines-`.
- [ ] Build one visual template (a dipole) in the gallery and verify it looks correct (symmetry, no crossing, clean termination) before fan-out. This template sets the visual bar.

### Task F5: Extend `ChargeSandbox` with a field display mode

**Files:**
- Modify: `frontend/src/components/lesson/interactions/ChargeSandbox.tsx` (exact path per the repo)
- Modify: its test file

In `display: 'field'` mode, draw the field vector at the probe (the net force with
the probe's q normalized to 1) and label it E; reuse the existing drag engine,
arrow scaling, and equilibrium goal logic. Keep `'force'` the default and
unchanged. Optionally overlay `FieldLines` when `showFieldLines` is set.

- [ ] Failing test: in `'field'` mode the readout/arrow reflects E (independent of the probe's q), and `'force'` mode is byte-for-byte unchanged in behavior.
- [ ] Implement until tests pass.
- [ ] Run Coulomb's existing sandbox tests in this task's gate to prove no regression.

### Task F6: Author `lesson3.json` (full content)

**Files:**
- Create: `frontend/src/content/lessons/lesson3.json`

Author all 27 steps per the spec step table (`docs/superpowers/specs/2026-06-26-electric-field-field-lines-design.md`). Mirror `lesson1.json`/`lesson2.json` field-for-field. Each interactive step has `prompt`, `choices` (where applicable, exactly one `correct: true`), `feedback.correct`, `feedback.wrong[]` (per-choice where helpful, using the `(B)`/`(C)` label convention), and `explanation`. Concept steps have `body`. `counts` = `{ totalSteps: 27, interactiveProblems: 16, conceptCards: 11 }`. `prerequisites: ["charging-conductors-insulators"]`. `sourceFile: "docs/lesson3.txt"`.

Interaction types per step: 3 sandbox (field), 5 multiple-choice, 6 vector-aim, 7 tap, 9 numeric, 10 slider, 11 numeric, 13 multiple-choice, 15 sandbox (field), 16 sandbox (field, goal: equilibrium), 19 multiple-choice, 20 multiple-choice, 21 tap, 23 sandbox (field), 25 multiple-choice, 26 vector-aim. Steps 3, 15, 16, 23 carry a `sandbox` config with `display: "field"` (step 16 also a `goal`); steps 9, 11 carry `numeric`; steps 6, 26 carry `vectorAim`.

- [ ] Write the file, then validate with the content tests (Task F7).

### Task F7: Register lesson 3, make it live, extend content tests

**Files:**
- Modify: `frontend/src/content/index.ts` (import `lesson3`, add to `lessons`)
- Modify: `frontend/src/content/content.test.ts`
- Modify: `frontend/src/progress/dashboardProgress.ts`
- Modify: `frontend/src/content/courseMap.ts`

- [ ] `index.ts`: `import lesson3 from './lessons/lesson3.json';` and add it to the `lessons` array (`as unknown as Lesson[]`).
- [ ] `content.test.ts`: add the lesson 3 entry to `expectedLessons` (`counts: { totalSteps: 27, interactiveProblems: 16, conceptCards: 11 }`, `prerequisites: ['charging-conductors-insulators']`), update the `toHaveLength` count from 2 to 3.
- [ ] `dashboardProgress.ts`: add to `LIVE_LESSONS`: `{ lessonId: 'electric-field-field-lines', sequence: 3, title: 'Electric Field & Field Lines' }`.
- [ ] `courseMap.ts`: add `lessonId: 'electric-field-field-lines'` to the existing "Electric Field & Field Lines" node so the dashboard treats it as live.
- [ ] Run `npm test src/content src/progress`. Fix any count expectations that assume two live lessons.

### Task F8: The `FieldExperience` driver

**Files:**
- Create: `frontend/src/components/lesson/FieldExperience.tsx`
- Modify: `frontend/src/components/lesson/LessonRenderer.tsx`

**Interfaces:**
- Produces: `export const FIELD_LESSON_ID = 'electric-field-field-lines';` and `FieldExperience({ isFinalStep, learnerStep, onContinue, step }: { isFinalStep: boolean; learnerStep: LearnerStep; onContinue: () => void; step: Step })`.

Mirror `ChargingExperience.tsx`: the same rail/stage layout (reuse the `cl1-` layout classes for parity), the same status/feedback flow, and a `renderStage()` switch over `step.stepNumber` to the 27 scene components imported from `./scenes/field/StepNN_Name`. Gating sets:

```ts
const EXPLORE_GATED = new Set([3, 10, 15, 16, 23]);
const STAGE_CHOICE_STEPS = new Set([7, 21]);
const REVEAL_ON_CORRECT = new Set([11]);
```

Numeric steps (9, 11) use `NumericInput`; sandbox steps (3, 15, 16, 23) use `ChargeSandbox` in `display: 'field'` mode; vector-aim steps (6, 26) use `VectorAim`; the slider step (10) uses the slider rail; steps 7 and 21 answer on the canvas (stage-choice); all other interactive steps use the rail choices.

- [ ] `LessonRenderer.tsx`: add `import { FIELD_LESSON_ID, FieldExperience } from './FieldExperience';` and an `else if (lesson.lessonId === FIELD_LESSON_ID)` branch returning `<FieldExperience .../>` with the same props shape as the other branches.

### Task F9: Scene stubs for all 27 steps

**Files:**
- Create (27): `frontend/src/components/lesson/scenes/field/StepNN_Name.tsx`

Each stub is a minimal valid component so the driver compiles and the gallery renders a labeled placeholder:

```tsx
export function StepNN_Name() {
  return <div className="eff-stub" data-testid="eff-stub-NN">Step NN scene (placeholder)</div>;
}
```

Use the exact file names listed in the status ledger so Phase 2 owners match. CSS and test files are created by each step's builder subagent.

- [ ] Create all 27 stubs. Run `npm run build`. Expected: PASS (driver imports resolve).

### Task F10: Wire the lesson into the DEV Scene Gallery

**Files:**
- Modify: `frontend/src/pages/DevSceneGalleryPage.tsx`

The gallery already selects an experience per `:lessonId`. Add the `FieldExperience` branch (`lesson.lessonId === FIELD_LESSON_ID`).

- [ ] Verify `http://localhost:5173/dev/scene/electric-field-field-lines/1` renders step 1 with no sign-in (port may be 5174; confirm from the dev server).

### Task F11: Extend the shared lesson driver for lesson 3

**Files:**
- Modify: `frontend/src/test/lessonDriver.ts`

The two "walk every lesson" tests in `LessonPlayer.test.tsx` iterate `getCourseLessons()`, so they now include lesson 3. They pass only once the scenes exist and the driver can trip lesson 3's explore gates. The sandbox steps (3, 15, 16, 23) are already handled by the existing `solveSandbox` (it nudges `charge-sandbox-handle` and uses the `Check this spot` goal control), so they need no new code as long as the field sandbox keeps those testids. Add `revealLessonThreeGates()` for the non-sandbox gated controls.

**Explore-trigger contract (every non-sandbox explore-gated lesson-3 control must satisfy one):**
- A `role="slider"` named `Probe distance` (step 10) or the revealed confirmation slider (step 11), nudged with Arrow keys, OR
- A button with `data-testid="eff-explore-trigger"` (clicked, repeatedly for any staged scene).

- [ ] Add `revealLessonThreeGates()` and call it alongside `revealLessonOneGates()`/`revealLessonTwoGates()` in the `default` (covers slider) and `tap` branches. It is a no-op when the controls are absent.

**Note:** The two full-lesson walk tests are PHASE 3 integration gates. They stay red until all 27 scenes are built and F11 lands. Do not weaken them. The Foundation gate below excludes them.

**Foundation gate:** `npm run build` passes; `npm test src/content`, `npm test physics`, `npm test src/components/lesson/scenes/FieldVectorField`, `npm test src/components/lesson/scenes/FieldLines`, and the `ChargeSandbox` tests pass; the gallery renders every step (placeholder or real); the lesson loads at `/lesson/electric-field-field-lines` when signed in. The two full-lesson walk tests are tracked under Phase 3.

---

## Phase 2: Per-step build (parallel, one subagent per step)

For each step NN, two subagents in sequence. The step is "green" only after the verifier passes.

### Builder subagent (per step)

**Owns exactly:** `scenes/field/StepNN_Name.tsx`, `StepNN_Name.css`, `StepNN_Name.test.tsx`. Reads `lesson3.json` (its step), `scenes/primitives.tsx`, the field primitives (`FieldVectorField`, `FieldLines`), `physics.ts`, the gallery.

- [ ] Write the failing test(s) for the scene/interaction behavior (correct + wrong answer, explore gate / stage-choice / reveal / goal / animation end-state as applicable).
- [ ] Implement the scene using the shared primitives and the field helpers. Field maps and line diagrams are computed once (static); animate only a single probe or element. Animations follow the established pattern (single elapsed-time input, reduced-motion fallback to the final frame).
- [ ] Style in `StepNN_Name.css` with `eff-NN-` namespaced classes referencing theme tokens only.
- [ ] Loop on: `npm test StepNN`, typecheck, and a self visual check in the gallery, until green.
- [ ] Update the status ledger row to "built, awaiting verify".

### Verifier subagent (per step, independent)

- [ ] Re-run `npm test StepNN` and confirm pass.
- [ ] Visual gate against `http://localhost:5173/dev/scene/electric-field-field-lines/NN` (see protocol below). Capture many frames across any animation using Playwright's clock to scrub time, plus the resting frame.
- [ ] Return PASS (mark the ledger row green) or a concrete defect list (re-open the builder).

### Visual verification protocol (every step)

- Resting frame correct and on-theme; rail prompt/choices/feedback aligned to the lesson's vertical rhythm (consistent with Coulomb and Charging).
- Pixel alignment: charge glyphs baseline-centered; field arrows anchored at their sample points and scaled by the single shared constant; nothing clipped at the SVG viewBox.
- Field-specific correctness: field lines never cross, density tracks magnitude, count is proportional to charge; single-charge maps are radial and symmetric; the dipole is symmetric; like-charge maps show the null point with no line through it.
- Animations: install `page.clock`, trigger the scene's start, and `fastForward` in small increments capturing at least 12 evenly spaced frames across the full duration. Confirm motion progresses (no frozen/skipped frames), is monotonic where intended, lands on the correct end state, and that reduced-motion jumps to the correct final frame.
- Behavior: explore gate hides choices until interaction; stage-choice answers on canvas (7, 21); the reveal appears only after a correct prediction (11); the equilibrium goal resolves at the null point (16); correct/wrong paths fire the right feedback.

---

## Phase 3: Integration (serial)

**Files:** none new; cross-cutting verification.

- [ ] `cd frontend && npm run build` passes.
- [ ] `cd frontend && npm test` passes (whole suite, including the two full-lesson walk tests now covering lesson 3).
- [ ] Playwright playthrough: sign in with the seeded dev account (or use `?dev=1`), navigate to `/lesson/electric-field-field-lines`, advance all 27 steps, screenshot each, confirm step flow, the explore gates, stage-choice, reveal, the equilibrium goal, XP burst, completion screen, and progress wiring.
- [ ] Cross-step rhythm: scenes share scale and spacing; the lesson reads as one piece with Coulomb and Charging.
- [ ] Any regression re-opens that step's builder.

**Done:** Foundation gate green, all 27 step rows green, Phase 3 green. The ralph loop writes `.cursor/ralph-done`.

---

## Status ledger

The authoritative per-step state lives in `docs/superpowers/plans/field-build-status.md` (created with the ralph loop). It tracks Foundation tasks F1 through F11, then a row per step (1 through 27) with builder and verifier state, then the Phase 3 gates. Each ralph iteration reads it, advances the least-done work, and updates it. The loop terminates only when every row is green and Phase 3 passes.

## Self-review

- Spec coverage: every spec step (1 through 27) has authoring in F6 and a Phase 2 builder/verifier pair; the schema, field math, primitives, sandbox mode, registration, liveness, driver, gallery, and test-driver items map to F1 through F11. Covered.
- Dependency order: F2 (field math) precedes F3/F4 (primitives that call it) and F5 (sandbox field mode); F6 (JSON) precedes F7 (registration/tests); F8 (driver) and F9 (stubs) precede F10 (gallery branch) and F11 (test driver). The field math and primitives are independently verified before fan-out.
- Placeholder scan: scene stubs in F9 are intentional placeholders replaced in Phase 2; no other placeholders.
- Type consistency: `FieldLine`/`fieldAtPoint`/`traceFieldLines` (F2) are consumed by F3/F4 and the line/map steps; `SandboxConfig.display` (F1) is consumed by F5 and steps 3/15/16/23; `FIELD_LESSON_ID` (F8) is consumed by `LessonRenderer` and the gallery; scene file names in F9 match the ledger and the driver switch in F8.
- Known tradeoff: a third near-identical per-step driver (`FieldExperience`) is accepted for parallel safety; a later refactor into one generic experience is noted in the spec and left out of scope.
