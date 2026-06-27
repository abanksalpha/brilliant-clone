import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { initializeApp } from 'firebase-admin/app';
import { AskInput, GradeInput, HintInput } from './types';
import { resolveProblemKey } from './keyResolver';
import { getSynthesisKey, saveSynthesisProblem } from './synthesisStore';
import { synthesizeProblem, synthesizeForMisconception, toProblemKey } from './synthesis';
import { answerQuestionWithOpenAI, gradeWithOpenAI, hintWithOpenAI } from './openai';
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
  } catch (e) {
    console.error('could not resolve problemId', JSON.stringify(problemId), (e as Error)?.message);
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
    throw new HttpsError('internal', `grading failed: ${(e as Error).message}`);
  }
});

export const getHint = onCall({ secrets: [OPENAI_API_KEY] }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');
  const { problemId, imagePngBase64, lines, tier } = request.data as HintInput;
  if (!problemId || !imagePngBase64 || !Array.isArray(lines)) {
    throw new HttpsError('invalid-argument', 'problemId, imagePngBase64, lines required');
  }
  if (tier !== 0 && tier !== 1 && tier !== 2) {
    throw new HttpsError('invalid-argument', 'tier must be 0, 1, or 2');
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
  } catch (e) {
    console.error('could not resolve problemId', JSON.stringify(problemId), (e as Error)?.message);
    throw new HttpsError('not-found', 'unknown problem');
  }
  try {
    return await hintWithOpenAI(key, imagePngBase64, validLines, tier, OPENAI_API_KEY.value());
  } catch (e) {
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
  } catch (e) {
    console.error('could not resolve problemId', JSON.stringify(problemId), (e as Error)?.message);
    throw new HttpsError('not-found', 'unknown problem');
  }
  try {
    return await answerQuestionWithOpenAI(key, imagePngBase64, validLines, question.trim(), OPENAI_API_KEY.value());
  } catch (e) {
    throw new HttpsError('internal', `question failed: ${(e as Error).message}`);
  }
});

export const generateSynthesisProblem = onCall({ secrets: [OPENAI_API_KEY] }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');
  const { skillIds, principleIds, difficultyBand } = request.data as {
    skillIds: string[]; principleIds: string[]; difficultyBand: number;
  };
  if (!Array.isArray(skillIds) || !Array.isArray(principleIds) || typeof difficultyBand !== 'number') {
    throw new HttpsError('invalid-argument', 'skillIds, principleIds, difficultyBand required');
  }
  let candidate;
  try {
    candidate = await synthesizeProblem({ skillIds, principleIds, difficultyBand, apiKey: OPENAI_API_KEY.value() });
  } catch (e) {
    throw new HttpsError('internal', `synthesis failed: ${(e as Error).message}`);
  }
  try {
    await saveSynthesisProblem(toProblemKey(candidate));
  } catch (e) {
    throw new HttpsError('internal', `persisting synthesis failed: ${(e as Error).message}`);
  }
  return {
    problemId: candidate.problemId,
    statement: candidate.statement,
    skillIds: candidate.skillIds,
    principleIds: candidate.principleIds,
    misconceptionTags: candidate.misconceptionTags,
    difficultyBand: candidate.difficultyBand,
  };
});

// Phase 3 (generate-to-target review). This is the server half of a producer that
// selects a student's weakest tracked nodes (selectReviewNodes), calls this
// generateReviewProblem callable per node, and feeds the results into
// ProblemPlayer. That producer is deploy-gated and not yet integrated on the
// client: wiring it requires a live deploy to verify the OpenAI synthesis path,
// so there is no caller in the app yet.
//
// Synthesize a verified practice problem aimed at one misconception node, persist
// it, and return PUBLIC fields plus the target node id. Throws on gate failure so
// an unverified or fabricated problem is never persisted or returned. Answers and
// rubric stay server side. The live OpenAI path is exercised only on deploy.
export const generateReviewProblem = onCall({ secrets: [OPENAI_API_KEY] }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');
  const { nodeId, wrongBelief, principleId, difficultyBand } = request.data as {
    nodeId: string; wrongBelief: string; principleId: string; difficultyBand: number;
  };
  if (typeof nodeId !== 'string' || !nodeId || typeof wrongBelief !== 'string' || !wrongBelief
      || typeof principleId !== 'string' || !principleId || typeof difficultyBand !== 'number') {
    throw new HttpsError('invalid-argument', 'nodeId, wrongBelief, principleId, difficultyBand required');
  }
  let candidate;
  try {
    candidate = await synthesizeForMisconception({ wrongBelief, principleId, difficultyBand, apiKey: OPENAI_API_KEY.value() });
  } catch (e) {
    throw new HttpsError('internal', `review generation failed: ${(e as Error).message}`);
  }
  try {
    await saveSynthesisProblem(toProblemKey(candidate));
  } catch (e) {
    throw new HttpsError('internal', `persisting review failed: ${(e as Error).message}`);
  }
  return {
    problemId: candidate.problemId,
    statement: candidate.statement,
    skillIds: candidate.skillIds,
    principleIds: candidate.principleIds,
    misconceptionTags: candidate.misconceptionTags,
    difficultyBand: candidate.difficultyBand,
    targetMisconceptionNodeId: nodeId,
  };
});
