# Emergent Misconceptions: Design Spec

Status: draft for review
Date: 2026-06-26
Supersedes: the hardcoded 12-item misconception bank in `frontend/src/content/misconceptions.ts`

## Goal

Replace the fixed, human-authored misconception catalog with a per-student
misconception graph that the AI grows from the student's actual mistakes. The
system starts knowing nothing about what a student gets wrong and learns each
learner's specific misconceptions from real errors, then drives review and
mastery off that graph.

## Locked decisions

1. No hardcoded misconceptions. Each student's graph starts empty and is built from their errors.
2. The grader tags every wrong answer as a careless slip or a conceptual error. Only conceptual errors enter the misconception pipeline.
3. A conceptual error carries a canonical signature: a principle plus a one-line wrong belief, with instance numbers ignored.
4. Match-or-create: a conceptual miss either matches an existing note/misconception or starts a new note. The second matching conceptual miss promotes a note to a tracked misconception.
5. Mastery requires spacing: roughly 3 correct attempts across separate days (not one sitting), with strength decaying over time.
6. Catches and review use generate-to-target: the engine generates a problem aimed at the misconception's wrong belief; a correct solve that does not show the error is a spaced catch, showing it again is a miss.
7. Scope is per-student to start (each learner grows their own graph). Global cross-student clustering is out of scope for now.

## Lifecycle (one student, one mistake)

1. Student submits a wrong answer to a problem.
2. The grader returns, in addition to the existing fields, an `errorType` of `slip` or `concept`. For `concept` it also returns a `signature`: `{ principleId, wrongBelief }` (a generalized one-sentence belief, no instance numbers) and a short `specificNote` (the human-readable detail shown to the student).
3. If `slip`: show the feedback, record nothing in the graph.
4. If `concept`: run match-or-create against this student's existing notes and tracked misconceptions:
   - Match found (same principle, same wrong belief): increment that node's miss count. If it was a note, promote it to a tracked misconception (its second matching miss).
   - No match: create a new note with this signature (one miss, not yet tracked).
5. A tracked misconception then enters the mastery loop: the composer generates targeted problems for it; correct spaced solves raise strength, repeat errors lower it; it is mastered at the spaced threshold and decays if neglected.

## Data model (per-student)

Stored in the user's cloud document (extends `progress.misconceptions`). Each entry is either a note or a tracked misconception:

```ts
type MisconceptionNode = {
  id: string;                 // generated, stable per student
  status: 'note' | 'tracked';
  principleId: string;        // anchors the grain; one of the ~12 principles
  wrongBelief: string;        // canonical one-line signature used for matching
  specificNote: string;       // latest human-readable detail (for the map and feedback)
  caught: number;
  missed: number;
  strength: number;           // stored retrievability at lastSeen, 0..1
  lastSeenISO: string;
  caughtDayStamps: string[];  // distinct local days on which a catch counted, for spacing
  elicitedByProblemIds: string[]; // problems/variants that produced this error (for context)
  createdISO: string;
};
```

Notes (`status: 'note'`) are not shown on the mastery map and are not targeted for
review; they exist only so a second matching miss can promote them. The mastery
map shows only `tracked` nodes.

## Match-or-create (the crux)

Given a new conceptual signature and the student's existing nodes:

- Candidate set: existing nodes with the same `principleId` (the principle is a hard partition; two errors under different principles never merge).
- Decision: an AI judge (or an embedding similarity with a threshold) decides whether the new `wrongBelief` is the same underlying mistake as any candidate's `wrongBelief`. Start with a constrained LLM judge ("here is a new wrong belief and this student's existing wrong beliefs under this principle; return the id of the same one, or 'new'"), which is simple and explainable; move to embeddings + threshold if cost or latency demands it.
- Output: a matched node id, or create a new note.

This step is the make-or-break. Too strict spawns duplicates that never reach the
second miss; too loose merges distinct mental models. Mitigations: the principle
partition narrows candidates; the wrong-belief grain (no instance numbers) keeps
comparisons stable; a periodic cleanup pass can merge near-duplicate nodes.

