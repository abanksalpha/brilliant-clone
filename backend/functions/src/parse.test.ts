import { describe, it, expect } from 'vitest';
import {
  parseAskResponse,
  parseExplainResponse,
  parseGradeResponse,
  parseHintResponse,
  stripDashes,
  validateLineRefs,
} from './parse';

// Em dash (U+2014), horizontal bar (U+2015), and en dash (U+2013): the three
// Unicode dashes that must never survive into a client-facing string.
const UNICODE_DASH = /[\u2013\u2014\u2015]/;

const allowedLineIds = ['line-1', 'line-2', 'line-3'];
const allowedPrincipleIds = ['coulombs-law', 'superposition'];
const knownNodeIds = ['node-inverse-square', 'node-vector-add'];

function correctPayload(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    isCorrect: true,
    transcribedSteps: ['E = k q / r^2', 'E = 6.74e3 N/C'],
    firstErrorLineId: null,
    explanation: 'All steps are consistent with the governing relation.',
    correctSolution: ['E = k q / r^2', 'E equals the computed value'],
    ...overrides,
  });
}

function slipPayload(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    isCorrect: false,
    transcribedSteps: ['E = k q / r^2', 'E = 6.7e3 N/C'],
    firstErrorLineId: 'line-2',
    explanation: 'You set up the relation correctly but slipped on the arithmetic in this step.',
    errorType: 'slip',
    ...overrides,
  });
}

function conceptPayload(
  overrides: Record<string, unknown> = {},
  conceptMatchOverrides: Record<string, unknown> = {},
): string {
  return JSON.stringify({
    isCorrect: false,
    transcribedSteps: ['E = k q / r', 'E = 1.35e4 N/C'],
    firstErrorLineId: 'line-2',
    explanation: 'You divided by r when this relation falls off with the square of the distance.',
    errorType: 'concept',
    conceptMatch: {
      matchedNodeId: null,
      principleId: 'coulombs-law',
      wrongBelief: 'The field of a point charge falls off linearly with distance instead of with the square of distance.',
      specificNote: 'You divided by r rather than r squared in this step.',
      ...conceptMatchOverrides,
    },
    ...overrides,
  });
}

function hintPayload(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    text: 'Start by classifying what kind of quantity is being asked for.',
    targetLineId: null,
    ...overrides,
  });
}

function askPayload(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    answer: 'Look at the direction each charge pushes before you combine the two fields.',
    ...overrides,
  });
}

