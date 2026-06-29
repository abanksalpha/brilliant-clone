import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import * as logger from 'firebase-functions/logger';
import { initializeApp } from 'firebase-admin/app';
import {
  AskInput,
  ExplainFeedbackInput,
  GradeInput,
  HintInput,
  PlanProblemSetInput,
  PlannedProblemInput,
  PlanSlot,
  TargetMisconception,
} from './types';
import { resolveProblemKey } from './keyResolver';
import { getSynthesisKey, saveSynthesisProblem } from './synthesisStore';
import { planProblemSet as runPlanProblemSet, synthesizePlannedProblem, toProblemKey } from './synthesis';
import {
  answerQuestionWithOpenAI,
  feedbackOnExplanationWithOpenAI,
  gradeWithOpenAI,
  hintWithOpenAI,
} from './openai';
import { validateLineRefs } from './parse';

initializeApp();
const OPENAI_API_KEY = defineSecret('OPENAI_API_KEY');

export const gradeAttempt = onCall({ secrets: [OPENAI_API_KEY] }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');
  const { problemId, imagePngBase64, lines, knownMisconceptions, allowedPrincipleIds } =
    request.data as GradeInput;
  if (!problemId || !imagePngBase64 || !Array.isArray(lines)) {
    throw new HttpsError('invalid-argument', 'problemId, imagePngBase64, lines required');
  }
  // The allowed principle ids come from the client's principle catalog; there is
  // no server fallback, so a request that omits them is rejected rather than
  // graded against a stale duplicate list. An empty knownMisconceptions array is
  // valid (a student with no recorded misconceptions yet); it is never fabricated.
  if (!Array.isArray(allowedPrincipleIds) || allowedPrincipleIds.length === 0) {
    throw new HttpsError('invalid-argument', 'allowedPrincipleIds required');
  }
  if (!Array.isArray(knownMisconceptions)) {
    throw new HttpsError('invalid-argument', 'knownMisconceptions must be an array');
  }
  let validLines;
  try {
    validLines = validateLineRefs(lines);
  } catch (e) {
    throw new HttpsError('invalid-argument', (e as Error).message);
  }
  let key;
  try {
    key = await resolveProblemKey(problemId, getSynthesisKey);
  } catch {
    throw new HttpsError('not-found', 'unknown problem');
  }
  try {
    return await gradeWithOpenAI(
      key,
      imagePngBase64,
      validLines,
      knownMisconceptions,
      allowedPrincipleIds,
      OPENAI_API_KEY.value(),
    );
  } catch (e) {
    logger.error('gradeAttempt failed', { problemId, error: (e as Error).message, stack: (e as Error).stack });
    throw new HttpsError('internal', `grading failed: ${(e as Error).message}`);
  }
});

export const getHint = onCall({ secrets: [OPENAI_API_KEY] }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');
  const { problemId, imagePngBase64, lines, level, priorHints } = request.data as HintInput;
  if (!problemId || !imagePngBase64 || !Array.isArray(lines)) {
    throw new HttpsError('invalid-argument', 'problemId, imagePngBase64, lines required');
  }
  if (typeof level !== 'number' || !Number.isInteger(level) || level < 0) {
    throw new HttpsError('invalid-argument', 'level must be a non-negative integer');
  }
  // Bound the prompt: keep only string hints and cap how many we forward.
  const safePriorHints = Array.isArray(priorHints)
    ? priorHints.filter((hint): hint is string => typeof hint === 'string').slice(0, 24)
    : [];
  let validLines;
  try {
    validLines = validateLineRefs(lines);
  } catch (e) {
    throw new HttpsError('invalid-argument', (e as Error).message);
  }
  let key;
  try {
    key = await resolveProblemKey(problemId, getSynthesisKey);
  } catch {
    throw new HttpsError('not-found', 'unknown problem');
  }
  try {
    return await hintWithOpenAI(key, imagePngBase64, validLines, level, safePriorHints, OPENAI_API_KEY.value());
  } catch (e) {
    logger.error('getHint failed', { problemId, error: (e as Error).message, stack: (e as Error).stack });
    throw new HttpsError('internal', `hint failed: ${(e as Error).message}`);
  }
});

