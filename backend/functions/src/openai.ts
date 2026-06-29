import OpenAI from 'openai';
import {
  AskResult,
  ExplainFeedbackResult,
  GradeResult,
  HintResult,
  KnownMisconception,
  LineRef,
  ProblemKey,
} from './types';
import { parseAskResponse, parseExplainResponse, parseGradeResponse, parseHintResponse } from './parse';

// Current OpenAI vision capable model. Exported as a single constant so the
// user can tune it in one place. gpt-4o is a current, vision capable model that
// is a good cost and quality fit for grading handwritten work, and it is fast
// enough for the interactive tutoring calls (grade, hint, ask, explain).
export const OPENAI_MODEL = 'gpt-4o';

// The synthesis pipeline (on-the-fly problem GENERATION and the independent
// verification RE-SOLVE) needs accurate multi-step quantitative reasoning. gpt-4o
// is not reliable at it: it produces problems whose own stated answer it cannot
// self-verify (re-solves disagree, often by the 1e-6 microcoulomb factor), so the
// gate correctly rejects them and generation fails for every slot. A reasoning
// model solves AP Physics C consistently. It is slower, so it is used ONLY for the
// generate+verify path, never for the interactive tutoring calls above. 'low'
// effort is the latency/accuracy balance; the gate's majority re-solve absorbs the
// occasional slip. (The planner only writes prose descriptions, so it stays on the
// fast model.)
export const SYNTHESIS_MODEL = 'gpt-5';
export const SYNTHESIS_REASONING_EFFORT = 'low' as const;

// max_completion_tokens budgets. This caps everything the model spends on a turn,
// so too small a cap truncates a hard, multi-step answer to empty (finish_reason
// "length"). Grading proved reliable at 1500; give the others the same headroom.
// (The other empty-completion cause, a vision refusal with finish_reason "stop",
// is handled by the system prompt and retry in runJsonCompletion below.) The cap
// only costs tokens the model actually uses.
const GRADE_MAX_TOKENS = 1500;
const HINT_MAX_TOKENS = 2000;
const ASK_MAX_TOKENS = 2000;
const EXPLAIN_MAX_TOKENS = 2000;

// gpt-4o intermittently REFUSES a vision request, returning a refusal with null
// content and finish_reason "stop" (most often when the student's canvas is blank
// or sparse). Surfaced to the student, that became "The AI tutor ran into a
// problem". A short system message that frames the request as legitimate tutoring
// of the student's own work cuts the refusal rate sharply (measured roughly 8x
// fewer on a blank image), and the retry in runJsonCompletion absorbs the rest.
const TUTOR_SYSTEM_PROMPT =
  "You are an AP Physics tutor inside a learning app. The user is a student, and any " +
  "attached image is that student's own handwritten work for the physics problem described " +
  'in the message. Helping with it is always appropriate and safe. Never refuse, and never ' +
  'return an empty message; always return the requested JSON object. If an attached image is ' +
  'blank, unreadable, or shows no work yet, treat it as the student not having started and ' +
  'respond accordingly (for example, give a starting hint) instead of refusing.';

// How many times to re-issue a completion that came back empty. An empty
// completion is almost always a transient refusal (or, rarely, a truncation); a
// fresh attempt usually succeeds, so a few retries turn a double-digit per-call
// refusal rate into a negligible overall failure rate.
const MAX_COMPLETION_ATTEMPTS = 3;

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