describe('parseGradeResponse', () => {
  it('parses a valid correct response with no error classification', () => {
    const result = parseGradeResponse(correctPayload(), allowedLineIds, allowedPrincipleIds, knownNodeIds);
    expect(result.isCorrect).toBe(true);
    expect(result.transcribedSteps).toEqual(['E = k q / r^2', 'E = 6.74e3 N/C']);
    expect(result.firstErrorLineId).toBeNull();
    expect(result.explanation.length).toBeGreaterThan(0);
    expect(result.correctSolution).toEqual(['E = k q / r^2', 'E equals the computed value']);
    expect(result.errorType).toBeUndefined();
    expect(result.conceptMatch).toBeUndefined();
  });

  it('parses a slip response with no conceptMatch', () => {
    const result = parseGradeResponse(slipPayload(), allowedLineIds, allowedPrincipleIds, knownNodeIds);
    expect(result.isCorrect).toBe(false);
    expect(result.firstErrorLineId).toBe('line-2');
    expect(result.errorType).toBe('slip');
    expect(result.conceptMatch).toBeUndefined();
    expect(result.correctSolution).toBeUndefined();
  });

  it('parses a concept response that proposes a new signature (matchedNodeId null)', () => {
    const result = parseGradeResponse(conceptPayload(), allowedLineIds, allowedPrincipleIds, knownNodeIds);
    expect(result.isCorrect).toBe(false);
    expect(result.errorType).toBe('concept');
    expect(result.conceptMatch?.matchedNodeId).toBeNull();
    expect(result.conceptMatch?.principleId).toBe('coulombs-law');
    expect((result.conceptMatch?.wrongBelief ?? '').length).toBeGreaterThan(0);
    expect((result.conceptMatch?.specificNote ?? '').length).toBeGreaterThan(0);
  });

  it('parses a concept response that matches an existing known node id', () => {
    const raw = conceptPayload({}, { matchedNodeId: 'node-inverse-square' });
    const result = parseGradeResponse(raw, allowedLineIds, allowedPrincipleIds, knownNodeIds);
    expect(result.errorType).toBe('concept');
    expect(result.conceptMatch?.matchedNodeId).toBe('node-inverse-square');
  });

  it('extracts JSON from a fenced code block with surrounding prose', () => {
    const raw = 'Here is my assessment.\n```json\n' + conceptPayload() + '\n```\nThanks.';
    const result = parseGradeResponse(raw, allowedLineIds, allowedPrincipleIds, knownNodeIds);
    expect(result.isCorrect).toBe(false);
    expect(result.errorType).toBe('concept');
  });

  it('extracts JSON from surrounding prose without fences', () => {
    const raw = 'The grade is as follows: ' + slipPayload() + ' end of report.';
    const result = parseGradeResponse(raw, allowedLineIds, allowedPrincipleIds, knownNodeIds);
    expect(result.firstErrorLineId).toBe('line-2');
    expect(result.errorType).toBe('slip');
  });

  it('rejects an incorrect response with no errorType', () => {
    const raw = slipPayload({ errorType: undefined });
    expect(() => parseGradeResponse(raw, allowedLineIds, allowedPrincipleIds, knownNodeIds)).toThrow();
  });

  it('rejects an incorrect response with an unrecognized errorType', () => {
    const raw = slipPayload({ errorType: 'typo' });
    expect(() => parseGradeResponse(raw, allowedLineIds, allowedPrincipleIds, knownNodeIds)).toThrow();
  });

  it('rejects a concept response that omits conceptMatch', () => {
    const raw = conceptPayload({ conceptMatch: undefined });
    expect(() => parseGradeResponse(raw, allowedLineIds, allowedPrincipleIds, knownNodeIds)).toThrow();
  });

  it('rejects a concept response whose principleId is not in allowedPrincipleIds', () => {
    const raw = conceptPayload({}, { principleId: 'not-a-principle' });
    expect(() => parseGradeResponse(raw, allowedLineIds, allowedPrincipleIds, knownNodeIds)).toThrow();
  });

  it('rejects a concept response whose matchedNodeId is not in knownNodeIds', () => {
    const raw = conceptPayload({}, { matchedNodeId: 'node-not-real' });
    expect(() => parseGradeResponse(raw, allowedLineIds, allowedPrincipleIds, knownNodeIds)).toThrow();
  });

  it('rejects a concept response with an empty wrongBelief', () => {
    const raw = conceptPayload({}, { wrongBelief: '' });
    expect(() => parseGradeResponse(raw, allowedLineIds, allowedPrincipleIds, knownNodeIds)).toThrow();
  });

  it('rejects a concept response with an empty specificNote', () => {
    const raw = conceptPayload({}, { specificNote: '   ' });
    expect(() => parseGradeResponse(raw, allowedLineIds, allowedPrincipleIds, knownNodeIds)).toThrow();
  });

  it('coerces an out-of-set firstErrorLineId to null instead of discarding the grade', () => {
    // The line id is only a cosmetic anchor (which line to circle). A model that
    // returns an unrecognized id should not throw away an otherwise valid grade.
    const raw = slipPayload({ firstErrorLineId: 'line-99' });
    const result = parseGradeResponse(raw, allowedLineIds, allowedPrincipleIds, knownNodeIds);
    expect(result.isCorrect).toBe(false);
    expect(result.errorType).toBe('slip');
    expect(result.firstErrorLineId).toBeNull();
  });

  it('coerces a non-string firstErrorLineId to null', () => {
    const raw = slipPayload({ firstErrorLineId: 2 });
    const result = parseGradeResponse(raw, allowedLineIds, allowedPrincipleIds, knownNodeIds);
    expect(result.firstErrorLineId).toBeNull();
  });

  it('rejects a missing or empty explanation', () => {
    const empty = slipPayload({ explanation: '' });
    expect(() => parseGradeResponse(empty, allowedLineIds, allowedPrincipleIds, knownNodeIds)).toThrow();
    const missing = JSON.stringify({
      isCorrect: false,
      transcribedSteps: ['x'],
      firstErrorLineId: 'line-1',
      errorType: 'slip',
    });
    expect(() => parseGradeResponse(missing, allowedLineIds, allowedPrincipleIds, knownNodeIds)).toThrow();
  });

  it('accepts an incorrect response with a null firstErrorLineId (no line to circle)', () => {
    // When no ink line cleanly matches (or none were detected), the grade still
    // stands; the UI just does not circle a specific line.
    const raw = slipPayload({ firstErrorLineId: null });
    const result = parseGradeResponse(raw, allowedLineIds, allowedPrincipleIds, knownNodeIds);
    expect(result.isCorrect).toBe(false);
    expect(result.errorType).toBe('slip');
    expect(result.firstErrorLineId).toBeNull();
  });

  it('rejects a non boolean isCorrect', () => {
    const raw = correctPayload({ isCorrect: 'true' });
    expect(() => parseGradeResponse(raw, allowedLineIds, allowedPrincipleIds, knownNodeIds)).toThrow();
  });

  it('rejects transcribedSteps that are not an array of strings', () => {
    const raw = slipPayload({ transcribedSteps: ['ok', 7] });
    expect(() => parseGradeResponse(raw, allowedLineIds, allowedPrincipleIds, knownNodeIds)).toThrow();
  });

  it('rejects a correct response that is missing correctSolution', () => {
    const raw = JSON.stringify({
      isCorrect: true,
      transcribedSteps: ['x'],
      firstErrorLineId: null,
      explanation: 'looks fine',
    });
    expect(() => parseGradeResponse(raw, allowedLineIds, allowedPrincipleIds, knownNodeIds)).toThrow();
  });

  it('rejects text that contains no JSON object', () => {
    expect(() => parseGradeResponse('no json here', allowedLineIds, allowedPrincipleIds, knownNodeIds)).toThrow();
  });
});

