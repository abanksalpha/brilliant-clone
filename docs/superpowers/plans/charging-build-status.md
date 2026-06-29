# Charging, Conductors & Insulators: Build Status Ledger

Authoritative state for the ralph loop. Each iteration reads this, advances the
least-done work, and updates it. Loop ends (write `.cursor/ralph-done`) only when
every row below is green and Phase 3 passes.

Legend: [ ] todo, [~] in progress, [x] done/green.

## Phase 1: Foundation (serial)

- [x] F1: schema `ordering` type
- [x] F2: `lesson2.json` full content
- [x] F3: register lesson 2 + content tests (content.test.ts green)
- [x] F4: `LIVE_LESSONS` entry
- [x] F5: `Ordering` widget + test (foundation subagent)
- [x] F6: `ChargingExperience` driver + `LessonRenderer` branch (foundation subagent)
- [x] F7: 26 scene stubs (foundation subagent)
- [x] F8: DEV Scene Gallery route (foundation subagent)
- [x] F9: extend `lessonDriver` for lesson 2 (`revealLessonTwoGates`, `solveOrdering`)
- [x] Foundation gate: `npm run build` green; `npm test src/content` + Ordering test green; gallery renders; lesson loads

Note: the two "walk every lesson" tests in `LessonPlayer.test.tsx` are Phase 3
gates. They stay red until all 26 scenes are built and F9 lands. Do not weaken
them.

## Phase 2: Per-step (parallel). Columns: built / verified

| Step | Scene file | Built | Verified |
|------|-----------|-------|----------|
| 1  | Step01_StickyBalloon.tsx     | [x] | [x] |
| 2  | Step02_TwoMaterials.tsx      | [x] | [x] |
| 3  | Step03_ElectronMobility.tsx  | [x] | [x] |
| 4  | Step04_ElectronSea.tsx       | [x] | [x] |
| 5  | Step05_ClassifyMaterials.tsx | [x] | [x] |
| 6  | Step06_ChargeNearby.tsx      | [x] | [x] |
| 7  | Step07_PolarizeMetal.tsx     | [x] | [x] |
| 8  | Step08_WhichSidePositive.tsx | [x] | [x] |
| 9  | Step09_WhyAttract.tsx        | [x] | [x] |
| 10 | Step10_NetPull.tsx           | [x] | [x] |
| 11 | Step11_AttractOrRepel.tsx    | [x] | [x] |
| 12 | Step12_ThreeWays.tsx         | [x] | [x] |
| 13 | Step13_Conduction.tsx        | [x] | [x] |
| 14 | Step14_ConductionSign.tsx    | [x] | [x] |
| 15 | Step15_Grounding.tsx         | [x] | [x] |
| 16 | Step16_DrainToGround.tsx     | [x] | [x] |
| 17 | Step17_InductionTrick.tsx    | [x] | [x] |
| 18 | Step18_Induction.tsx         | [x] | [x] |
| 19 | Step19_InductionSign.tsx     | [x] | [x] |
| 20 | Step20_OrderInduction.tsx    | [x] | [x] |
| 21 | Step21_InsulatorsPolarize.tsx| [x] | [x] |
| 22 | Step22_PolarizeInsulator.tsx | [x] | [x] |
| 23 | Step23_SurfaceCharge.tsx     | [x] | [x] |
| 24 | Step24_SpreadToSurface.tsx   | [x] | [x] |
| 25 | Step25_ShareCharge.tsx       | [x] | [x] |
| 26 | Step26_Summary.tsx           | [x] | [x] |

## Phase 3: Integration (serial)

- [x] Full `npm run build` green
- [x] Full `npm test` green (490 passed, including the two end-to-end walk tests)
- [x] Playwright playthrough of all 26 steps green (all-26 gallery montage)
- [x] Cross-step visual rhythm verified