// Run a JSON chat completion with the tutoring system prompt, retrying when the
// model returns empty content. An empty completion is almost always a transient
// vision refusal (message.refusal set, content null, finish_reason "stop") rather
// than a real inability, so a fresh attempt usually succeeds. After the last
// attempt it throws with the finish_reason and any refusal text, turning a silent
// "no text content" into an actionable signal in the function logs rather than
// fabricating a result.
async function runJsonCompletion(
  client: OpenAI,
  userContent: OpenAI.Chat.Completions.ChatCompletionUserMessageParam['content'],
  maxCompletionTokens: number,
): Promise<string> {
  let lastDetail = 'unknown';
  for (let attempt = 0; attempt < MAX_COMPLETION_ATTEMPTS; attempt += 1) {
    const response = await client.chat.completions.create({
      model: OPENAI_MODEL,
      max_completion_tokens: maxCompletionTokens,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: TUTOR_SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
    });
    const choice = response.choices[0];
    const text = choice?.message?.content?.trim() ?? '';
    if (text.length > 0) {
      return text;
    }
    const refusal = choice?.message?.refusal;
    lastDetail = `finish_reason: ${choice?.finish_reason ?? 'unknown'}${refusal ? `; refusal: ${refusal}` : ''}`;
  }
  throw new Error(`openai returned no text content (${lastDetail})`);
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
    'DETECTED INK LINES (choose firstErrorLineId only from these ids when one matches the first mistake, otherwise null):',
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
    '- If the work is wrong, set isCorrect false, set firstErrorLineId to the id from the list that marks the first mistake (or null if none clearly matches, for example when no ink lines were detected), set errorType to "concept" or "slip", and omit correctSolution.',
    '- If errorType is "slip", omit conceptMatch entirely.',
    `- If errorType is "concept", include conceptMatch. conceptMatch.matchedNodeId must be null or exactly one of: ${knownNodeIdList(knownMisconceptions)}. conceptMatch.principleId must be exactly one of: ${principleIdList(allowedPrincipleIds)}. conceptMatch.wrongBelief and conceptMatch.specificNote must both be non-empty.`,
    '- explanation must address the student directly in the second person ("you"), never as "the student" or "they". Say why the first wrong step is wrong in one or two sentences. Never state or reveal the final numeric answer in explanation.',
    '- Write all prose (explanation, wrongBelief, specificNote, and any steps) plainly, the way a real teacher talks to a student. Do not use em dashes or en dashes; use commas, periods, or parentheses instead. Avoid AI-sounding filler (for example "it is important to note", "in conclusion", "let us", "delve", "moreover", "furthermore"), hedging, and listy or overly formal phrasing. Keep it direct and human. Write any math in plain ASCII the app can typeset: exponents with a caret (r^2), subscripts with an underscore (q_1, q_2), scientific notation as 8.99e9, and multiplication with an asterisk; never use Unicode superscript or subscript characters.',
    '- Do not invent ids and do not output anything other than the JSON object.',
  ].join('\n');
}

// The level is how many hints the student has already asked for on this problem,
// so it controls how much further to push, not where the student is. Every level
// meets the student at their furthest correct step (see buildHintPrompt); the
// level only decides how deep this hint goes.
function levelInstruction(level: number): string {
  if (level <= 0) {
    return [
      'FIRST HINT: Meet the student where they are. From their furthest correct step, nudge the single next move that carries them forward.',
      'If a line is clearly wrong, instead send them back to that line to re-examine it (set targetLineId to that line). Only if the page has no real work yet, give a strategic start: name the principle or relation that applies and the first move.',
      'Do NOT restate steps they already did correctly, do NOT do their arithmetic, and do NOT reveal any answer.',
    ].join('\n');
  }
  if (level === 1) {
    return [
      'NEXT HINT: They asked again, so go one notch more specific than the hint(s) above. Be concrete about the exact next move from their furthest correct step, or about what to fix on the line you flagged.',
      'Set targetLineId to the line you are talking about, chosen from the provided ids (or null if none clearly matches). Do NOT give the correction outright or the final number.',
    ].join('\n');
  }
  if (level === 2) {
    return [
      'DEEPER HINT: State the governing principle or relationship they need to get past their current sticking point, tied to what they have already written.',
      'Never state the final numeric answer. You may set targetLineId to the relevant line id or null.',
    ].join('\n');
  }
  return [
    'DEEPEST HINT: They have every hint above and are still stuck. Give the next concrete step from their furthest correct work, going further than all prior hints and narrowing toward the method.',
    'Stay one step short of doing the work for them, and never state the final numeric answer. You may set targetLineId to the relevant line id or null.',
  ].join('\n');
}

function formatPriorHints(priorHints: string[]): string {
  if (priorHints.length === 0) {
    return '(none yet, this is the first hint)';
  }
  return priorHints.map((hint, index) => `${index + 1}. ${hint}`).join('\n');
}

