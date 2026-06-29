import { AskResult, ExplainFeedbackResult, GradeResult, HintResult, LineRef } from './types';

/**
 * Strip Unicode dashes out of model-written prose and leave natural punctuation.
 * The prompts already tell the model not to emit them, but instructions alone do
 * not stop it, so this is the deterministic guarantee that no em dash (—,
 * U+2014), horizontal bar (―, U+2015), or en dash (–, U+2013) ever reaches the
 * client.
 *
 * Only those three Unicode dashes are touched. The ASCII hyphen-minus "-" is
 * left exactly as is, because the app depends on it for math: exponents such as
 * 10^-6, expressions like (1/0.5)^2, negative numbers, and numeric ranges. A
 * dash that joins words becomes a comma and a single space, with any whitespace
 * that hugged it collapsed (so "right—it's" reads "right, it's" and "word — word"
 * reads "word, word"). The remaining steps tidy comma artifacts so the result
 * never contains " ,", ",,", or a comma stranded against other punctuation.
 * Non-string input is returned untouched.
 */
export function stripDashes(text: string): string {
  if (typeof text !== 'string') {
    return text;
  }
  return (
    text
      // Core rule: a Unicode dash, with any whitespace hugging it, becomes a
      // comma and one space so joined words read naturally.
      .replace(/\s*[\u2013\u2014\u2015]\s*/g, ', ')
      // Collapse comma runs (",," or ", ,") left when a dash sat beside a comma.
      .replace(/,(?:[ \t]*,)+/g, ',')
      // Drop a space that ended up before a comma (" ," -> ",").
      .replace(/[ \t]+,/g, ',')
      // Drop a comma stranded right before other sentence punctuation (", ." -> ".").
      .replace(/,[ \t]*([.;:!?])/g, '$1')
      // ...or stranded right after it ("., " -> ". ").
      .replace(/([.;:!?])[ \t]*,/g, '$1')
      // Remove a comma left dangling at the very start or end of the text.
      .replace(/^[ \t]*,[ \t]*/, '')
      .replace(/[ \t]*,[ \t]*$/, '')
      // Restore a single space after any comma that lost one, but never split a
      // numeric thousands separator like 1,000.
      .replace(/(?<!\d),(?!\s|$)/g, ', ')
  );
}

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

  // Validate the raw model text above, then hand back dash-free prose. The steps
  // and explanation are shown to the student, so they get sanitized; ids, enums,
  // and booleans below are never touched.
  const cleanTranscribedSteps = transcribedSteps.map((step) => stripDashes(step));
  const cleanExplanation = stripDashes(explanation);

  // firstErrorLineId is a cosmetic anchor (which ink line to circle), not part of
  // the grade itself. Vision models do not reliably echo an exact id, and when no
  // ink lines are detected there is no valid id to return, so coerce anything that
  // is not one of the provided ids to null rather than discarding a valid grade.
  const rawFirstErrorLineId = obj.firstErrorLineId;
  const firstErrorLineId: string | null =
    typeof rawFirstErrorLineId === 'string' && allowedLineIds.includes(rawFirstErrorLineId)
      ? rawFirstErrorLineId
      : null;

  if (isCorrect) {
    const correctSolution = obj.correctSolution;
    if (!isStringArray(correctSolution)) {
      throw new Error('grade validation: correctSolution must be an array of strings when isCorrect is true');
    }
    return {
      isCorrect: true,
      transcribedSteps: cleanTranscribedSteps,
      firstErrorLineId,
      explanation: cleanExplanation,
      correctSolution: correctSolution.map((step) => stripDashes(step)),
    };
  }

  const errorType = obj.errorType;
  if (errorType !== 'concept' && errorType !== 'slip') {
    throw new Error('grade validation: errorType must be "concept" or "slip" when isCorrect is false');
  }

  if (errorType === 'slip') {
    return {
      isCorrect: false,
      transcribedSteps: cleanTranscribedSteps,
      firstErrorLineId,
      explanation: cleanExplanation,
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
    transcribedSteps: cleanTranscribedSteps,
    firstErrorLineId,
    explanation: cleanExplanation,
    errorType,
    conceptMatch: {
      matchedNodeId,
      principleId,
      wrongBelief: stripDashes(wrongBelief),
      specificNote: stripDashes(specificNote),
    },
  };
}

export function parseHintResponse(rawText: string, allowedLineIds: string[], level: number): HintResult {
  const obj = extractJsonObject(rawText);

  // The level is set by the server from the request, not echoed by the model.
  const safeLevel = Number.isInteger(level) && level >= 0 ? level : 0;

  const text = obj.text;
  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new Error('hint validation: text must be a non-empty string');
  }

  // Like firstErrorLineId, targetLineId is a best-effort anchor: keep it only when
  // it matches a provided ink id, otherwise drop to null instead of failing.
  const rawTargetLineId = obj.targetLineId;
  const targetLineId: string | null =
    typeof rawTargetLineId === 'string' && allowedLineIds.includes(rawTargetLineId)
      ? rawTargetLineId
      : null;

  return { level: safeLevel, text: stripDashes(text), targetLineId };
}

export function parseAskResponse(rawText: string): AskResult {
  const obj = extractJsonObject(rawText);

  const answer = obj.answer;
  if (typeof answer !== 'string' || answer.trim().length === 0) {
    throw new Error('ask validation: answer must be a non-empty string');
  }

  return { answer: stripDashes(answer) };
}

export function parseExplainResponse(rawText: string): ExplainFeedbackResult {
  const obj = extractJsonObject(rawText);

  const feedback = obj.feedback;
  if (typeof feedback !== 'string' || feedback.trim().length === 0) {
    throw new Error('explain validation: feedback must be a non-empty string');
  }

  const isOnTrack = obj.isOnTrack;
  if (typeof isOnTrack !== 'boolean') {
    throw new Error('explain validation: isOnTrack must be a boolean');
  }

  return { feedback: stripDashes(feedback).trim(), isOnTrack };
}
