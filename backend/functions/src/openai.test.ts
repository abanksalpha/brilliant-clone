import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LineRef, ProblemKey } from './types';

// The OpenAI client is the one network boundary in this module. Mock it so the
// hint path can be exercised offline (no API key, no live call), the same way
// the frontend tests mock their network seams. The mock records the exact
// request so a test can prove the student's work reaches the model.
const createMock = vi.hoisted(() => vi.fn());

vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = { completions: { create: createMock } };
    constructor(_config: { apiKey: string }) {}
  },
}));

import { answerQuestionWithOpenAI, buildExplainPrompt, buildHintPrompt, hintWithOpenAI } from './openai';

const key: ProblemKey = {
  problemId: 'p1',
  statement: 'A 3.0 microcoulomb charge sits 2.0 m from point P. Find the field at P.',
  correctSolution: ['E = k q / r^2', 'E = 6.74e3 N/C'],
  finalAnswer: '6.74e3 N/C',
  rubric: 'Credit the field setup and the substitution.',
  flaws: [{ misconceptionId: 'inverse-square-error', signature: 'divides by r not r^2' }],
};

const lines: LineRef[] = [
  { id: 'line-1', bbox: { x: 1, y: 2, w: 3, h: 4 } },
  { id: 'line-2', bbox: { x: 5, y: 6, w: 7, h: 8 } },
];

describe('buildHintPrompt', () => {
  it('grounds the hint in the student work: references the work image and lists the detected ink lines', () => {
    const prompt = buildHintPrompt(key, lines, 0, []);
    // The student's current work is represented to the model two ways: the
    // attached PNG and the detected ink lines. Both must appear so the hint is
    // about what the student actually wrote, not a generic tip.
    expect(prompt).toContain('attached PNG shows the student work');
    expect(prompt).toContain('DETECTED INK LINES');
    expect(prompt).toContain('line-1');
    expect(prompt).toContain('line-2');
    // And the problem itself is in the prompt so the hint is on topic.
    expect(prompt).toContain(key.statement);
  });

  it('directs the hint to either flag the actual error or give the next step, and never the final answer', () => {
    const prompt = buildHintPrompt(key, lines, 0, []);
    expect(prompt).toMatch(/clear mistake/i); // case (a): tell them what is wrong
    expect(prompt).toMatch(/next step/i); // case (b): give the concrete next step
    expect(prompt).toMatch(/never reveal the final numeric answer/i);
  });

  it('escalates with the level and folds in prior hints so each hint goes strictly deeper', () => {
    const first = buildHintPrompt(key, lines, 0, []);
    expect(first).toContain('FIRST HINT');
    expect(first).toContain('(none yet, this is the first hint)');

    const deeper = buildHintPrompt(key, lines, 2, ['Start from Coulomb law.', 'Square the distance.']);
    expect(deeper).toContain('DEEPER HINT');
    // The earlier hints are carried so the model can build past them.
    expect(deeper).toContain('Start from Coulomb law.');
    expect(deeper).toContain('Square the distance.');
  });

  it('falls back to a strategic start when the page has no real work yet', () => {
    const prompt = buildHintPrompt(key, [], 0, []);
    expect(prompt).toContain('(no ink lines were detected)');
    expect(prompt).toMatch(/no real work yet/i);
  });

  it('tells the model not to use em or en dashes (the soft layer behind the sanitizer)', () => {
    const prompt = buildHintPrompt(key, lines, 0, []);
    expect(prompt).toMatch(/do not use em dashes or en dashes/i);
  });
});