describe('parseHintResponse', () => {
  it('parses a valid hint with a null targetLineId and the server-set level', () => {
    const result = parseHintResponse(hintPayload(), allowedLineIds, 0);
    expect(result.level).toBe(0);
    expect(result.text.length).toBeGreaterThan(0);
    expect(result.targetLineId).toBeNull();
  });

  it('parses a valid hint that targets an allowed line', () => {
    const result = parseHintResponse(hintPayload({ targetLineId: 'line-2' }), allowedLineIds, 1);
    expect(result.level).toBe(1);
    expect(result.targetLineId).toBe('line-2');
  });

  it('extracts a fenced hint payload', () => {
    const raw = 'Hint follows.\n```json\n' + hintPayload() + '\n```';
    const result = parseHintResponse(raw, allowedLineIds, 2);
    expect(result.level).toBe(2);
  });

  it('carries an arbitrarily deep level through (no ceiling) and clamps a bad one to 0', () => {
    expect(parseHintResponse(hintPayload(), allowedLineIds, 7).level).toBe(7);
    expect(parseHintResponse(hintPayload(), allowedLineIds, -1).level).toBe(0);
  });

  it('rejects an empty hint text', () => {
    expect(() => parseHintResponse(hintPayload({ text: '' }), allowedLineIds, 0)).toThrow();
  });

  it('coerces an out-of-set targetLineId to null', () => {
    const result = parseHintResponse(hintPayload({ targetLineId: 'line-99' }), allowedLineIds, 0);
    expect(result.targetLineId).toBeNull();
  });
});

describe('parseAskResponse', () => {
  it('parses a valid answer payload', () => {
    const result = parseAskResponse(askPayload());
    expect(result.answer).toBe('Look at the direction each charge pushes before you combine the two fields.');
  });

  it('extracts a fenced answer payload with surrounding prose', () => {
    const raw = 'Here is the response.\n```json\n' + askPayload() + '\n```\nThanks.';
    const result = parseAskResponse(raw);
    expect(result.answer.length).toBeGreaterThan(0);
  });

  it('rejects a payload that is missing answer', () => {
    expect(() => parseAskResponse(JSON.stringify({ notAnswer: 'hello' }))).toThrow();
  });

  it('rejects an empty or whitespace answer', () => {
    expect(() => parseAskResponse(askPayload({ answer: '' }))).toThrow();
    expect(() => parseAskResponse(askPayload({ answer: '   ' }))).toThrow();
  });

  it('rejects a non-string answer', () => {
    expect(() => parseAskResponse(askPayload({ answer: 42 }))).toThrow();
  });
});

