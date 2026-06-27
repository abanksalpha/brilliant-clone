import { describe, it, expect } from 'vitest';
import { parseAskResponse, parseGradeResponse, parseHintResponse, validateLineRefs } from './parse';

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
    tier: 0,
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

  it('rejects firstErrorLineId that is not in the allowed ids', () => {
    const raw = slipPayload({ firstErrorLineId: 'line-99' });
    expect(() => parseGradeResponse(raw, allowedLineIds, allowedPrincipleIds, knownNodeIds)).toThrow();
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

  it('rejects an incorrect response with a null firstErrorLineId', () => {
    const raw = slipPayload({ firstErrorLineId: null });
    expect(() => parseGradeResponse(raw, allowedLineIds, allowedPrincipleIds, knownNodeIds)).toThrow();
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
  it('parses a valid hint with a null targetLineId', () => {
    const result = parseHintResponse(hintPayload(), allowedLineIds);
    expect(result.tier).toBe(0);
    expect(result.text.length).toBeGreaterThan(0);
    expect(result.targetLineId).toBeNull();
  });

  it('parses a valid hint that targets an allowed line', () => {
    const result = parseHintResponse(hintPayload({ tier: 1, targetLineId: 'line-2' }), allowedLineIds);
    expect(result.tier).toBe(1);
    expect(result.targetLineId).toBe('line-2');
  });

  it('extracts a fenced hint payload', () => {
    const raw = 'Hint follows.\n```json\n' + hintPayload({ tier: 2 }) + '\n```';
    const result = parseHintResponse(raw, allowedLineIds);
    expect(result.tier).toBe(2);
  });

  it('rejects an invalid tier', () => {
    expect(() => parseHintResponse(hintPayload({ tier: 3 }), allowedLineIds)).toThrow();
  });

  it('rejects an empty hint text', () => {
    expect(() => parseHintResponse(hintPayload({ text: '' }), allowedLineIds)).toThrow();
  });

  it('rejects a targetLineId that is not in the allowed ids', () => {
    expect(() => parseHintResponse(hintPayload({ targetLineId: 'line-99' }), allowedLineIds)).toThrow();
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