export const askQuestion = onCall({ secrets: [OPENAI_API_KEY] }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');
  const { problemId, imagePngBase64, lines, question } = request.data as AskInput;
  if (!problemId || !imagePngBase64 || !Array.isArray(lines)) {
    throw new HttpsError('invalid-argument', 'problemId, imagePngBase64, lines required');
  }
  if (typeof question !== 'string' || question.trim().length === 0) {
    throw new HttpsError('invalid-argument', 'question must be a non-empty string');
  }
  if (question.length > 1000) {
    throw new HttpsError('invalid-argument', 'question is too long');
  }
  let validLines;
  try {
    validLines = validateLineRefs(lines);
  } catch (e) {
    throw new HttpsError('invalid-argument', (e as Error).message);
  }
  let key;
  try {
    key = await resolveProblemKey(problemId, getSynthesisKey);
  } catch {
    throw new HttpsError('not-found', 'unknown problem');
  }
  try {
    return await answerQuestionWithOpenAI(key, imagePngBase64, validLines, question.trim(), OPENAI_API_KEY.value());
  } catch (e) {
    // Log the underlying cause: a thrown HttpsError is not logged by the runtime,
    // so without this the real OpenAI failure is invisible in the function logs.
    logger.error('askQuestion failed', { problemId, error: (e as Error).message, stack: (e as Error).stack });
    throw new HttpsError('internal', `question failed: ${(e as Error).message}`);
  }
});

// Formative feedback on a worked-example self-explanation. Unlike grading, there
// is no handwriting image: the student typed a conceptual answer after the full
// solution was revealed, so the model is grounded from the problem key. The
// response only gives feedback (and an isOnTrack flag for styling); it never
// blocks the learner, so any failure is handled as a soft error on the client.
export const explainFeedback = onCall({ secrets: [OPENAI_API_KEY] }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');
  const { problemId, question, answer } = request.data as ExplainFeedbackInput;
  if (!problemId || typeof question !== 'string' || typeof answer !== 'string') {
    throw new HttpsError('invalid-argument', 'problemId, question, answer required');
  }
  if (question.trim().length === 0 || answer.trim().length === 0) {
    throw new HttpsError('invalid-argument', 'question and answer must be non-empty');
  }
  if (question.length > 1000 || answer.length > 4000) {
    throw new HttpsError('invalid-argument', 'question or answer is too long');
  }
  let key;
  try {
    key = await resolveProblemKey(problemId, getSynthesisKey);
  } catch {
    throw new HttpsError('not-found', 'unknown problem');
  }
  try {
    return await feedbackOnExplanationWithOpenAI(
      key,
      question.trim(),
      answer.trim(),
      OPENAI_API_KEY.value(),
    );
  } catch (e) {
    logger.error('explainFeedback failed', { problemId, error: (e as Error).message, stack: (e as Error).stack });
    throw new HttpsError('internal', `explanation feedback failed: ${(e as Error).message}`);
  }
});

// A target misconception is { nodeId, principleId, wrongBelief }, all strings. An
// empty array is valid (a learner with no tracked nodes yet) and is never
// fabricated; the array is true only when every entry is well-formed.
function isTargetMisconceptionArray(value: unknown): value is TargetMisconception[] {
  return (
    Array.isArray(value)
    && value.every((t) => {
      const m = t as { nodeId?: unknown; principleId?: unknown; wrongBelief?: unknown };
      return (
        m !== null
        && typeof m === 'object'
        && typeof m.nodeId === 'string'
        && typeof m.principleId === 'string'
        && typeof m.wrongBelief === 'string'
      );
    })
  );
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((s) => typeof s === 'string');
}

// Validate one planner slot's shape. The planner forwards a slot's scope and
// misconceptions to Stage 2 unchanged, so a malformed slot is rejected up front
// rather than producing an unscoped problem.
function isPlanSlot(value: unknown): value is PlanSlot {
  if (value === null || typeof value !== 'object') return false;
  const s = value as Record<string, unknown>;
  return (
    isStringArray(s.skillIds)
    && isStringArray(s.principleIds)
    && typeof s.difficultyBand === 'number'
    && (s.kind === 'single' || s.kind === 'synthesis')
    && typeof s.requireChain === 'boolean'
    && isTargetMisconceptionArray(s.targetMisconceptions)
  );
}