describe('buildExplainPrompt', () => {
  const question = 'Why does halving the distance multiply the force by four?';
  // The exact complete-and-correct answer from the miscalibration report: it
  // states the inverse-square dependence on distance and reaches the 4x
  // conclusion. The recalibrated grader must treat this as isOnTrack true.
  const answer =
    "Coulomb's Law states that the electric force between two charged particles is inversely " +
    'proportional to the square of the distance between them. Thus, if the distance is multiplied ' +
    'by half, the force is multiplied by (1/2)^-2 = 4.';

  it('grounds the feedback in the problem, the question asked, and the student answer', () => {
    const prompt = buildExplainPrompt(key, question, answer);
    expect(prompt).toContain(key.statement);
    expect(prompt).toContain(question);
    expect(prompt).toContain(answer);
  });

  it('instructs accepting a complete, correct explanation as isOnTrack true', () => {
    const prompt = buildExplainPrompt(key, question, answer);
    // It grades on the core relationship plus a correct conclusion, not on
    // exhaustively restating every intermediate algebraic step.
    expect(prompt).toMatch(/generous, fair grader/i);
    expect(prompt).toMatch(/correct core relationship or mechanism AND reaches a correct conclusion/);
    expect(prompt).toMatch(/even if the student does not exhaustively spell out every intermediate algebraic step/);
    // The screenshot answer (inverse square + 4x conclusion) is named as a case
    // that must grade true, so it cannot be nitpicked to false again.
    expect(prompt).toMatch(/must be isOnTrack TRUE/);
    expect(prompt).toContain('(1/2)^-2 = 4');
  });

  it('flips the tie-breaker toward TRUE and drops the old strict framing', () => {
    const prompt = buildExplainPrompt(key, question, answer);
    expect(prompt).toMatch(/lean isOnTrack TRUE/);
    // The previous strict instruction defaulted to FALSE and demanded complete
    // causal reasoning; none of that framing should remain.
    expect(prompt).not.toMatch(/strict grader/i);
    expect(prompt).not.toMatch(/when in doubt, set isOnTrack FALSE/i);
    expect(prompt).not.toMatch(/complete causal reasoning/i);
  });

  it('reserves isOnTrack FALSE only for vague, incomplete, or wrong answers', () => {
    const prompt = buildExplainPrompt(key, question, answer);
    expect(prompt).toMatch(/Reserve isOnTrack FALSE/);
    expect(prompt).toMatch(/genuinely vague/i);
    expect(prompt).toMatch(/miss the mechanism entirely/i);
    expect(prompt).toMatch(/never reach a correct conclusion/i);
    expect(prompt).toMatch(/real physics error/i);
  });

  it('keeps the warm, affirm-then-optional-refinement tone (praise, not a blocking correction)', () => {
    const prompt = buildExplainPrompt(key, question, answer);
    expect(prompt).toMatch(/warm, encouraging AP Physics tutor/i);
    expect(prompt).toMatch(/Always begin by affirming what they got right/i);
    // When correct, any refinement is framed as an optional bonus, not a fix.
    expect(prompt).toMatch(/brief optional refinement/i);
    expect(prompt).toMatch(/never as a fix they must make/i);
    // The JSON output contract is unchanged.
    expect(prompt).toContain('"feedback": string');
    expect(prompt).toContain('"isOnTrack": boolean');
  });

  it('forbids pairing affirming praise with isOnTrack false and decouples it from offering a refinement', () => {
    const prompt = buildExplainPrompt(key, question, answer);
    // The exact screenshot regression: the grader praised this answer as correct
    // ("you correctly stated ... multiplied by 4") yet returned isOnTrack false,
    // tacking on a "just remember to clarify" note. The prompt must make isOnTrack
    // track ONLY correctness of the core relationship and conclusion, never the
    // choice to add a refinement.
    expect(prompt).toContain('(1/2)^-2 = 4'); // the exact screenshot answer is graded
    expect(prompt).toMatch(
      /isOnTrack must depend ONLY on whether the core relationship and the conclusion are correct/,
    );
    expect(prompt).toMatch(/must never lower isOnTrack/);
    expect(prompt).toMatch(/never pair praise of a correct answer with isOnTrack false/i);
    // It calls out the specific "just remember to clarify" wording from the screenshot.
    expect(prompt).toMatch(/just remember to clarify/i);
    // And that exact answer must still be mandated true, not nitpicked back to false.
    expect(prompt).toMatch(/must be isOnTrack TRUE/);
  });

  it('tells the model not to use em or en dashes (the soft layer behind the sanitizer)', () => {
    const prompt = buildExplainPrompt(key, question, answer);
    expect(prompt).toMatch(/do not use em dashes or en dashes/i);
  });
});

