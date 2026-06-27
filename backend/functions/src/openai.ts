import OpenAI from 'openai';
import { AskResult, GradeResult, HintResult, KnownMisconception, LineRef, ProblemKey } from './types';
import { parseAskResponse, parseGradeResponse, parseHintResponse } from './parse';

// Current OpenAI vision capable model. Exported as a single constant so the
// user can tune it in one place. gpt-4o is a current, vision capable model that
// is a good cost and quality fit for grading handwritten work.
export const OPENAI_MODEL = 'gpt-4o';

const GRADE_MAX_TOKENS = 1500;
const HINT_MAX_TOKENS = 800;
const ASK_MAX_TOKENS = 800;

function formatLines(lines: LineRef[]): string {
  if (lines.length === 0) {
    return '(no ink lines were detected)';
  }
  return lines
    .map((l) => `- ${l.id}: bbox x=${l.bbox.x}, y=${l.bbox.y}, w=${l.bbox.w}, h=${l.bbox.h}`)
    .join('\n');
}

function formatFlaws(key: ProblemKey): string {
  return key.flaws
    .map((f) => `- ${f.misconceptionId}: ${f.signature}`)
    .join('\n');
}

function lineIdList(lines: LineRef[]): string {
  return lines.length === 0 ? '(none)' : lines.map((l) => l.id).join(', ');
}

function formatKnownMisconceptions(knownMisconceptions: KnownMisconception[]): string {
  if (knownMisconceptions.length === 0) {
    return '(this student has no known misconceptions yet; any conceptual error is a new proposal)';
  }
  return knownMisconceptions
    .map((m) => `- ${m.id} (principle ${m.principleId}): ${m.wrongBelief}`)
    .join('\n');
}

function knownNodeIdList(knownMisconceptions: KnownMisconception[]): string {
  return knownMisconceptions.length === 0 ? '(none)' : knownMisconceptions.map((m) => m.id).join(', ');
}

function principleIdList(allowedPrincipleIds: string[]): string {
  return allowedPrincipleIds.length === 0 ? '(none)' : allowedPrincipleIds.join(', ');
}

// Pull the text out of a chat completion. Throws if the model returned no usable
// text, rather than fabricating a result.
function collectText(response: OpenAI.Chat.Completions.ChatCompletion): string {
  const text = response.choices[0]?.message?.content?.trim() ?? '';
  if (text.length === 0) {
    throw new Error('openai returned no text content');
  }
  return text;
}