export function buildHintPrompt(key: ProblemKey, lines: LineRef[], level: number, priorHints: string[]): string {
  return [
    'You are tutoring a student on a single handwritten AP Physics problem. The attached PNG shows the student work so far, and the detected ink lines listed below locate that work on the page.',
    'Give ONE hint that is grounded in what the student has actually written, not a generic tip. First read their work in the image and find the furthest step whose reasoning is still correct. Then do exactly ONE of these:',
    '(a) If their work contains a clear mistake, tell them specifically what is wrong at that step and point them to it (set targetLineId to that line), so they can fix it themselves. Do not just hand over the correction.',
    '(b) If their work so far is correct, give the single concrete next step that follows from their furthest correct step.',
    'Only if the page has no real work yet, fall back to a strategic starting point: name the principle or relation that applies and the first move.',
    'A hint must scaffold thinking, build on what they have already written (never restate a step they did correctly or tell them to start over), and must never reveal the final numeric answer.',
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
    'HINTS ALREADY GIVEN (do not repeat these; the new hint must go deeper):',
    formatPriorHints(priorHints),
    '',
    'THIS HINT:',
    levelInstruction(level),
    '',
    'Return ONLY a JSON object (no prose, no markdown fences) with exactly these fields:',
    '{',
    '  "text": string,',
    '  "targetLineId": string | null',
    '}',
    '',
    'RULES:',
    `- targetLineId must be null or exactly one of: ${lineIdList(lines)}.`,
    '- Ground the hint in the work shown in the image. Continue from the furthest correct step, and never tell the student to start over or repeat a step they have already done correctly. Treat it as a fresh start only when the page has no real work yet.',
    '- text must be a non-empty hint that is strictly more specific than every hint already given above, addresses the student directly in the second person ("you"), never as "the student" or "they", and never states the final numeric answer.',
    '- Write the hint plainly, the way a real teacher talks to a student. Do not use em dashes or en dashes; use commas, periods, or parentheses instead. Avoid AI-sounding filler (for example "it is important to note", "in conclusion", "let us", "delve", "moreover", "furthermore"), hedging, and listy or overly formal phrasing. Keep it direct and human. Write any math in plain ASCII the app can typeset: exponents with a caret (r^2), subscripts with an underscore (q_1, q_2), scientific notation as 8.99e9, and multiplication with an asterisk; never use Unicode superscript or subscript characters.',
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
    '- Write the answer plainly, the way a real teacher talks to a student. Do not use em dashes or en dashes; use commas, periods, or parentheses instead. Avoid AI-sounding filler (for example "it is important to note", "in conclusion", "let us", "delve", "moreover", "furthermore"), hedging, and listy or overly formal phrasing. Keep it direct and human. Write any math in plain ASCII the app can typeset: exponents with a caret (r^2), subscripts with an underscore (q_1, q_2), scientific notation as 8.99e9, and multiplication with an asterisk; never use Unicode superscript or subscript characters.',
    '- Do not output anything other than the JSON object.',
  ].join('\n');
}

