import OpenAI from 'openai';
import { createHash } from 'node:crypto';
import { OPENAI_MODEL, SYNTHESIS_MODEL, SYNTHESIS_REASONING_EFFORT } from './openai';
import { stripDashes } from './parse';
import { verifyProblem, type IndependentSolve } from './verifyProblem';
import type {
  SynthesisCandidate,
  SynthesisFlaw,
  ProblemKey,
  PlanProblemSetInput,
  ProblemPlan,
  PlannedProblemInput,
  TargetMisconception,
} from './types';

// SYNTHESIS_MODEL is a reasoning model: it spends hidden reasoning tokens on top
// of its visible output, all counted against max_completion_tokens. So these
// budgets are generous, otherwise the model burns the whole budget reasoning and
// returns empty (finish_reason "length"). Observed usage at 'low' effort is about
// 2.5-3k for a generation and 2-3k per re-solve; 8000 leaves ample headroom and
// only costs the tokens actually used.
const SYNTHESIS_MAX_TOKENS = 8000;
const SOLVE_MAX_TOKENS = 8000;
// Stage 1 planner output is short (a title and a 1 to 2 sentence sketch per
// slot), so a modest budget covers a set of several slots.
const PLAN_MAX_TOKENS = 1500;
// How many times Stage 2 retries the generate+verify loop before giving up. Each
// attempt is an independent generation, so a few retries turn a modest
// per-attempt pass rate into a high overall success rate. After the last failure
// it throws: no fallback, no substitution.
const GENERATION_ATTEMPTS = 4;
// The planner is the dedup mechanism, so a malformed or non-distinct plan is
// retried once (a fresh call), then fails loudly. No plan is ever repaired.
const PLAN_ATTEMPTS = 2;

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
// shape violation and never coerces or defaults. The user-facing prose fields
// (statement, correctSolution, rubric) are returned dash-free via stripDashes,
// matching the explain/hint/ask/grade parsers; ids, enums, tags, numbers, the
// canonical finalAnswer quantity, and the internal misconception signatures are
// left untouched. problemId is hashed from the sanitized statement so the content
// addressed id matches the statement that is actually stored and shown.
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

  // Optional short display name. The scoped review prompt requests it; the other
  // prompts omit it, so it is optional and the caller falls back to a slot label.
  const titleRaw = obj.title;
  const title =
    typeof titleRaw === 'string' && titleRaw.trim().length > 0
      ? stripDashes(titleRaw.trim())
      : undefined;

  // Validate the raw model text above, then return dash-free prose. statement,
  // correctSolution, and rubric are shown to students, so they are sanitized; the
  // id, skill/principle/misconception identifiers, difficulty number, canonical
  // finalAnswer quantity, and the flaws' internal matching signatures stay as is.
  // The id is hashed from the sanitized statement to keep it content addressed.
  const cleanStatement = stripDashes(statement);

  return {
    problemId: 'syn:' + hashStatement(cleanStatement),
    statement: cleanStatement,
    title,
    skillIds,
    principleIds,
    misconceptionTags,
    difficultyBand,
    correctSolution: correctSolution.map((step) => stripDashes(step)),
    finalAnswer,
    rubric: stripDashes(rubric),
    flaws,
  };
}

