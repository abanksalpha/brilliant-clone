# Emergent Misconceptions Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Parallel file-disjoint implementers per wave, TDD, controller verifies every wave.

Goal: replace the hardcoded misconception bank with a per-student misconception
graph the AI grows from real errors. Spec:
docs/superpowers/specs/2026-06-26-emergent-misconceptions-design.md.

Architecture (the key decision): the concept-vs-slip tag and the match-or-create
judgment happen inside the grade call. The client sends the student's existing
node signatures; the grader returns errorType and, for a conceptual error, either
a matched node id or a freshly proposed signature. The graph mutation (create
note, increment, promote on the second matching miss, credit a spaced catch) is
pure, deterministic client logic and is fully unit-tested. The only AI boundary is
the grader judgment, mocked in tests and flagged for live verification.

Tech stack: React 19 + Vite + TS frontend, Firebase Functions v2 + OpenAI backend, Vitest both sides.

## Global Constraints

- No mocks and no fallbacks in product code. Throw on failure; never fabricate a grade, node, or match. Mocks only in *.test.* at boundaries.
- No em dashes anywhere. No double hyphen as prose punctuation.
- No extraneous UI. Reuse existing hand-drawn classes and tokens; only append minimal CSS if a needed element is missing. Graphical changes pixel-aligned.
- Server-only answers stay server-side. Per-student scope.
- TDD: failing test first, watch fail, then implement. Pure graph logic is deterministic.
- Stay within each task's files. Do not run git or commit.

## Shared interfaces (define verbatim in the tasks that own them)

```ts
// backend types.ts + mirrored in frontend grading.ts and the graph module
type ErrorType = 'concept' | 'slip';

type KnownMisconception = { id: string; principleId: string; wrongBelief: string };

type ConceptMatch = {
  matchedNodeId: string | null; // an existing known node id, or null = propose new
  principleId: string;          // one of the allowed principle ids
  wrongBelief: string;          // canonical one-line signature, no instance numbers
  specificNote: string;         // human-readable detail for feedback and the map
};

type GradeInput = {
  problemId: string;
  imagePngBase64: string;
  lines: LineRef[];
  knownMisconceptions: KnownMisconception[];
  allowedPrincipleIds: string[];
};

type GradeResult = {
  isCorrect: boolean;
  transcribedSteps: string[];
  firstErrorLineId: string | null;
  explanation: string;
  correctSolution?: string[];
  errorType?: ErrorType;       // present when isCorrect is false
  conceptMatch?: ConceptMatch; // present when errorType is 'concept'
};
```

The old `misconceptionId` / `allowedMisconceptionIds` plumbing is removed.

## Per-student graph (owned by the frontend graph module)

```ts
type NodeStatus = 'note' | 'tracked';
type MisconceptionNode = {
  id: string; status: NodeStatus; principleId: string;
  wrongBelief: string; specificNote: string;
  caught: number; missed: number; strength: number;
  lastSeenISO: string; caughtDayStamps: string[]; createdISO: string;
};
type MisconceptionGraph = Record<string, MisconceptionNode>;
```

Stored in `progress.misconceptions` (replaces the old `MasteryMap` of fixed ids).

## Waves

Wave 1 (parallel, disjoint): EM-A backend grade contract; EM-B frontend graph module.
Wave 2 (after verify): EM-C frontend grading client types; EM-D persistence + recordProblemResult graph integration.
Wave 3: EM-E ProblemPlayer (send known signatures, concept/slip framing, pattern-spotted moment); EM-F MasteryPage dynamic graph; EM-G composer targets emergent nodes + generate-to-target.
Wave 4: remove the hardcoded MISCONCEPTIONS bank and the static misconceptionTags pipeline; cleanup; final whole-branch review.

Each wave ends with the controller running: `cd frontend && npm test && npm run build` and `cd backend/functions && npm run build && npm test`, green before proceeding.

## Task summaries

- EM-A (backend): `types.ts` (new shapes above), `parse.ts` (parse errorType + conceptMatch, drop misconceptionId; validate principleId in allowedPrincipleIds, matchedNodeId in knownMisconception ids or null), `openai.ts` buildGradePrompt (classify slip vs concept; for concept match against knownMisconceptions or propose a new principleId + wrongBelief; never reveal the answer), `parse.test.ts`. Backend.
- EM-B (frontend): `frontend/src/mastery/misconceptionGraph.ts` (+test): node shape, `applyConceptMiss(graph, conceptMatch, now)` (match -> ++missed and promote on the second matching miss; no match -> new note), `applyCatch(graph, nodeId, now)` (++caught, add a distinct day to caughtDayStamps, raise strength), reuse currentStrength/decay, `isNodeMastered` (strength >= 0.8 and caughtDayStamps.length >= 3), `knownSignatures(graph)` (to send to the grader). Pure. Define a local mirror of ConceptMatch.
- EM-C (frontend): `grading.ts` mirror the new GradeInput/GradeResult/KnownMisconception/ConceptMatch; tests.
- EM-D (frontend): `dashboardProgress.ts` (misconceptions becomes MisconceptionGraph; normalize the new node shape, back-compatible), `cloudStore.ts` round-trip, `ProgressContext.tsx` recordProblemResult uses the grade result (applyConceptMiss on a concept miss, applyCatch on a targeted catch) via the graph module, `problemSessionProgress.ts` coerceGradeResult tolerant of the new optional fields, `backend/firestore.rules` (misconceptions still a map, size guard); tests.
- EM-E (frontend): `ProblemPlayer.tsx` send `knownMisconceptions` + `allowedPrincipleIds` on grade/hint/ask; concept-vs-slip framing in feedback; a quiet pattern-spotted moment when a node promotes; tests.
- EM-F (frontend): `MasteryPage.tsx` render the dynamic per-student graph (tracked only), empty state, spacing indicator; stop importing the hardcoded bank; tests.
- EM-G (frontend + backend): composer targets tracked emergent nodes; generate-to-target review via the synthesis engine pointed at wrongBelief (deploy-gated, boundary mocked).
- EM-H (cleanup): remove `MISCONCEPTIONS` bank and static `misconceptionTags` usage, retire dead plumbing; final review.

## Self-review note
Spec coverage: lifecycle (EM-A grade tag + match; EM-B graph + promote + spacing; EM-D record; EM-E surface), generate-to-target (EM-G), dynamic map (EM-F), bank removal (EM-H). Deploy-gated: grader judgment (EM-A live), generate-to-target (EM-G live). Type consistency: the shared interfaces above are copied verbatim into EM-A, EM-C, and EM-B's local mirror.
