# Charging, Conductors & Insulators Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement this plan. Each step (Phase 2) is built by one builder subagent and closed only by an independent verifier subagent. Steps use checkbox (`- [ ]`) syntax for tracking in the status ledger.

**Goal:** Build lesson 2, "Charging, Conductors & Insulators," to the depth and craft of Coulomb's Law (26 steps, hand-built SVG scenes, hand-written feedback), reachable and playable end to end and pixel-correct.

**Architecture:** Content is a typed JSON document (`lesson2.json`) rendered by a bespoke per-step driver (`ChargingExperience.tsx`), exactly like Coulomb. Shared/contract files are written once in a serial Foundation phase; each step's scene is then built in its own file by one subagent so the fan-out is conflict-free. A DEV-only Scene Gallery renders any step in isolation for screenshot verification.

**Tech Stack:** React 19, React Router 7, TypeScript, SVG scenes, Vitest + Testing Library, Playwright for visual verification, Vite.

## Global Constraints

- Lesson id `charging-conductors-insulators`, lessonNumber 2, file `lesson2.json`.
- 26 steps: 11 concept, 15 interactive. Build on Coulomb; do not re-teach it (one-line recap max).
- No em dashes in any UI copy. No extraneous UI: only the controls a step needs.
- Pixel-perfect alignment on all graphical work. Follow the hand-drawn theme; namespace new CSS classes `cci-` plus the step number.
- impeccable laws: OKLCH, tinted neutrals, no banned patterns (no side-stripe borders, no gradient text, no default glassmorphism).
- TDD: failing test first. Keep one file per scene; files small and single-purpose.
- Tests: `cd frontend && npm test`. Build: `cd frontend && npm run build`.
- Subagents run on `claude-opus-4-8-thinking-max-fast`.
- Shared files (Phase 1) are edited only in Foundation. Phase 2 subagents edit only their three owned files.

---

## Phase 1: Foundation (serial, one pass)

Locks every contract so Phase 2 fan-out cannot conflict.

### Task F1: Add the `ordering` interaction type to the schema

**Files:**
- Modify: `frontend/src/content/schema.ts`
- Modify: `frontend/src/content/index.ts` (re-export `OrderingConfig`)

**Produces:** `OrderingConfig`, `interactionType: 'ordering'`, `InteractiveStep.ordering?`.

- [ ] Add to `InteractionType` union: `| 'ordering'`.
- [ ] Add type:

```ts
export type OrderingItem = { id: string; label: string };

export type OrderingConfig = {
  // Items listed in their CORRECT order. The widget shuffles for display.
  items: OrderingItem[];
  // Optional explicit correct id order; defaults to items' order.
  correctOrder?: string[];
};
```

- [ ] Add `ordering?: OrderingConfig;` to `InteractiveStep`.
- [ ] Re-export `OrderingConfig` and `OrderingItem` from `content/index.ts`.

### Task F2: Author `lesson2.json` (full content)

**Files:**
- Create: `frontend/src/content/lessons/lesson2.json`

Author all 26 steps per the spec step table (`docs/superpowers/specs/2026-06-26-charging-conductors-insulators-design.md`). Mirror `lesson1.json` field-for-field. Each interactive step has `prompt`, `choices` (where applicable, exactly one `correct: true`), `feedback.correct`, `feedback.wrong[]` (per-choice where helpful, using the `(B)`/`(C)` label convention), and `explanation`. Concept steps have `body`. `counts` = `{ totalSteps: 26, interactiveProblems: 15, conceptCards: 11 }`. `prerequisites: ["coulombs-law"]`.

Interaction types per step: 3 tap, 5 multiple-choice, 7 drag, 8 tap, 10 drag, 11 multiple-choice, 13 tap, 14 multiple-choice, 16 tap, 18 tap, 19 multiple-choice, 20 ordering (+ `ordering` config), 22 drag, 24 drag, 25 numeric (+ `numeric` config).

- [ ] Write the file, then validate with the content tests (Task F3).

### Task F3: Register lesson 2 and extend content tests

**Files:**
- Modify: `frontend/src/content/index.ts` (import `lesson2`, add to `lessons`)
- Modify: `frontend/src/content/content.test.ts`

- [ ] `index.ts`: `import lesson2 from './lessons/lesson2.json';` and `const lessons = [lesson1, lesson2] as unknown as Lesson[];` (use `as unknown as` if tsc complains about the new union).
- [ ] `content.test.ts`: add the lesson 2 entry to `expectedLessons` (`counts: { totalSteps: 26, interactiveProblems: 15, conceptCards: 11 }`, `prerequisites: ['coulombs-law']`), update the `toHaveLength` count from 1 to 2, add `'ordering'` to `KNOWN_INTERACTION_TYPES`, and add a config check:

```ts
if (step.interactionType === 'ordering') {
  expect(step.ordering, `${where} ordering config`).toBeDefined();
  expect(step.ordering!.items.length, `${where} ordering items`).toBeGreaterThan(1);
}
```

- [ ] Run `npm test src/content/content.test.ts`. Expected: PASS.

