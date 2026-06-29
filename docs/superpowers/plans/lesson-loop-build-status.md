# Lesson Loop Transformation: Build Status Ledger

Authoritative state for the ralph loop. Each iteration reads this, advances the
least-done eligible unit (respecting wave order and dependencies), and updates
it. Loop ends (write `.cursor/ralph-done`) only when every row below is green and
the Wave 3 gates pass.

Legend: [ ] todo, [~] in progress, [x] done/green. Subagents run on
`claude-opus-4-8-thinking-max-fast`. A unit is green only after an independent
verifier passes (UI units include a pixel-aligned screenshot gate).

## Wave 0: Foundation (serial)

- [x] F0: PRODUCT.md + DESIGN.md (impeccable context)
- [x] F1: delete saga + dead surfaces; fix App.tsx routes; build/test green on reduced surface
- [x] F2: LessonModule schema + content/index loaders + validation
- [x] F3: progress phase state + unified completion + counting
- [x] F4: review-3 blueprint + buildReviewAssignment wiring
- [x] F5: LessonSession orchestrator + /lesson route (against stubs)
- [x] F6: dashboard structural change (one node per lesson; logic only)
- [x] F7: test driver rewrite; walk tests deferred to Wave 3
- [x] Foundation gate: build green; test green (excl. walk tests); session shell loads; obsolete routes gone

### F1 widget decisions (delete if saga-only, keep if still referenced)

- Deleted (saga-only): `FeedbackRenderer`, `lessonExperience`, `conceptVisuals`,
  `scenes/conceptScenes`, `scenes/interactiveScenes`, `interactions/NumericInput`,
  `interactions/VectorAim`, `interactions/BuildFormula`, `interactions/Ordering`.
- Kept: `RichText` (generic; now reused by `ExplanationSlides`), `ChargeSandbox`
  (Phase 2 reuse; its `AnswerStatus` type was inlined to drop the FeedbackRenderer
  dependency), `scenes/primitives`, `physics`, `session/SessionChrome`.
- The dead saga schema types (`Step`, interaction configs, the saga `Lesson`) were
  pruned from `content/schema.ts`; only the `Sandbox*` primitives and the new
  `LessonModule` types remain.

## Wave 1: Components and chrome (parallel). Columns: built / verified

| Unit | Owns | Built | Verified |
|------|------|-------|----------|
| W1-A PhaseBar            | PhaseBar.{tsx,css,test}             | [ ] | [ ] |
| W1-B Confetti per phase  | lib/confetti.ts celebratePhase + call site | [ ] | [ ] |
| W1-C InquiryPrompt       | InquiryPrompt.{tsx,css,test}        | [ ] | [ ] |
| W1-D WorkedExample       | WorkedExample.{tsx,css,test}        | [ ] | [ ] |
| W1-E CompletionProblem   | CompletionProblem.{tsx,css,test}    | [ ] | [ ] |
| W1-F Dashboard restyle   | DashboardPage.tsx + dashboard CSS   | [ ] | [ ] |
| W1-G ExplanationSlides   | ExplanationSlides.{tsx,css,test}    | [ ] | [ ] |

Note: F5 created minimal stub versions of PhaseBar, InquiryPrompt, ExplanationSlides,
WorkedExample, CompletionProblem and added `celebratePhase` to lib/confetti so the
session runs end to end. Wave 1 replaces each stub with the styled, verified build.

- [ ] Wave 1 gate: all units verified; full five-phase run against a fixture module; confetti + phase bar working

## Wave 2: Lesson authoring (parallel). Columns: built / verified

| Lesson | Module + problems + keys | Built | Verified |
|--------|--------------------------|-------|----------|
| L1 Coulomb's Law (+ mechanics review seeds) | content/modules/coulombs-law.ts + problems + keys | [ ] | [ ] |
| L2 Charging, Conductors & Insulators        | content/modules/charging-conductors-insulators.ts + problems + keys | [ ] | [ ] |
| L3 Electric Field & Field Lines             | content/modules/electric-field-field-lines.ts + problems + keys | [ ] | [ ] |

Note: F5 left a temporary `content/modules/coulombs-law.ts` fixture (reviewSkillIds
empty) so /lesson/coulombs-law renders all five phases against the stubs. Wave 2
replaces its content with the fully authored module and seeds.

- [ ] Wave 2 gate: all three play end to end; reviews on L2/L3 pull prior-lesson problems via the composer

## Wave 3: Integration (serial)

- [ ] Full `npm run build` green
- [ ] Full `npm test` green (including rewritten walk tests over all three modules)
- [ ] Playwright end-to-end: three lessons, five phases each, gating, friends, XP/streak, obsolete routes gone
- [ ] Pixel-rhythm pass across the three lessons
- [ ] Clean-and-concise sweep (no dead imports/CSS/exports); README updated
- [ ] All green -> write `.cursor/ralph-done`