## Mastery with spacing

Reuse the existing strength and decay math (`frontend/src/mastery/masteryModel.ts`):
a catch moves strength toward 1, a miss cuts it, and current strength decays by a
half-life that grows with catches. Change the mastery rule to require spacing:

- A catch only adds a new day to `caughtDayStamps` if it falls on a different local day than the last counted catch (same-day catches do not add a spaced rep).
- Mastered when `currentStrength >= 0.8` AND `caughtDayStamps.length >= 3` (tunable; was `caught >= 2` with no spacing).

So mastery is roughly three correct attempts on three separate days, sustained
against decay.

## Catches and review (generate-to-target)

There are no pre-labeled problems for emergent misconceptions, so review is generated:

- The composer selects the student's weakest or most-decayed tracked misconceptions (lowest current strength), exactly as it selects today.
- For each, it generates a problem aimed at the misconception's `wrongBelief` (the synthesis engine, pointed at the belief: "compose a problem a student who believes <wrongBelief> would get wrong"), runs it through the existing verification gate, and serves it.
- Grading the result credits the misconception: a correct solve that does not exhibit the error is a catch (and, if on a new day, a spaced rep); exhibiting the same error again is a miss. The grader's concept tagging is what decides which.

## Integration with what exists

- Grader (`backend/functions/src/openai.ts`, `parse.ts`, `types.ts`): the grade result gains `errorType` and, for concept errors, `signature` and `specificNote`. The never-reveal-the-answer guardrail is unchanged.
- Recording (`frontend/src/progress/ProgressContext.tsx`): the miss path runs match-or-create (an async AI step) instead of crediting fixed tags; the catch path credits the targeted misconception with the spacing rule.
- Mastery model (`frontend/src/mastery/masteryModel.ts`): add the spacing requirement and the node shape; keep strength and decay.
- Composer (`frontend/src/assign/*`): target tracked emergent misconceptions; fill their review slots via generate-to-target rather than tag-matched authored problems.
- Mastery map (`frontend/src/pages/MasteryPage.tsx`): render the per-student tracked nodes (name from `wrongBelief`/`specificNote`), which is what it already does, just over a dynamic set.
- The hardcoded `MISCONCEPTIONS` bank and the static `misconceptionTags` on authored problems are removed or demoted to optional seeds.

## Risks and costs (honest)

- Match quality is the central risk (duplicates vs over-merge). Needs tuning with real data and a cleanup pass.
- Cost and latency: an AI match step on every conceptual miss, plus targeted generation per review. More calls than today.
- Cold start: a new student's map is empty until they make repeated mistakes, which is correct but means the map is sparse early.
- Grading reliability: "did the student exhibit this exact misconception again" is a finer judgment than "is the final number right"; the concept tagging must be dependable.
- Depends on the deploy-gated synthesis + verification engine (needs the OpenAI key, a deploy, and Blaze) for generate-to-target review.

## Phasing

1. Grader emits `errorType` + `signature` + `specificNote` (pure parse tested; live path flagged).
2. Per-student node model + match-or-create + promotion-on-second-miss + the spacing mastery rule (pure logic tested; the AI match boundary mocked in tests).
3. Composer targets emergent nodes and generates review via generate-to-target.
4. Mastery map renders the dynamic per-student graph; remove the hardcoded bank.
5. Tuning: match thresholds, cleanup/merge pass, cost controls (embeddings if needed).

## Out of scope (for now)

- Global cross-student misconception clustering.
- Embedding-based matching (start with the LLM judge; add later if needed).
- Automatic promotion of a student's node into a shared/global catalog.

## Open / tunable parameters

- Spacing unit (separate days vs separate sessions with a minimum gap) and the catch count for mastery (default 3 days).
- Match strictness (LLM judge prompt or embedding threshold).
- Whether a single high-confidence conceptual miss can create a tracked misconception immediately, or always requires the second miss (default: requires the second).