### Task F4: Make lesson 2 live

**Files:**
- Modify: `frontend/src/progress/dashboardProgress.ts`

- [ ] Add to `LIVE_LESSONS`: `{ lessonId: 'charging-conductors-insulators', sequence: 2, title: 'Charging, Conductors & Insulators' }`.
- [ ] Run the progress tests: `npm test src/progress`. Fix any count expectations that assume a single live lesson.

### Task F5: The `Ordering` interaction widget

**Files:**
- Create: `frontend/src/components/lesson/interactions/Ordering.tsx`
- Create: `frontend/src/components/lesson/interactions/Ordering.test.tsx`

**Interfaces:**
- Consumes: `OrderingConfig` from `../../../content`, `AnswerStatus` from `../FeedbackRenderer`.
- Produces: `Ordering({ config, disabled, onResult }: { config: OrderingConfig; disabled?: boolean; onResult: (s: AnswerStatus) => void })`.

Implementation: render the items in a shuffled-but-deterministic initial order (never the correct order on load). Each row has accessible Up/Down controls (keyboard operable) to reorder. A "Check order" button calls `onResult('correct')` only when the current id order equals `correctOrder ?? items.map(i => i.id)`, else `'wrong'`. No drag is required for correctness (keyboard + buttons are the source of truth); drag may be added but must not be the only path. Namespace classes `cci-order-*`.

- [ ] Write the failing test (renders items not in correct order; reordering to correct then Check yields `correct`; a wrong order yields `wrong`).
- [ ] Implement until tests pass.

### Task F6: The `ChargingExperience` driver

**Files:**
- Create: `frontend/src/components/lesson/ChargingExperience.tsx`
- Modify: `frontend/src/components/lesson/LessonRenderer.tsx`

**Interfaces:**
- Produces: `export const CHARGING_LESSON_ID = 'charging-conductors-insulators';` and `ChargingExperience({ isFinalStep, learnerStep, onContinue, step }: { isFinalStep: boolean; learnerStep: LearnerStep; onContinue: () => void; step: Step })`.

Mirror `CoulombExperience.tsx`: the same rail/stage layout (reuse the `cl1-` layout classes for structural parity, or `cci-` equivalents), the same status/feedback flow, and a `renderStage()` switch over `step.stepNumber` to the 26 scene components imported from `./scenes/charging/StepNN_Name`. Gating sets:

```ts
const EXPLORE_GATED = new Set([3, 7, 10, 13, 16, 18, 22, 24]);
const STAGE_CHOICE_STEPS = new Set([8]);
const REVEAL_ON_CORRECT = new Set<number>();
```

Numeric step (25) uses `NumericInput`; ordering step (20) uses `Ordering`; step 8 answers on the canvas (stage-choice); all other interactive steps use the rail choices.

- [ ] `LessonRenderer.tsx`: add `import { CHARGING_LESSON_ID, ChargingExperience } from './ChargingExperience';` and an `else if (lesson.lessonId === CHARGING_LESSON_ID)` branch returning `<ChargingExperience .../>` with the same props shape as the Coulomb branch.

### Task F7: Scene stubs for all 26 steps

**Files:**
- Create (26): `frontend/src/components/lesson/scenes/charging/StepNN_Name.tsx`

Each stub is a minimal valid component so the driver compiles and the gallery renders a labeled placeholder:

```tsx
export function StepNN_Name() {
  return <div className="cci-stub" data-testid="cci-stub-NN">Step NN scene (placeholder)</div>;
}
```

Use the exact file names listed in the status ledger so Phase 2 owners match. CSS and test files are created by each step's builder subagent.

- [ ] Create all 26 stubs. Run `npm run build`. Expected: PASS (driver imports resolve).

### Task F8: DEV-only Scene Gallery route

**Files:**
- Create: `frontend/src/pages/DevSceneGalleryPage.tsx`
- Modify: `frontend/src/App.tsx`

`DevSceneGalleryPage` reads `:step` from params, loads `getLessonById('charging-conductors-insulators')`, builds the learner step with `toLearnerStep`, and renders `<ChargingExperience step={rawStep} learnerStep={learnerStep} isFinalStep={false} onContinue={() => {}} />` inside the lesson shell markup, at a fixed viewport. It needs no auth and no progress.

- [ ] `App.tsx`: add, OUTSIDE `ProtectedRoute`, gated by DEV:

```tsx
{import.meta.env.DEV ? (
  <Route path="/dev/charging/:step" element={<DevSceneGalleryPage />} />
) : null}
```

- [ ] Verify `http://localhost:5173/dev/charging/1` renders step 1 with no sign-in.

### Task F9: Extend the shared lesson driver for lesson 2

**Files:**
- Modify: `frontend/src/test/lessonDriver.ts`

The two "walk every lesson" tests in `LessonPlayer.test.tsx` iterate
`getCourseLessons()`, so they now include lesson 2. They can only pass once the
scenes exist and the driver knows how to trip lesson 2's explore gates. Add
`revealLessonTwoGates()` (called alongside `revealLessonOneGates()` in the default
and tap branches) that trips lesson 2's gate controls.