describe('hintWithOpenAI', () => {
  beforeEach(() => {
    createMock.mockReset();
    createMock.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({ text: 'Square the distance in your next step.', targetLineId: 'line-1' }),
          },
        },
      ],
    });
  });

  it("attaches the student's work image and the work-grounded prompt to the model request", async () => {
    const result = await hintWithOpenAI(key, 'cG5nLWRhdGE=', lines, 0, [], 'test-key');

    expect(result.text.length).toBeGreaterThan(0);
    expect(createMock).toHaveBeenCalledTimes(1);

    const request = createMock.mock.calls[0][0] as {
      messages: Array<{
        role: string;
        content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
      }>;
    };
    // A system message frames the request as legitimate tutoring so gpt-4o does not
    // refuse the student's own work; the image and prompt ride on the user message.
    expect(request.messages.some((m) => m.role === 'system')).toBe(true);
    const userMessage = request.messages.find((m) => Array.isArray(m.content));
    const content = userMessage?.content as Array<{ type: string; text?: string; image_url?: { url: string } }>;
    const imagePart = content.find((part) => part.type === 'image_url');
    const textPart = content.find((part) => part.type === 'text');

    // The handwriting PNG (the same capture "Check work" sends) is attached as the
    // student's current work, and the prompt references that work by line id.
    expect(imagePart?.image_url?.url).toBe('data:image/png;base64,cG5nLWRhdGE=');
    expect(textPart?.text).toContain('line-1');
    expect(textPart?.text).toContain(key.statement);
  });

  it('asks for enough completion budget that a hard problem still returns content', async () => {
    await hintWithOpenAI(key, 'cG5nLWRhdGE=', lines, 0, [], 'test-key');

    const request = createMock.mock.calls[0][0] as { max_completion_tokens: number };
    // Regression guard: the old 800-token cap let gpt-4o spend the whole budget on
    // a hard problem (e.g. the band-5 Solve set) before emitting any JSON, so the
    // completion came back empty and collectText threw "no text content". The hint
    // budget must be at least as large as grading's proven 1500.
    expect(request.max_completion_tokens).toBeGreaterThanOrEqual(1500);
  });

  it('surfaces finish_reason when the model returns an empty (truncated) completion', async () => {
    // Reproduces the deployed failure: the model exhausted its token budget and
    // returned empty content with finish_reason "length". The thrown error must
    // name the cause so a too-small budget is diagnosable from the logs.
    createMock.mockReset();
    createMock.mockResolvedValue({
      choices: [{ message: { content: '' }, finish_reason: 'length' }],
    });

    await expect(hintWithOpenAI(key, 'cG5nLWRhdGE=', lines, 0, [], 'test-key')).rejects.toThrow(
      /no text content.*length/i,
    );
  });

  it('retries when the model refuses with empty content, then uses the later success', async () => {
    // The deployed failure: gpt-4o intermittently refuses a vision request and
    // returns null content with finish_reason "stop" (plus a refusal message),
    // which surfaced to the student as "The AI tutor ran into a problem". A refusal
    // is transient, so the call retries and returns the first non-empty completion.
    createMock.mockReset();
    createMock
      .mockResolvedValueOnce({
        choices: [
          { message: { content: null, refusal: 'I am unable to help with this request.' }, finish_reason: 'stop' },
        ],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify({ text: 'Square the distance next.', targetLineId: null }) } }],
      });

    const result = await hintWithOpenAI(key, 'cG5nLWRhdGE=', lines, 0, [], 'test-key');
    expect(result.text.length).toBeGreaterThan(0);
    expect(createMock).toHaveBeenCalledTimes(2);
  });
});

describe('answerQuestionWithOpenAI', () => {
  beforeEach(() => {
    createMock.mockReset();
    createMock.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ answer: 'Think about the distance term.' }) } }],
    });
  });

  it('asks for enough completion budget that a hard problem still returns content', async () => {
    await answerQuestionWithOpenAI(key, 'cG5nLWRhdGE=', lines, 'Why is the distance squared?', 'test-key');

    const request = createMock.mock.calls[0][0] as { max_completion_tokens: number };
    // Same regression as the hint path: the old 800-token cap produced empty
    // completions on hard problems, breaking "Ask a question" in the Solve phase.
    expect(request.max_completion_tokens).toBeGreaterThanOrEqual(1500);
  });
});
