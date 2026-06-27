import OpenAI from 'openai';
import { createHash } from 'node:crypto';
import { OPENAI_MODEL } from './openai';
import { verifyProblem, type IndependentSolve } from './verifyProblem';
import type { SynthesisCandidate, SynthesisFlaw, ProblemKey } from './types';

const SYNTHESIS_MAX_TOKENS = 2000;
const SOLVE_MAX_TOKENS = 400;

// Short stable hex hash of a statement. Pure and deterministic: the same input
// always yields the same digest, and different inputs diverge. Used to give a
// synthesized problem a content addressed id.
export function hashStatement(statement: string): string {
  return createHash('sha256').update(statement).digest('hex').slice(0, 16);
}

// Locate a single JSON object inside arbitrary model text. The model is asked to
// return only JSON, but it can wrap the payload in code fences or surrounding
// prose, so we take the substring from the first opening brace to the last
// closing brace and parse that. Never repairs or guesses: malformed input throws.
function extractJsonObject(raw: string): Record<string, unknown> {
  if (typeof raw !== 'string') {
    throw new Error('synthesis parse error: model output is not a string');
  }
  const first = raw.indexOf('{');
  const last = raw.lastIndexOf('}');
  if (first === -1 || last === -1 || last < first) {
    throw new Error('synthesis parse error: no JSON object found in model output');
  }
  const slice = raw.slice(first, last + 1);
  let parsed: unknown;
  try {
    parsed = JSON.parse(slice);
  } catch (e) {
    throw new Error(`synthesis parse error: model output is not valid JSON (${(e as Error).message})`);
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('synthesis parse error: model output JSON is not an object');
  }
  return parsed as Record<string, unknown>;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function parseFlaws(value: unknown): SynthesisFlaw[] {
  if (!Array.isArray(value)) {
    throw new Error('synthesis validation: flaws must be an array');
  }
  return value.map((entry, index) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new Error(`synthesis validation: flaws[${index}] must be an object`);
    }
    const flaw = entry as Record<string, unknown>;
    if (typeof flaw.misconceptionId !== 'string') {
      throw new Error(`synthesis validation: flaws[${index}].misconceptionId must be a string`);
    }
    if (typeof flaw.signature !== 'string') {
      throw new Error(`synthesis validation: flaws[${index}].signature must be a string`);
    }
    if (typeof flaw.wrongAnswer !== 'string') {
      throw new Error(`synthesis validation: flaws[${index}].wrongAnswer must be a string`);
    }
    return {
      misconceptionId: flaw.misconceptionId,
      signature: flaw.signature,
      wrongAnswer: flaw.wrongAnswer,
    };
  });
}

// Strict extract and validate of a synthesis response into a SynthesisCandidate.
// Tolerates fences and surrounding prose. Throws with a clear message on any
// shape violation and never coerces or defaults. Sets problemId from a hash of
// the validated statement.
export function parseSynthesisResponse(raw: string): SynthesisCandidate {
  const obj = extractJsonObject(raw);

  const statement = obj.statement;
  if (typeof statement !== 'string' || statement.trim().length === 0) {
    throw new Error('synthesis validation: statement must be a non-empty string');
  }

  const correctSolution = obj.correctSolution;
  if (!isStringArray(correctSolution)) {
    throw new Error('synthesis validation: correctSolution must be an array of strings');
  }

  const finalAnswer = obj.finalAnswer;
  if (typeof finalAnswer !== 'string' || finalAnswer.trim().length === 0) {
    throw new Error('synthesis validation: finalAnswer must be a non-empty string');
  }

  const rubric = obj.rubric;
  if (typeof rubric !== 'string' || rubric.trim().length === 0) {
    throw new Error('synthesis validation: rubric must be a non-empty string');
  }

  const skillIds = obj.skillIds;
  if (!isStringArray(skillIds)) {
    throw new Error('synthesis validation: skillIds must be an array of strings');
  }

  const principleIds = obj.principleIds;
  if (!isStringArray(principleIds)) {
    throw new Error('synthesis validation: principleIds must be an array of strings');
  }

  const misconceptionTags = obj.misconceptionTags;
  if (!isStringArray(misconceptionTags)) {
    throw new Error('synthesis validation: misconceptionTags must be an array of strings');
  }

  const difficultyBand = obj.difficultyBand;
  if (typeof difficultyBand !== 'number' || !Number.isFinite(difficultyBand)) {
    throw new Error('synthesis validation: difficultyBand must be a finite number');
  }

  const flaws = parseFlaws(obj.flaws);

  return {
    problemId: 'syn:' + hashStatement(statement),
    statement,
    skillIds,
    principleIds,
    misconceptionTags,
    difficultyBand,
    correctSolution,
    finalAnswer,
    rubric,
    flaws,
  };
}