**Explore-trigger contract (every explore-gated lesson-2 scene must satisfy one):**
- A draggable handle: an SVG `role="slider"` named `Charged rod` or `Test charge`
  (driver nudges it with Arrow keys), OR
- A button with `data-testid="cci-explore-trigger"` (driver clicks it; for staged
  scenes like induction it clicks repeatedly until no longer present).

`revealLessonTwoGates()` queries for those and operates them; it is a no-op when
absent. Step 25 (numeric) and step 20 (ordering) are handled by the existing
`solveNumeric` and a new `solveOrdering` branch (reorder to the correct order via
the widget's Up controls, then Check).

**Note:** These two walk tests are PHASE 3 integration gates. They stay red until
all 26 scenes are built and F9 lands. Do not weaken them. The Foundation gate
below excludes them.

**Foundation gate:** `npm run build` passes; `npm test src/content` and
`npm test src/components/lesson/interactions/Ordering` pass; the gallery renders
every step (placeholder or real); the lesson loads at
`/lesson/charging-conductors-insulators` when signed in. The two full-lesson walk
tests are tracked under Phase 3.

---

## Phase 2: Per-step build (parallel, one subagent per step)

For each step NN, two subagents in sequence. The step is "green" only after the verifier passes.

### Builder subagent (per step)

**Owns exactly:** `scenes/charging/StepNN_Name.tsx`, `StepNN_Name.css`, `StepNN_Name.test.tsx`. Reads `lesson2.json` (its step), `scenes/primitives.tsx`, `physics.ts`, the gallery.

- [ ] Write the failing test(s) for the scene/interaction behavior (correct + wrong answer, explore gate / stage-choice / animation end-state as applicable).
- [ ] Implement the scene in `StepNN_Name.tsx` using the shared primitives (`Charge`, `Arrow`, `DragHandle`, `Figure`, `Legend`, `ReadoutRow`, `usePointerDrag`) and pure helpers from `physics.ts`. Animations follow the `RubTransferScene` pattern (single elapsed-time input, reduced-motion fallback to the final frame).
- [ ] Style in `StepNN_Name.css` with `cci-NN-` namespaced classes referencing theme tokens only.
- [ ] Loop on: `npm test StepNN`, typecheck, and a self visual check in the gallery, until green.
- [ ] Update the status ledger row to "built, awaiting verify".

### Verifier subagent (per step, independent)

- [ ] Re-run `npm test StepNN` and confirm pass.
- [ ] Visual gate against `http://localhost:5173/dev/charging/NN` (see protocol below). Capture many frames across any animation using Playwright's clock to scrub time, plus the resting frame.
- [ ] Return PASS (mark the ledger row green) or a concrete defect list (re-open the builder).

### Visual verification protocol (every step)

- Resting frame correct and on-theme; rail prompt/choices/feedback aligned to the lesson's vertical rhythm.
- Pixel alignment: elements centered on the scene grid; charge glyphs baseline-centered; arrows anchored to charge edges, not overlapping glyphs; nothing clipped at the SVG viewBox.
- Animations: install `page.clock`, trigger the scene's start (button or auto), and `fastForward` in small increments capturing at least 12 evenly spaced frames across the full duration, plus the exact boundary frames for staged scenes (induction's approach/ground/unground/withdraw). Confirm motion progresses (no frozen/skipped frames), is monotonic where intended, lands on the correct end state, and that reduced-motion jumps to the correct final frame.
- Behavior: explore gate hides choices until interaction; stage-choice answers on canvas; correct/wrong paths fire the right feedback.

---

## Phase 3: Integration (serial)

**Files:** none new; cross-cutting verification.

- [ ] `cd frontend && npm run build` passes.
- [ ] `cd frontend && npm test` passes (whole suite).
- [ ] Playwright playthrough: sign in with the seeded dev account, navigate to `/lesson/charging-conductors-insulators`, advance all 26 steps, screenshot each, confirm step flow, the explore gates, XP burst, completion screen, and progress wiring.
- [ ] Cross-step rhythm: scenes share scale and spacing; the lesson reads as one piece with Coulomb.
- [ ] Any regression re-opens that step's builder.

**Done:** Foundation gate green, all 26 step rows green, Phase 3 green. The ralph loop writes `.cursor/ralph-done`.

---

## Status ledger

The authoritative per-step state lives in `docs/superpowers/plans/charging-build-status.md` (created with the ralph loop). Each ralph iteration reads it, advances the least-done work, and updates it. The loop terminates only when every row is green and Phase 3 passes.

## Self-review

- Spec coverage: every spec step has a row in F2 and a Phase 2 pair; the schema/gallery/registration items map to F1, F3, F4, F8. Covered.
- Placeholder scan: scene stubs in F7 are intentional placeholders replaced in Phase 2; no other placeholders.
- Type consistency: `OrderingConfig`/`OrderingItem` (F1) are consumed by F5 and step 20; `CHARGING_LESSON_ID` (F6) is consumed by `LessonRenderer` and the gallery; scene file names in F7 match the ledger and the driver switch in F6.