// Strict extract and validate of a Stage 1 planner response into ProblemPlan[].
// The model returns a JSON object { "plans": [...] } (response_format json_object
// cannot return a bare array), tolerating fences and surrounding prose. Enforces
// the count, the shape of each entry, that every slot index in [0, expectedCount)
// is covered exactly once, and that the descriptions are mutually distinct (the
// planner's whole job is to guarantee distinct problems). Never repairs or
// defaults: any violation throws so a malformed plan fails loudly. Plans are
// returned sorted by slotIndex so a caller can zip them with its slots. Titles
// and descriptions are returned dash-free, matching the prose parsers.
export function parseProblemPlan(raw: string, expectedCount: number): ProblemPlan[] {
  const obj = extractJsonObject(raw);

  const plansRaw = obj.plans;
  if (!Array.isArray(plansRaw)) {
    throw new Error('plan validation: plans must be an array');
  }
  if (plansRaw.length !== expectedCount) {
    throw new Error(`plan validation: expected ${expectedCount} plans, got ${plansRaw.length}`);
  }

  const plans: ProblemPlan[] = plansRaw.map((entry, index) => {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new Error(`plan validation: plans[${index}] must be an object`);
    }
    const plan = entry as Record<string, unknown>;

    const slotIndex = plan.slotIndex;
    if (
      typeof slotIndex !== 'number'
      || !Number.isInteger(slotIndex)
      || slotIndex < 0
      || slotIndex >= expectedCount
    ) {
      throw new Error(
        `plan validation: plans[${index}].slotIndex must be an integer in [0, ${expectedCount})`,
      );
    }

    const title = plan.title;
    if (typeof title !== 'string' || title.trim().length === 0) {
      throw new Error(`plan validation: plans[${index}].title must be a non-empty string`);
    }

    const description = plan.description;
    if (typeof description !== 'string' || description.trim().length === 0) {
      throw new Error(`plan validation: plans[${index}].description must be a non-empty string`);
    }

    return {
      slotIndex,
      title: stripDashes(title.trim()),
      description: stripDashes(description.trim()),
    };
  });

  // Each slot must be planned exactly once: a duplicate or missing index would
  // leave a generated slot without a distinct description.
  const seen = new Set<number>();
  for (const plan of plans) {
    if (seen.has(plan.slotIndex)) {
      throw new Error(`plan validation: duplicate slotIndex ${plan.slotIndex}`);
    }
    seen.add(plan.slotIndex);
  }

  // Distinctness is the point of the planner. Compare descriptions normalized for
  // case and whitespace; if any two collide the plan is rejected (and retried by
  // planProblemSet) rather than producing two near-identical problems.
  const normalized = plans.map((plan) =>
    plan.description.toLowerCase().replace(/\s+/g, ' ').trim(),
  );
  if (new Set(normalized).size !== normalized.length) {
    throw new Error('plan validation: descriptions must be mutually distinct');
  }

  return plans.slice().sort((a, b) => a.slotIndex - b.slotIndex);
}

