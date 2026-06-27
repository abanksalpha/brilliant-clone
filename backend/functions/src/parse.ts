import { AskResult, GradeResult, HintResult, LineRef } from './types';

// Locate a single JSON object inside arbitrary model text. The model is asked to
// return only JSON, but it can wrap the payload in ```json fences or surrounding
// prose, so we take the substring from the first opening brace to the last
// closing brace and parse that. We never repair or guess: malformed input throws.
function extractJsonObject(rawText: string): Record<string, unknown> {
  if (typeof rawText !== 'string') {
    throw new Error('parse error: model output is not a string');
  }
  const first = rawText.indexOf('{');
  const last = rawText.lastIndexOf('}');
  if (first === -1 || last === -1 || last < first) {
    throw new Error('parse error: no JSON object found in model output');
  }
  const slice = rawText.slice(first, last + 1);
  let parsed: unknown;
  try {
    parsed = JSON.parse(slice);
  } catch (e) {
    throw new Error(`parse error: model output is not valid JSON (${(e as Error).message})`);
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('parse error: model output JSON is not an object');
  }
  return parsed as Record<string, unknown>;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

const BBOX_AXES = ['x', 'y', 'w', 'h'] as const;

/**
 * Validate the `lines` payload of a callable request. Every element must be an
 * object with a string `id` and a `bbox` whose x, y, w, h are all finite
 * numbers. Returns the value narrowed to LineRef[] on success and throws a plain
 * Error on the first malformed element. Pure: no repair, no fallback, no I/O, so
 * the callable layer can map the thrown message to HttpsError('invalid-argument').
 */
export function validateLineRefs(value: unknown): LineRef[] {
  if (!Array.isArray(value)) {
    throw new Error('lines validation: lines must be an array');
  }

  value.forEach((line, index) => {
    if (typeof line !== 'object' || line === null) {
      throw new Error(`lines validation: lines[${index}] must be an object`);
    }
    const candidate = line as Record<string, unknown>;
    if (typeof candidate.id !== 'string') {
      throw new Error(`lines validation: lines[${index}].id must be a string`);
    }
    if (typeof candidate.bbox !== 'object' || candidate.bbox === null) {
      throw new Error(`lines validation: lines[${index}].bbox must be an object`);
    }
    const bbox = candidate.bbox as Record<string, unknown>;
    for (const axis of BBOX_AXES) {
      const component = bbox[axis];
      if (typeof component !== 'number' || !Number.isFinite(component)) {
        throw new Error(`lines validation: lines[${index}].bbox.${axis} must be a finite number`);
      }
    }
  });

  return value as LineRef[];
}

export function parseGradeResponse(
  rawText: string,
  allowedLineIds: string[],
  allowedPrincipleIds: string[],
  knownNodeIds: string[],
): GradeResult {
  const obj = extractJsonObject(rawText);

  const isCorrect = obj.isCorrect;
  if (typeof isCorrect !== 'boolean') {
    throw new Error('grade validation: isCorrect must be a boolean');
  }

  const transcribedSteps = obj.transcribedSteps;
  if (!isStringArray(transcribedSteps)) {
    throw new Error('grade validation: transcribedSteps must be an array of strings');
  }

  const explanation = obj.explanation;
  if (typeof explanation !== 'string' || explanation.trim().length === 0) {
    throw new Error('grade validation: explanation must be a non-empty string');
  }

  const rawFirstErrorLineId = obj.firstErrorLineId;
  let firstErrorLineId: string | null;
  if (rawFirstErrorLineId === null) {
    firstErrorLineId = null;
  } else if (typeof rawFirstErrorLineId === 'string' && allowedLineIds.includes(rawFirstErrorLineId)) {
    firstErrorLineId = rawFirstErrorLineId;
  } else {
    throw new Error('grade validation: firstErrorLineId must be null or one of the provided line ids');
  }

  if (isCorrect) {
    const correctSolution = obj.correctSolution;
    if (!isStringArray(correctSolution)) {
      throw new Error('grade validation: correctSolution must be an array of strings when isCorrect is true');
    }
    return {
      isCorrect: true,
      transcribedSteps,
      firstErrorLineId,
      explanation,
      correctSolution,
    };
  }

  if (firstErrorLineId === null) {
    throw new Error('grade validation: firstErrorLineId is required when isCorrect is false');
  }

  const errorType = obj.errorType;
  if (errorType !== 'concept' && errorType !== 'slip') {
    throw new Error('grade validation: errorType must be "concept" or "slip" when isCorrect is false');
  }

  if (errorType === 'slip') {
    return {
      isCorrect: false,
      transcribedSteps,
      firstErrorLineId,
      explanation,
      errorType,
    };
  }

  const rawConceptMatch = obj.conceptMatch;
  if (typeof rawConceptMatch !== 'object' || rawConceptMatch === null || Array.isArray(rawConceptMatch)) {
    throw new Error('grade validation: conceptMatch must be an object when errorType is "concept"');
  }
  const conceptMatch = rawConceptMatch as Record<string, unknown>;

  const rawMatchedNodeId = conceptMatch.matchedNodeId;
  let matchedNodeId: string | null;
  if (rawMatchedNodeId === null) {
    matchedNodeId = null;
  } else if (typeof rawMatchedNodeId === 'string' && knownNodeIds.includes(rawMatchedNodeId)) {
    matchedNodeId = rawMatchedNodeId;
  } else {
    throw new Error('grade validation: conceptMatch.matchedNodeId must be null or one of the known node ids');
  }

  const principleId = conceptMatch.principleId;
  if (typeof principleId !== 'string' || !allowedPrincipleIds.includes(principleId)) {
    throw new Error('grade validation: conceptMatch.principleId must be one of the allowed principle ids');
  }

  const wrongBelief = conceptMatch.wrongBelief;
  if (typeof wrongBelief !== 'string' || wrongBelief.trim().length === 0) {
    throw new Error('grade validation: conceptMatch.wrongBelief must be a non-empty string');
  }

  const specificNote = conceptMatch.specificNote;
  if (typeof specificNote !== 'string' || specificNote.trim().length === 0) {
    throw new Error('grade validation: conceptMatch.specificNote must be a non-empty string');
  }

  return {
    isCorrect: false,
    transcribedSteps,
    firstErrorLineId,
    explanation,
    errorType,
    conceptMatch: { matchedNodeId, principleId, wrongBelief, specificNote },
  };
}

export function parseHintResponse(rawText: string, allowedLineIds: string[]): HintResult {
  const obj = extractJsonObject(rawText);

  const rawTier = obj.tier;
  if (rawTier !== 0 && rawTier !== 1 && rawTier !== 2) {
    throw new Error('hint validation: tier must be 0, 1, or 2');
  }
  const tier: 0 | 1 | 2 = rawTier;

  const text = obj.text;
  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('hint validation: text must be a non-empty string');
  }

  const rawTargetLineId = obj.targetLineId;
  let targetLineId: string | null;
  if (rawTargetLineId === null) {
    targetLineId = null;
  } else if (typeof rawTargetLineId === 'string' && allowedLineIds.includes(rawTargetLineId)) {
    targetLineId = rawTargetLineId;
  } else {
    throw new Error('hint validation: targetLineId must be null or one of the provided line ids');
  }

  return { tier, text, targetLineId };
}

export function parseAskResponse(rawText: string): AskResult {
  const obj = extractJsonObject(rawText);

  const answer = obj.answer;
  if (typeof answer !== 'string' || answer.trim().length === 0) {
    throw new Error('ask validation: answer must be a non-empty string');
  }

  return { answer };
}