describe('parseExplainResponse', () => {
  function explainPayload(overrides: Record<string, unknown> = {}): string {
    return JSON.stringify({
      feedback: 'You nailed the key idea: the two forces are a Newton third law pair, so they are equal in size.',
      isOnTrack: true,
      ...overrides,
    });
  }

  it('parses a valid feedback payload', () => {
    const result = parseExplainResponse(explainPayload());
    expect(result.isOnTrack).toBe(true);
    expect(result.feedback).toContain('third law pair');
  });

  it('trims surrounding whitespace from the feedback', () => {
    const result = parseExplainResponse(explainPayload({ feedback: '  good reasoning  ' }));
    expect(result.feedback).toBe('good reasoning');
  });

  it('extracts a fenced payload with surrounding prose', () => {
    const raw = 'Sure.\n```json\n' + explainPayload({ isOnTrack: false }) + '\n```\nDone.';
    const result = parseExplainResponse(raw);
    expect(result.isOnTrack).toBe(false);
    expect(result.feedback.length).toBeGreaterThan(0);
  });

  it('rejects an empty or whitespace feedback', () => {
    expect(() => parseExplainResponse(explainPayload({ feedback: '' }))).toThrow();
    expect(() => parseExplainResponse(explainPayload({ feedback: '   ' }))).toThrow();
  });

  it('rejects a non-boolean isOnTrack', () => {
    expect(() => parseExplainResponse(explainPayload({ isOnTrack: 'yes' }))).toThrow();
    expect(() => parseExplainResponse(JSON.stringify({ feedback: 'ok' }))).toThrow();
  });
});

describe('validateLineRefs', () => {
  const wellFormed = [
    { id: 'line-1', bbox: { x: 1, y: 2, w: 3, h: 4 } },
    { id: 'line-2', bbox: { x: 0, y: 0, w: 10.5, h: 20.25 } },
  ];

  it('accepts and returns a well-formed lines array', () => {
    expect(validateLineRefs(wellFormed)).toEqual(wellFormed);
  });

  it('accepts an empty array (no ink drawn yet)', () => {
    expect(validateLineRefs([])).toEqual([]);
  });

  it('rejects a value that is not an array', () => {
    expect(() => validateLineRefs('line-1')).toThrow();
    expect(() => validateLineRefs(null)).toThrow();
    expect(() => validateLineRefs({ id: 'line-1' })).toThrow();
  });

  it('rejects an element that is not an object', () => {
    expect(() => validateLineRefs(['line-1'])).toThrow();
  });

  it('rejects an element missing a string id', () => {
    expect(() => validateLineRefs([{ bbox: { x: 1, y: 2, w: 3, h: 4 } }])).toThrow();
    expect(() => validateLineRefs([{ id: 7, bbox: { x: 1, y: 2, w: 3, h: 4 } }])).toThrow();
  });

  it('rejects an element whose bbox is missing or not an object', () => {
    expect(() => validateLineRefs([{ id: 'line-1' }])).toThrow();
    expect(() => validateLineRefs([{ id: 'line-1', bbox: null }])).toThrow();
  });

  it('rejects an element whose bbox has a non-numeric component', () => {
    expect(() => validateLineRefs([{ id: 'line-1', bbox: { x: 1, y: 2, w: 3, h: '4' } }])).toThrow();
  });

  it('rejects an element whose bbox is missing a component', () => {
    expect(() => validateLineRefs([{ id: 'line-1', bbox: { x: 1, y: 2, w: 3 } }])).toThrow();
  });

  it('rejects an element whose bbox component is not finite', () => {
    expect(() => validateLineRefs([{ id: 'line-1', bbox: { x: 1, y: 2, w: 3, h: Number.NaN } }])).toThrow();
  });
});

describe('stripDashes', () => {
  it('turns an em dash that joins words into a comma and a space', () => {
    expect(stripDashes('word \u2014 word')).toBe('word, word');
    // The exact screenshot regression: "right—it's" must read "right, it's".
    expect(stripDashes("You got the core idea right\u2014it's an inverse square relationship.")).toBe(
      "You got the core idea right, it's an inverse square relationship.",
    );
  });

  it('also replaces the en dash and the horizontal bar', () => {
    expect(stripDashes('a \u2013 b')).toBe('a, b'); // en dash
    expect(stripDashes('a\u2015b')).toBe('a, b'); // horizontal bar
    expect(stripDashes('a\u2014b\u2013c\u2015d')).toBe('a, b, c, d');
  });

  it('never touches the ASCII hyphen-minus used in math', () => {
    expect(stripDashes('10^-6')).toBe('10^-6');
    expect(stripDashes('(1/0.5)^2')).toBe('(1/0.5)^2');
    expect(stripDashes('a charge of -5 C')).toBe('a charge of -5 C');
    expect(stripDashes('a range of 3-4 N')).toBe('a range of 3-4 N');
    expect(stripDashes('q_1 - q_2')).toBe('q_1 - q_2');
  });

  it('produces no comma artifacts next to a comma or other punctuation', () => {
    // A dash hugging an existing comma must not yield ",," or " ,".
    expect(stripDashes('first\u2014, second')).toBe('first, second');
    expect(stripDashes('first \u2014 , second')).toBe('first, second');
    // A dash before terminal punctuation must not strand a comma (", ." -> ".").
    expect(stripDashes('check the sign\u2014. Then go on')).toBe('check the sign. Then go on');
    expect(stripDashes('check the sign\u2014; then go on')).toBe('check the sign; then go on');
    const messy = stripDashes('Good start\u2014, but check the sign\u2014. Then continue\u2014');
    expect(messy).toBe('Good start, but check the sign. Then continue');
    expect(messy).not.toMatch(/ ,/);
    expect(messy).not.toMatch(/,,/);
  });

  it('drops a dash left dangling at the start or end of the text', () => {
    expect(stripDashes('\u2014leading')).toBe('leading');
    expect(stripDashes('trailing\u2014')).toBe('trailing');
  });

  it('preserves a legitimate numeric thousands separator', () => {
    expect(stripDashes('about 1,000 volts')).toBe('about 1,000 volts');
  });

  it('passes non-string input through untouched', () => {
    expect(stripDashes(42 as unknown as string)).toBe(42 as unknown as string);
  });
});