// Parse a raw model response, then run the verification gate. Throws on a gate
// failure and never returns an unverified problem.
export async function assembleVerifiedProblem(
  raw: string,
  solve: IndependentSolve,
  options: { requireChain?: boolean } = {},
): Promise<SynthesisCandidate> {
  const c = parseSynthesisResponse(raw);
  const v = await verifyProblem(c, solve, options);
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

// Stage 1 planner prompt. Frames the model as designing a SET: it proposes one
// distinct problem per slot, outputting only a short scenario sketch and a
// specific title (never the full problem or the answer). Distinctness across the
// set, and from the statements already in the set, is the primary instruction, so
// duplication is impossible by construction; a synthesis slot must genuinely chain
// its principles. The planner never assigns scope or misconceptions; those are
// listed only so each sketch fits its slot, and they pass to Stage 2 unchanged.
// Pure and deterministic given its input. Mirrors the JSON schema parseProblemPlan
// expects.
export function buildPlannerPrompt(input: PlanProblemSetInput): string {
  const slotLines = input.slots.flatMap((slot, index) => {
    const chains = slot.kind === 'synthesis' || slot.requireChain;
    const targets =
      slot.targetMisconceptions.length > 0
        ? slot.targetMisconceptions
            .map((t) => `"${t.wrongBelief}" (principle ${t.principleId})`)
            .join('; ')
        : '(none tracked yet)';
    return [
      `Slot ${index} [${slot.kind}, difficulty ${slot.difficultyBand}]: ${
        chains
          ? 'this problem MUST genuinely chain its principles across multiple steps.'
          : 'a single focused problem on its principle(s).'
      }`,
      `  Principles: ${slot.principleIds.join(', ') || '(none specified)'}`,
      `  Skills: ${slot.skillIds.join(', ') || '(none specified)'}`,
      `  Misconceptions to keep in mind: ${targets}`,
    ];
  });

  return [
    `You are designing a set of ${input.slots.length} AP Physics C problems for a student who is currently studying "${input.lessonTitle}".`,
    'The topic of each problem is defined ONLY by the Skills and Principles listed for its slot below. Those scopes are often from EARLIER lessons (this is a mixed review set), so do NOT make the problems about the current lesson unless a slot explicitly lists it. Generate each problem strictly within its own slot scope.',
    'Propose ONE distinct problem for each slot listed below. For each, output only a short scenario sketch and a specific title. Do NOT write the full problem, the solving steps, or the answer.',
    '',
    'Every problem in the set MUST differ from every other in physical scenario, the objects involved, the given quantities, and the quantity asked for. Avoid textbook cliches (do not reuse inclined planes) and vary the physical setup across the whole set.',
    ...(input.existingStatements.length > 0
      ? [
          '',
          'These problems are ALREADY IN THE SET. Every sketch you propose MUST be clearly different from all of them (a different scenario, objects, given numbers, and quantity to find):',
          ...input.existingStatements.map((statement, i) => `${i + 1}. ${statement}`),
        ]
      : []),
    '',
    'SLOTS:',
    ...slotLines,
    '',
    'Return ONLY a JSON object (no prose, no markdown fences) with exactly this shape:',
    '{',
    '  "plans": [',
    '    { "slotIndex": number, "title": string, "description": string }',
    '  ]',
    '}',
    '',
    'RULES:',
    `- Return exactly ${input.slots.length} plans, one per slot, using slotIndex 0 through ${input.slots.length - 1} (each slot index exactly once).`,
    '- description is a 1 to 2 sentence scenario sketch that fixes the concrete setup (the objects, their rough arrangement, and what is asked). Do NOT include the full problem text, the solving steps, or the final answer.',
    '- title is a short, specific name (about 4 to 8 words) describing the concrete setup, with no trailing punctuation and no generic words like "Review", "Practice", or "Problem".',
    '- Every description MUST be mutually distinct in scenario, objects, given quantities, and what is asked.',
    '- Each problem MUST stay strictly within its own slot Skills and Principles. When a slot lists earlier-lesson skills, the problem is about THAT earlier topic, not the current lesson.',
    '- A synthesis slot must chain its listed principles into a genuine multi-step scenario, not a single-formula problem.',
    '- Write all prose plainly. Do not use em dashes or en dashes; use commas, periods, or parentheses instead.',
    '- Output only the JSON object and nothing else.',
  ].join('\n');
}

// Stage 2 generator prompt. This is the scoped-synthesis prompt with the planned
// scenario and title injected: the model must realize EXACTLY the planned
// description (not invent a different setup) and use the planned title. It chains
// the in-scope principles (and any past-concept principles) and pins a flaw to
// each target misconception node, so a verified catch can be credited back to
// that node. With no targets it still requires one declared flaw, just unpinned,
// mirroring the gate. The final answer is never revealed in the statement. Pure
// and deterministic given its inputs. Mirrors the JSON schema
// parseSynthesisResponse expects.
export function buildPlannedProblemPrompt(params: {
  skillIds: string[];
  principleIds: string[];
  difficultyBand: number;
  targetMisconceptions: TargetMisconception[];
  pastPrincipleIds?: string[];
  requireChain?: boolean;
  description: string;
  title: string;
}): string {
  const pastPrincipleIds = params.pastPrincipleIds ?? [];
  // A synthesis slot must chain multiple principles; a single-topic slot must not
  // be forced into a contrived chain, which produced ambiguous problems the gate
  // could not verify.
  const requireChain = params.requireChain ?? true;
  const targetLines =
    params.targetMisconceptions.length > 0
      ? params.targetMisconceptions.map(
          (t) =>
            `- misconceptionId "${t.nodeId}" (principle ${t.principleId}): a student who believes "${t.wrongBelief}" must land on this flaw's wrongAnswer. Its signature is the wrong step that belief produces.`,
        )
      : ['- (no specific misconception targeted) declare at least one diagnosable flaw of your own choosing.'];

  return [
    requireChain
      ? 'You are composing ONE comprehensive AP Physics C problem for a tutoring system.'
      : 'You are composing ONE focused AP Physics C problem for a tutoring system.',
    requireChain
      ? 'Solving it must genuinely require chaining the listed principles in sequence across multiple steps, not just applying one of them.'
      : 'It should be a clear, well-posed problem on the listed principle(s) that reaches one unambiguous final answer.',
    '',
    'REALIZE EXACTLY THIS SCENARIO (write the full problem that this sketch describes; do not invent a different setup):',
    params.description,
    `USE THIS EXACT TITLE: ${params.title}`,
    '',
    `SKILLS TO EXERCISE: ${params.skillIds.join(', ') || '(none specified)'}`,
    requireChain
      ? `PRINCIPLES TO CHAIN (use at least these, in a real multi-step chain): ${params.principleIds.join(', ')}`
      : `PRINCIPLES TO EXERCISE: ${params.principleIds.join(', ')}`,
    ...(pastPrincipleIds.length > 0
      ? [`PAST CONCEPT PRINCIPLES TO CHAIN IN (carry these earlier ideas into the same problem): ${pastPrincipleIds.join(', ')}`]
      : []),
    `DIFFICULTY BAND (higher is harder): ${params.difficultyBand}`,
    '',
    'TARGET MISCONCEPTIONS (each one needs its own declared flaw):',
    ...targetLines,
    '',
    'Return ONLY a JSON object (no prose, no markdown fences) with exactly these fields:',
    '{',
    '  "title": string,',
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
    requireChain
      ? '- The problem must require at least two of the listed principles to reach the answer.'
      : '- The problem must be solvable using the listed principle(s) and reach one clear final answer.',
    `- The statement MUST realize the scenario sketch above, and the title MUST be exactly: ${params.title}.`,
    '- For EACH target misconception above, declare a flaw whose misconceptionId is EXACTLY the given id, whose signature is the wrong step that belief produces, and whose wrongAnswer is the distinct quantity that belief yields.',
    '- finalAnswer must be one canonical quantity with a unit, for example "2.25e6 N/C". Never state or reveal this final answer inside the statement; the student must solve for it.',
    '- Every wrongAnswer must be a parseable quantity that differs from finalAnswer, so each misconception is diagnosable from the answer alone.',
    '- correctSolution is the ordered list of correct steps. rubric explains how to award credit.',
    '- Write all prose plainly. Do not use em dashes or en dashes; use commas, periods, or parentheses instead.',
    '- Output only the JSON object and nothing else.',
  ].join('\n');
}

function buildSolvePrompt(statement: string): string {
  return [
    'Solve this AP Physics C problem independently and carefully. Work through it',
    'step by step so your arithmetic and reasoning are reliable.',
    '',
    'PROBLEM:',
    statement,
    '',
    'On the very last line, state your final result as a single canonical quantity',
    'with its unit, prefixed exactly with "FINAL: ", for example "FINAL: 2.25e6 N/C".',
    'That last line must contain only the prefix and the quantity.',
  ].join('\n');
}

// Pull the final answer out of an independent re-solve. The solver now reasons step
// by step and marks its result with a FINAL: prefix, so take the text after the
// last FINAL marker (or the last non-empty line if the model omitted it) rather
// than letting the quantity parser latch onto an intermediate number in the work.
export function extractFinalAnswer(text: string): string {
  // Strip the markdown and LaTeX an LLM wraps its answer in (for example
  // "**9.9 m/s**", "3.92 \, \text{m/s}^2", a stray leading "}"). Left in, these
  // corrupt the parsed value or unit so a correct answer wrongly "disagrees" with
  // the stated one and the gate rejects a valid problem.
  const clean = (value: string): string =>
    value
      .replace(/\\text\{([^}]*)\}/g, '$1')
      .replace(/\\[,;:!]/g, ' ')
      .replace(/\\[a-zA-Z]+/g, ' ')
      .replace(/[{}$`*\\]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const match = lines[i].match(/FINAL:\s*(.+)$/i);
    if (match) return clean(match[1]);
  }
  return clean(lines.length > 0 ? lines[lines.length - 1] : text);
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
    reasoning_effort: SYNTHESIS_REASONING_EFFORT,
    messages: [{ role: 'user', content: buildSolvePrompt(statement) }],
  });
  return extractFinalAnswer(collectText(response, 'the independent re-solve'));
}

// Stage 1: plan a distinct problem for every slot in the set. ONE OpenAI call
// returns a title and a short scenario sketch per slot (response_format
// json_object, parsed strictly by parseProblemPlan into ProblemPlan[] in
// slotIndex order). The planner is the dedup mechanism, so a malformed or
// non-distinct plan is retried once with a fresh call, then throws: a plan is
// never repaired and never substituted. The live OpenAI path is a boundary and is
// not unit tested.
export async function planProblemSet(
  input: PlanProblemSetInput,
  apiKey: string,
  model?: string,
): Promise<ProblemPlan[]> {
  const useModel = model ?? OPENAI_MODEL;
  const client = new OpenAI({ apiKey });
  const prompt = buildPlannerPrompt(input);

  // Up to PLAN_ATTEMPTS independent calls: a malformed or non-distinct plan (the
  // parse throws) is retried once, then the last error propagates. Break-loud.
  let lastError: unknown;
  for (let attempt = 0; attempt < PLAN_ATTEMPTS; attempt += 1) {
    try {
      const response = await client.chat.completions.create({
        model: useModel,
        max_completion_tokens: PLAN_MAX_TOKENS,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }],
      });
      const text = collectText(response, 'problem set plan');
      return parseProblemPlan(text, input.slots.length);
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('problem set planning failed');
}

// Stage 2: turn one planned description and its scope into a verified problem. Up
// to GENERATION_ATTEMPTS independent attempts of (generate via
// buildPlannedProblemPrompt, parse via parseSynthesisResponse, verify with
// majority-consensus independent re-solves that must agree). Returns the verified
// candidate carrying the planned title, so the problem the learner sees matches
// the persisted plan. Throws after the last attempt: no fallback, no
// substitution. The live OpenAI path is a boundary and is not unit tested.
export async function synthesizePlannedProblem(
  params: PlannedProblemInput & { apiKey: string; model?: string; attempts?: number },
): Promise<SynthesisCandidate> {
  const model = params.model ?? SYNTHESIS_MODEL;
  const attempts = Math.max(1, params.attempts ?? GENERATION_ATTEMPTS);
  const client = new OpenAI({ apiKey: params.apiKey });
  const solve: IndependentSolve = (statement) => openAiSolve(statement, client, model);
  const prompt = buildPlannedProblemPrompt(params);

  // Each attempt is an independent generate+verify; return the first that passes
  // the gate. The model is stochastic, so a candidate the gate rejects (or a flaky
  // verifier solve) is retried rather than failing the slot. The last error
  // propagates if every attempt fails.
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await client.chat.completions.create({
        model,
        max_completion_tokens: SYNTHESIS_MAX_TOKENS,
        reasoning_effort: SYNTHESIS_REASONING_EFFORT,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }],
      });
      const text = collectText(response, 'planned synthesis');
      const candidate = await assembleVerifiedProblem(text, solve, {
        requireChain: params.requireChain,
      });
      // Carry the planned title even if the model altered or omitted it, so the
      // displayed problem matches the plan that was persisted for resume.
      return { ...candidate, title: params.title };
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('planned synthesis failed');
}