// Parse a raw model response, then run the verification gate. Throws on a gate
// failure and never returns an unverified problem.
export async function assembleVerifiedProblem(
  raw: string,
  solve: IndependentSolve,
): Promise<SynthesisCandidate> {
  const c = parseSynthesisResponse(raw);
  const v = await verifyProblem(c, solve);
  if (!v.ok) {
    throw new Error('synthesis verification failed: ' + v.reasons.join('; '));
  }
  return c;
}

// Map a verified candidate to the grader's ProblemKey. The flaws keep only the
// fields the grader needs, dropping wrongAnswer, which is internal to the gate.
export function toProblemKey(candidate: SynthesisCandidate): ProblemKey {
  return {
    problemId: candidate.problemId,
    statement: candidate.statement,
    correctSolution: candidate.correctSolution,
    finalAnswer: candidate.finalAnswer,
    rubric: candidate.rubric,
    flaws: candidate.flaws.map((flaw) => ({
      misconceptionId: flaw.misconceptionId,
      signature: flaw.signature,
    })),
  };
}

function buildSynthesisPrompt(params: {
  skillIds: string[];
  principleIds: string[];
  difficultyBand: number;
}): string {
  return [
    'You are composing ONE novel AP Physics C problem for a tutoring system.',
    'Solving it must genuinely require chaining the listed principles in sequence, not just applying one of them.',
    '',
    `SKILLS TO EXERCISE: ${params.skillIds.join(', ') || '(none specified)'}`,
    `PRINCIPLES TO CHAIN (use at least these, in a real multi-step chain): ${params.principleIds.join(', ')}`,
    `DIFFICULTY BAND (higher is harder): ${params.difficultyBand}`,
    '',
    'Return ONLY a JSON object (no prose, no markdown fences) with exactly these fields:',
    '{',
    '  "statement": string,',
    '  "skillIds": string[],',
    '  "principleIds": string[],',
    '  "misconceptionTags": string[],',
    '  "difficultyBand": number,',
    '  "correctSolution": string[],',
    '  "finalAnswer": string,',
    '  "rubric": string,',
    '  "flaws": [{ "misconceptionId": string, "signature": string, "wrongAnswer": string }]',
    '}',
    '',
    'RULES:',
    '- The problem must require at least two of the listed principles to reach the answer.',
    '- finalAnswer must be one canonical quantity with a unit, for example "2.25e6 N/C".',
    '- For each intended misconception, give its signature (the wrong step it produces) and the wrongAnswer that misconception yields. Every wrongAnswer must be a parseable quantity that differs from finalAnswer.',
    '- correctSolution is the ordered list of correct steps. rubric explains how to award credit.',
    '- Write all prose plainly. Do not use em dashes or en dashes; use commas, periods, or parentheses instead.',
    '- Output only the JSON object and nothing else.',
  ].join('\n');
}

// Compose a prompt aimed at one specific misconception. The model must invent a
// problem that a student who holds wrongBelief would get wrong, so the belief is
// diagnostic: at least one declared flaw must encode that exact belief and yield a
// distinct wrong answer. principleId must appear in principleIds, and the gate
// still requires a real multi-principle chain, so we ask for at least one more.
// Pure and deterministic given its inputs. The final answer is never revealed to
// the student; they must solve for it. Mirrors the JSON schema parseSynthesisResponse expects.
export function buildMisconceptionPrompt(params: {
  wrongBelief: string;
  principleId: string;
  difficultyBand: number;
}): string {
  return [
    'You are composing ONE novel AP Physics C problem for a tutoring system.',
    'The problem must diagnose a specific misconception: a student who holds the TARGET WRONG BELIEF below should arrive at a wrong answer, while a student who reasons correctly arrives at the right one. The misconception must change the final answer, not just an intermediate label.',
    '',
    `TARGET WRONG BELIEF (make this belief decide the answer): ${params.wrongBelief}`,
    `PRINCIPLE THE BELIEF CORRUPTS (must appear in principleIds): ${params.principleId}`,
    `DIFFICULTY BAND (higher is harder): ${params.difficultyBand}`,
    '',
    'Return ONLY a JSON object (no prose, no markdown fences) with exactly these fields:',
    '{',
    '  "statement": string,',
    '  "skillIds": string[],',
    '  "principleIds": string[],',
    '  "misconceptionTags": string[],',
    '  "difficultyBand": number,',
    '  "correctSolution": string[],',
    '  "finalAnswer": string,',
    '  "rubric": string,',
    '  "flaws": [{ "misconceptionId": string, "signature": string, "wrongAnswer": string }]',
    '}',
    '',
    'RULES:',
    `- principleIds MUST include "${params.principleId}", and MUST chain at least one further principle so reaching the answer genuinely requires multiple steps.`,
    '- At least one flaw MUST encode the TARGET WRONG BELIEF above: its signature is the wrong step that belief produces, and its wrongAnswer is the distinct quantity that belief yields.',
    '- finalAnswer must be one canonical quantity with a unit, for example "2.25e6 N/C". Never state or reveal this final answer inside the statement; the student must solve for it.',
    '- Every wrongAnswer must be a parseable quantity that differs from finalAnswer, so the misconception is diagnosable from the answer alone.',
    '- correctSolution is the ordered list of correct steps. rubric explains how to award credit.',
    '- Write all prose plainly. Do not use em dashes or en dashes; use commas, periods, or parentheses instead.',
    '- Output only the JSON object and nothing else.',
  ].join('\n');
}