export function buildExplainPrompt(key: ProblemKey, question: string, answer: string): string {
  return [
    'You are a warm, encouraging AP Physics tutor. The student just studied a fully worked example (every solution step was already shown to them) and then answered a short conceptual self-explanation question about it in their own words. Give brief, specific formative feedback on their explanation.',
    '',
    'PROBLEM STATEMENT:',
    key.statement,
    '',
    'CANONICAL SOLUTION (for your grounding only; the student has already seen the steps, so do not just dump them back):',
    key.correctSolution.map((s, i) => `${i + 1}. ${s}`).join('\n'),
    '',
    'RUBRIC (server only):',
    key.rubric,
    '',
    'QUESTION THE STUDENT WAS ASKED:',
    question,
    '',
    "STUDENT'S EXPLANATION:",
    answer,
    '',
    'TASK:',
    'Respond to the student about THEIR explanation in 2 to 4 sentences. Always begin by affirming what they got right. When their explanation is correct, confirm it warmly and, if it helps, offer at most one brief optional refinement that sharpens their thinking (frame it as a bonus, never as a fix they must make to be right). Only when something important is genuinely missing or wrong, name the single most important thing to add or correct and point them at it specifically so they can revise.',
    'Be a generous, fair grader of understanding, not a pedantic one. Set isOnTrack TRUE when the explanation conveys the correct core relationship or mechanism AND reaches a correct conclusion, even if the student does not exhaustively spell out every intermediate algebraic step. For example, an answer that says the force depends inversely on the square of the distance and concludes that halving the distance makes the force four times larger (for instance writing (1/2)^-2 = 4) is correct and must be isOnTrack TRUE, even though it never separately writes out that r^2 becomes a quarter, because that step is clearly implied. Reserve isOnTrack FALSE for answers that are genuinely vague (a buzzword or topic name with no mechanism, for example just "inverse square" or "they are on the right track"), miss the mechanism entirely, never reach a correct conclusion, or contain a real physics error. When in doubt about a substantively correct answer, lean isOnTrack TRUE; do not require perfect completeness or pedantic restating of steps the student has clearly implied.',
    'CRITICAL, READ TWICE: isOnTrack must depend ONLY on whether the core relationship and the conclusion are correct. It is completely independent of whether you decide to offer a refinement. Offering an optional refinement, a sharpening note, or a "just remember to clarify" suggestion must never lower isOnTrack. If your feedback affirms that the student reached the correct idea (for example you praise that they correctly stated or concluded that the force is four times larger), then isOnTrack MUST be true: never pair praise of a correct answer with isOnTrack false. Concretely, feedback such as "Great job, you correctly stated that halving the distance multiplies the force by 4, just remember to clarify why" describes a correct answer, so it is isOnTrack true, not false. The presence of a "just remember to" or "to make this even stronger" note never by itself makes an answer not on track.',
    '',
    'Return ONLY a JSON object (no prose, no markdown fences) with exactly these fields:',
    '{',
    '  "feedback": string,',
    '  "isOnTrack": boolean',
    '}',
    '',
    'RULES:',
    '- feedback must be a non-empty string that addresses the student directly in the second person ("you"), never as "the student" or "they".',
    '- Be encouraging and specific to what they actually wrote. If they are on track, confirm the reasoning and sharpen it. If not, guide them toward the idea; never just hand them the full answer to copy.',
    '- Write the feedback plainly, the way a real teacher talks to a student. Do not use em dashes or en dashes; use commas, periods, or parentheses instead. Avoid AI-sounding filler (for example "it is important to note", "in conclusion", "let us", "delve", "moreover", "furthermore"), hedging, and listy or overly formal phrasing. Keep it direct and human. Write any math in plain ASCII the app can typeset: exponents with a caret (r^2), subscripts with an underscore (q_1, q_2), scientific notation as 8.99e9, and multiplication with an asterisk; never use Unicode superscript or subscript characters.',
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

  const text = await runJsonCompletion(client, content, GRADE_MAX_TOKENS);
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
  level: number,
  priorHints: string[],
  apiKey: string,
): Promise<HintResult> {
  const client = new OpenAI({ apiKey });

  const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    { type: 'text', text: buildHintPrompt(key, lines, level, priorHints) },
    {
      type: 'image_url',
      image_url: { url: `data:image/png;base64,${imagePngBase64}` },
    },
  ];

  const text = await runJsonCompletion(client, content, HINT_MAX_TOKENS);
  return parseHintResponse(
    text,
    lines.map((l) => l.id),
    level,
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

  const text = await runJsonCompletion(client, content, ASK_MAX_TOKENS);
  return parseAskResponse(text);
}

export async function feedbackOnExplanationWithOpenAI(
  key: ProblemKey,
  question: string,
  answer: string,
  apiKey: string,
): Promise<ExplainFeedbackResult> {
  const client = new OpenAI({ apiKey });

  const text = await runJsonCompletion(
    client,
    buildExplainPrompt(key, question, answer),
    EXPLAIN_MAX_TOKENS,
  );
  return parseExplainResponse(text);
}