function buildGradePrompt(
  key: ProblemKey,
  lines: LineRef[],
  knownMisconceptions: KnownMisconception[],
  allowedPrincipleIds: string[],
): string {
  return [
    'You are grading a single handwritten AP Physics solution. The attached PNG shows the student work.',
    '',
    'PROBLEM STATEMENT:',
    key.statement,
    '',
    'CORRECT SOLUTION (server only, never quote the final number back to the student):',
    key.correctSolution.map((s, i) => `${i + 1}. ${s}`).join('\n'),
    '',
    'RUBRIC:',
    key.rubric,
    '',
    "THIS STUDENT'S KNOWN MISCONCEPTIONS (each item is { id, principleId, wrongBelief }):",
    formatKnownMisconceptions(knownMisconceptions),
    '',
    'ALLOWED PRINCIPLE IDS (a new proposed wrongBelief must use one of these principle ids):',
    principleIdList(allowedPrincipleIds),
    '',
    'DETECTED INK LINES (choose firstErrorLineId only from these ids, matching the region of the first mistake):',
    formatLines(lines),
    '',
    'TASK:',
    'Transcribe the handwritten steps in order and decide whether the reasoning is correct.',
    'If it is wrong, identify the first line where the reasoning breaks, then classify the mistake with errorType:',
    '- "slip": a careless, arithmetic, or transcription mistake, not a wrong mental model.',
    '- "concept": a genuine wrong mental model about the physics.',
    'If errorType is "concept", compare the underlying mistake to the known misconceptions listed above.',
    'If it is the same underlying mistake as one of them, set conceptMatch.matchedNodeId to that id.',
    'Otherwise set conceptMatch.matchedNodeId to null and propose a new signature: a principleId chosen from the allowed principle ids, plus a generalized one-sentence wrongBelief that states the mistaken belief with no instance numbers or problem-specific values.',
    'Always include a short specificNote that describes the concrete error in this particular work.',
    '',
    'Return ONLY a JSON object (no prose, no markdown fences) with exactly these fields:',
    '{',
    '  "isCorrect": boolean,',
    '  "transcribedSteps": string[],',
    '  "firstErrorLineId": string | null,',
    '  "explanation": string,',
    '  "correctSolution": string[],',
    '  "errorType": "concept" | "slip",',
    '  "conceptMatch": { "matchedNodeId": string | null, "principleId": string, "wrongBelief": string, "specificNote": string }',
    '}',
    '',
    'RULES:',
    `- firstErrorLineId must be null or exactly one of: ${lineIdList(lines)}.`,
    '- Do not mark work wrong for rounding, significant figures, or constant precision. Treat the Coulomb constant k = 9e9 and k = 8.99e9 (and other reasonably rounded constants), sensible intermediate rounding, and a final value within about 2 percent of the correct one as equivalent and correct. Only flag a genuine conceptual or arithmetic error, never a rounding or precision difference.',
    '- If the work is fully correct, set isCorrect true and firstErrorLineId null, include correctSolution as the concise correct steps, and omit errorType and conceptMatch.',
    '- If the work is wrong, set isCorrect false, provide a non-null firstErrorLineId from the ids above, set errorType to "concept" or "slip", and omit correctSolution.',
    '- If errorType is "slip", omit conceptMatch entirely.',
    `- If errorType is "concept", include conceptMatch. conceptMatch.matchedNodeId must be null or exactly one of: ${knownNodeIdList(knownMisconceptions)}. conceptMatch.principleId must be exactly one of: ${principleIdList(allowedPrincipleIds)}. conceptMatch.wrongBelief and conceptMatch.specificNote must both be non-empty.`,
    '- explanation must address the student directly in the second person ("you"), never as "the student" or "they". Say why the first wrong step is wrong in one or two sentences. Never state or reveal the final numeric answer in explanation.',
    '- Write all prose (explanation, wrongBelief, specificNote, and any steps) plainly, the way a real teacher talks to a student. Do not use em dashes or en dashes; use commas, periods, or parentheses instead. Avoid AI-sounding filler (for example "it is important to note", "in conclusion", "let us", "delve", "moreover", "furthermore"), hedging, and listy or overly formal phrasing. Keep it direct and human.',
    '- Do not invent ids and do not output anything other than the JSON object.',
  ].join('\n');
}

function tierInstruction(tier: 0 | 1 | 2): string {
  if (tier === 0) {
    return [
      'TIER 0 (strategic start): Help the student figure out how to even begin. Categorize the problem (which physical principle or relation applies) and suggest the first move.',
      'Do NOT solve the problem, do NOT do arithmetic, and do NOT reveal any answer. Set targetLineId to null.',
    ].join('\n');
  }
  if (tier === 1) {
    return [
      'TIER 1 (locate the error): Point the student at the region of their first mistake without revealing the fix.',
      'Set targetLineId to the id of the line where the first error appears, chosen from the provided ids. Describe what to re-examine there, but do NOT give the correction or the final number.',
    ].join('\n');
  }
  return [
    'TIER 2 (reveal the principle): State the governing principle or relationship the student should apply to get past the difficulty.',
    'Never state the final numeric answer. You may set targetLineId to the relevant line id or null.',
  ].join('\n');
}

function buildHintPrompt(key: ProblemKey, lines: LineRef[], tier: 0 | 1 | 2): string {
  return [
    'You are tutoring a student on a single handwritten AP Physics problem. The attached PNG shows the student work so far.',
    'Give ONE hint at the requested tier. Hints must scaffold thinking and must never reveal the final numeric answer.',
    '',
    'PROBLEM STATEMENT:',
    key.statement,
    '',
    'CORRECT SOLUTION (server only, never quote the final number back to the student):',
    key.correctSolution.map((s, i) => `${i + 1}. ${s}`).join('\n'),
    '',
    'RUBRIC:',
    key.rubric,
    '',
    'KNOWN MISCONCEPTIONS:',
    formatFlaws(key),
    '',
    'DETECTED INK LINES (choose targetLineId only from these ids):',
    formatLines(lines),
    '',
    'HINT TIER:',
    tierInstruction(tier),
    '',
    'Return ONLY a JSON object (no prose, no markdown fences) with exactly these fields:',
    '{',
    `  "tier": ${tier},`,
    '  "text": string,',
    '  "targetLineId": string | null',
    '}',
    '',
    'RULES:',
    `- tier must be ${tier}.`,
    `- targetLineId must be null or exactly one of: ${lineIdList(lines)}.`,
    '- text must be a non-empty hint that addresses the student directly in the second person ("you"), never as "the student" or "they", and never states the final numeric answer.',
    '- Write the hint plainly, the way a real teacher talks to a student. Do not use em dashes or en dashes; use commas, periods, or parentheses instead. Avoid AI-sounding filler (for example "it is important to note", "in conclusion", "let us", "delve", "moreover", "furthermore"), hedging, and listy or overly formal phrasing. Keep it direct and human.',
    '- Do not output anything other than the JSON object.',
  ].join('\n');
}