function buildSolvePrompt(statement: string): string {
  return [
    'Solve this AP Physics C problem independently and carefully.',
    '',
    'PROBLEM:',
    statement,
    '',
    'Return ONLY the final answer as a single canonical quantity with its unit, for example "2.25e6 N/C". Output nothing else: no steps, no explanation, no JSON.',
  ].join('\n');
}

// Pull non-empty text out of a completion, or throw rather than fabricate.
function collectText(response: OpenAI.Chat.Completions.ChatCompletion, context: string): string {
  const text = response.choices[0]?.message?.content?.trim() ?? '';
  if (text.length === 0) {
    throw new Error(`openai returned no text content for ${context}`);
  }
  return text;
}

// A minimal second completion that returns only the final answer string, used as
// the independent re-solver inside the gate.
async function openAiSolve(statement: string, client: OpenAI, model: string): Promise<string> {
  const response = await client.chat.completions.create({
    model,
    max_completion_tokens: SOLVE_MAX_TOKENS,
    messages: [{ role: 'user', content: buildSolvePrompt(statement) }],
  });
  return collectText(response, 'the independent re-solve');
}

// Thin OpenAI wrapper: ask the model to compose one multi-principle problem,
// then re-solve it independently through the verification gate. Returns only a
// verified candidate; any error (no text, bad shape, gate failure) propagates.
// The live OpenAI path is a boundary and is not unit tested.
export async function synthesizeProblem(params: {
  skillIds: string[];
  principleIds: string[];
  difficultyBand: number;
  apiKey: string;
  model?: string;
}): Promise<SynthesisCandidate> {
  const model = params.model ?? OPENAI_MODEL;
  const client = new OpenAI({ apiKey: params.apiKey });

  const response = await client.chat.completions.create({
    model,
    max_completion_tokens: SYNTHESIS_MAX_TOKENS,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: buildSynthesisPrompt(params) }],
  });

  const text = collectText(response, 'synthesis');
  const solve: IndependentSolve = (statement) => openAiSolve(statement, client, model);
  return await assembleVerifiedProblem(text, solve);
}

// Misconception-targeted synthesis. Builds a prompt aimed at a specific wrong
// belief, asks the model to compose a problem that the belief gets wrong, then
// re-solves it independently through the same verification gate. Returns only a
// verified candidate; any error (no text, bad shape, gate failure) propagates so
// the caller never persists or returns an unverified problem. The live OpenAI
// path is a boundary and is not unit tested.
export async function synthesizeForMisconception(params: {
  wrongBelief: string;
  principleId: string;
  difficultyBand: number;
  apiKey: string;
  model?: string;
}): Promise<SynthesisCandidate> {
  const model = params.model ?? OPENAI_MODEL;
  const client = new OpenAI({ apiKey: params.apiKey });

  const response = await client.chat.completions.create({
    model,
    max_completion_tokens: SYNTHESIS_MAX_TOKENS,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content: buildMisconceptionPrompt(params) }],
  });

  const text = collectText(response, 'misconception synthesis');
  const solve: IndependentSolve = (statement) => openAiSolve(statement, client, model);
  return await assembleVerifiedProblem(text, solve);
}