describe('parser dash sanitization', () => {
  it('parseExplainResponse strips dashes from feedback (the screenshot case)', () => {
    const raw = JSON.stringify({
      feedback: "You got the core idea right\u2014it's an inverse square relationship.",
      isOnTrack: true,
    });
    const result = parseExplainResponse(raw);
    expect(result.feedback).toBe("You got the core idea right, it's an inverse square relationship.");
    expect(UNICODE_DASH.test(result.feedback)).toBe(false);
  });

  it('parseHintResponse strips dashes from text but keeps ASCII hyphens in math', () => {
    const raw = hintPayload({ text: 'Use r\u2014the distance\u2014with 10^-6 m, then square it.' });
    const result = parseHintResponse(raw, allowedLineIds, 0);
    expect(result.text).toBe('Use r, the distance, with 10^-6 m, then square it.');
    expect(UNICODE_DASH.test(result.text)).toBe(false);
    expect(result.text).toContain('10^-6');
  });

  it('parseAskResponse strips both em and en dashes from the answer', () => {
    const raw = askPayload({ answer: 'Think about direction first\u2014then magnitude \u2013 carefully.' });
    const result = parseAskResponse(raw);
    expect(result.answer).toBe('Think about direction first, then magnitude, carefully.');
    expect(UNICODE_DASH.test(result.answer)).toBe(false);
  });

  it('parseGradeResponse strips dashes from every grade prose field, keeping hyphen math', () => {
    const raw = conceptPayload(
      {
        transcribedSteps: ['E = k q / r^2', 'used r\u2014not r^2'],
        explanation: "You divided by r\u2014it's an inverse square law, so use 10^-6 carefully.",
      },
      {
        wrongBelief: 'The field falls off linearly\u2014not with the square of distance.',
        specificNote: 'You used r\u2013not r squared\u2013in this step.',
      },
    );
    const result = parseGradeResponse(raw, allowedLineIds, allowedPrincipleIds, knownNodeIds);

    expect(result.explanation).toBe("You divided by r, it's an inverse square law, so use 10^-6 carefully.");
    expect(result.explanation).toContain('10^-6');
    expect(result.transcribedSteps).toEqual(['E = k q / r^2', 'used r, not r^2']);
    expect(result.conceptMatch?.wrongBelief).toBe(
      'The field falls off linearly, not with the square of distance.',
    );
    expect(result.conceptMatch?.specificNote).toBe('You used r, not r squared, in this step.');

    const everyProseField = [
      result.explanation,
      ...result.transcribedSteps,
      result.conceptMatch?.wrongBelief ?? '',
      result.conceptMatch?.specificNote ?? '',
    ];
    everyProseField.forEach((field) => expect(UNICODE_DASH.test(field)).toBe(false));
  });

  it('parseGradeResponse strips dashes from correctSolution while preserving hyphen math', () => {
    const raw = correctPayload({
      correctSolution: ['E = k q / r^2', 'plug in 10^-6\u2014then simplify'],
    });
    const result = parseGradeResponse(raw, allowedLineIds, allowedPrincipleIds, knownNodeIds);
    expect(result.correctSolution).toEqual(['E = k q / r^2', 'plug in 10^-6, then simplify']);
    (result.correctSolution ?? []).forEach((step) => expect(UNICODE_DASH.test(step)).toBe(false));
  });
});