// Stage 1 callable. Plans one distinct problem per generated slot in a set: a
// single model call, no verification (descriptions are never graded), so it is
// fast and cheap. Break-loud: a planner error or a malformed/non-distinct plan
// throws (logged) and the client surfaces the set-level retry. No template or
// authored substitution. The live OpenAI path is exercised only on deploy.
export const planProblemSet = onCall({ secrets: [OPENAI_API_KEY], timeoutSeconds: 120 }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');
  const { slots, existingStatements, lessonTitle } = request.data as PlanProblemSetInput;
  if (!Array.isArray(slots) || slots.length === 0 || !slots.every(isPlanSlot)) {
    throw new HttpsError('invalid-argument', 'slots must be a non-empty array of plan slots');
  }
  if (!isStringArray(existingStatements)) {
    throw new HttpsError('invalid-argument', 'existingStatements must be an array of strings');
  }
  if (typeof lessonTitle !== 'string' || lessonTitle.trim().length === 0) {
    throw new HttpsError('invalid-argument', 'lessonTitle must be a non-empty string');
  }
  try {
    const plans = await runPlanProblemSet({ slots, existingStatements, lessonTitle }, OPENAI_API_KEY.value());
    return { plans };
  } catch (e) {
    // Log the underlying cause (e.g. a wrong count or non-distinct descriptions)
    // so the real reason is visible in the logs; a thrown HttpsError is not logged.
    logger.error('planProblemSet failed', { slotCount: slots.length, error: (e as Error).message });
    throw new HttpsError('internal', `planning failed: ${(e as Error).message}`);
  }
});

// Stage 2 callable. Realizes one planned description into a verified problem: a
// generator subagent writes it, an independent verifier subagent must agree by a
// majority of its re-solves, and the structural gate must pass (up to 4 attempts).
// On success the syn: key is
// persisted and PUBLIC fields plus the planned title and the surviving target node
// ids are returned (answers and rubric stay server side). Break-loud: after the
// attempts it throws (logged), and no template or authored problem is ever
// substituted for a generated slot. The live OpenAI path is exercised only on
// deploy.
// timeoutSeconds is generous because generation uses a reasoning model
// (SYNTHESIS_MODEL) and re-verifies with several independent re-solves; a single
// attempt runs roughly a minute and the loop retries, so the cap must cover a few
// attempts. The client callable timeout (see lib/grading) is raised to match.
export const generatePlannedProblem = onCall({ secrets: [OPENAI_API_KEY], timeoutSeconds: 300 }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');
  const {
    skillIds,
    principleIds,
    difficultyBand,
    requireChain,
    targetMisconceptions,
    pastPrincipleIds,
    description,
    title,
  } = request.data as PlannedProblemInput;
  if (!isStringArray(skillIds) || !isStringArray(principleIds) || typeof difficultyBand !== 'number') {
    throw new HttpsError('invalid-argument', 'skillIds, principleIds, difficultyBand required');
  }
  if (typeof requireChain !== 'boolean') {
    throw new HttpsError('invalid-argument', 'requireChain must be a boolean');
  }
  if (!isTargetMisconceptionArray(targetMisconceptions)) {
    throw new HttpsError('invalid-argument', 'targetMisconceptions must be an array of { nodeId, principleId, wrongBelief }');
  }
  if (pastPrincipleIds !== undefined && !isStringArray(pastPrincipleIds)) {
    throw new HttpsError('invalid-argument', 'pastPrincipleIds must be an array of strings');
  }
  if (typeof description !== 'string' || description.trim().length === 0) {
    throw new HttpsError('invalid-argument', 'description must be a non-empty string');
  }
  if (typeof title !== 'string' || title.trim().length === 0) {
    throw new HttpsError('invalid-argument', 'title must be a non-empty string');
  }
  let candidate;
  try {
    candidate = await synthesizePlannedProblem({
      skillIds,
      principleIds,
      difficultyBand,
      requireChain,
      targetMisconceptions,
      pastPrincipleIds,
      description,
      title,
      apiKey: OPENAI_API_KEY.value(),
    });
  } catch (e) {
    // Log the underlying cause (e.g. "synthesis verification failed: independent
    // re-solve disagreed...") so the real reason the slot failed is visible in the
    // logs; a thrown HttpsError alone is not logged.
    logger.error('generatePlannedProblem failed', {
      skillIds,
      principleIds,
      difficultyBand,
      requireChain,
      targetCount: targetMisconceptions.length,
      error: (e as Error).message,
    });
    throw new HttpsError('internal', `planned generation failed: ${(e as Error).message}`);
  }
  try {
    await saveSynthesisProblem(toProblemKey(candidate));
  } catch (e) {
    logger.error('persisting planned problem failed', {
      problemId: candidate.problemId,
      error: (e as Error).message,
    });
    throw new HttpsError('internal', `persisting planned problem failed: ${(e as Error).message}`);
  }
  return {
    problemId: candidate.problemId,
    statement: candidate.statement,
    title: candidate.title,
    skillIds: candidate.skillIds,
    principleIds: candidate.principleIds,
    misconceptionTags: candidate.misconceptionTags,
    difficultyBand: candidate.difficultyBand,
    targetMisconceptionNodeIds: candidate.flaws
      .map((f) => f.misconceptionId)
      .filter((id) => targetMisconceptions.some((t) => t.nodeId === id)),
  };
});