function buildAskPrompt(key: ProblemKey, lines: LineRef[], question: string): string {
  return [
    'You are tutoring a student on a single handwritten AP Physics problem. The attached PNG shows the student work so far.',
    'Answer the student QUESTION helpfully and Socratically, grounded in the problem and the attached work image. You must never reveal the final numeric answer.',
    '',
    'PROBLEM STATEMENT:',
    key.statement,
    '',
    'CORRECT SOLUTION (server only, NEVER reveal or quote the final numeric answer to the student):',
    key.correctSolution.map((s, i) => `${i + 1}. ${s}`).join('\n'),
    '',
    'RUBRIC (server only, never reveal to the student):',
    key.rubric,
    '',
    'DETECTED INK LINES:',
    formatLines(lines),
    '',
    'STUDENT QUESTION:',
    question,
    '',
    'TASK:',
    'Answer the student question helpfully and Socratically, grounded in the problem and the attached work image, in 2 to 4 sentences. If the student asks directly for the answer, do not give it: nudge their thinking instead.',
    '',
    'Return ONLY a JSON object (no prose, no markdown fences) with exactly this field:',
    '{',
    '  "answer": string',
    '}',
    '',
    'RULES:',
    '- answer must be a non-empty string that addresses the student directly in the second person ("you"), never as "the student" or "they".',
    '- Never state or compute the final numeric answer, and never reveal the server-only correct solution or rubric.',
    '- Write the answer plainly, the way a real teacher talks to a student. Do not use em dashes or en dashes; use commas, periods, or parentheses instead. Avoid AI-sounding filler (for example "it is important to note", "in conclusion", "let us", "delve", "moreover", "furthermore"), hedging, and listy or overly formal phrasing. Keep it direct and human.',
    '- Do not output anything other than the JSON object.',
  ].join('\n');
}

export async function gradeWithOpenAI(
  key: ProblemKey,
  imagePngBase64: string,
  lines: LineRef[],
  knownMisconceptions: KnownMisconception[],
  allowedPrincipleIds: string[],
  apiKey: string,
): Promise<GradeResult> {
  const client = new OpenAI({ apiKey });

  const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    { type: 'text', text: buildGradePrompt(key, lines, knownMisconceptions, allowedPrincipleIds) },
    {
      type: 'image_url',
      image_url: { url: `data:image/png;base64,${imagePngBase64}` },
    },
  ];

  const response = await client.chat.completions.create({
    model: OPENAI_MODEL,
    max_completion_tokens: GRADE_MAX_TOKENS,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content }],
  });

  const text = collectText(response);
  return parseGradeResponse(
    text,
    lines.map((l) => l.id),
    allowedPrincipleIds,
    knownMisconceptions.map((k) => k.id),
  );
}

export async function hintWithOpenAI(
  key: ProblemKey,
  imagePngBase64: string,
  lines: LineRef[],
  tier: 0 | 1 | 2,
  apiKey: string,
): Promise<HintResult> {
  const client = new OpenAI({ apiKey });

  const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    { type: 'text', text: buildHintPrompt(key, lines, tier) },
    {
      type: 'image_url',
      image_url: { url: `data:image/png;base64,${imagePngBase64}` },
    },
  ];

  const response = await client.chat.completions.create({
    model: OPENAI_MODEL,
    max_completion_tokens: HINT_MAX_TOKENS,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content }],
  });

  const text = collectText(response);
  return parseHintResponse(
    text,
    lines.map((l) => l.id),
  );
}

export async function answerQuestionWithOpenAI(
  key: ProblemKey,
  imagePngBase64: string,
  lines: LineRef[],
  question: string,
  apiKey: string,
): Promise<AskResult> {
  const client = new OpenAI({ apiKey });

  const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    { type: 'text', text: buildAskPrompt(key, lines, question) },
    {
      type: 'image_url',
      image_url: { url: `data:image/png;base64,${imagePngBase64}` },
    },
  ];

  const response = await client.chat.completions.create({
    model: OPENAI_MODEL,
    max_completion_tokens: ASK_MAX_TOKENS,
    response_format: { type: 'json_object' },
    messages: [{ role: 'user', content }],
  });

  const text = collectText(response);
  return parseAskResponse(text);
}
