import type { InkPoint, Stroke } from '../components/problem/inkGeometry';
import type { Viewport } from '../components/problem/inkViewport';
import type { GradeResult, HintResult } from '../lib/grading';

// The persisted working state of a problem set, so a student who exits mid set
// returns to the same problem with their handwriting and feedback intact. Stored
// in the user's cloud document alongside lesson sessions.

// Only terminal phases are persisted. The transient 'grading'/'error' phases of
// the live player collapse to 'solving' before they are written, so a resumed
// problem never reopens stuck in a pending grade.
export type ProblemPhase = 'solving' | 'incorrect' | 'correct';

export type ProblemWork = {
  strokes: Stroke[];
  viewport: Viewport;
  phase: ProblemPhase;
  attempts: number;
  hintTier: 0 | 1 | 2;
  hintsUsed: number;
  result: GradeResult | null;
  hint: HintResult | null;
  recorded: boolean;
};

export type ProblemSetSession = {
  index: number;
  visitedCount: number;
  solvedProblemIds: string[];
  problemIds: string[];
  work: Record<string, ProblemWork>;
};

// Keyed by set id (the lesson id for a post lesson set).
export type ProblemSessionState = Record<string, ProblemSetSession>;

export const EMPTY_PROBLEM_SESSION_STATE: ProblemSessionState = {};

const IDENTITY_VIEWPORT: Viewport = { scale: 1, tx: 0, ty: 0 };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function finiteOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function nonNegativeInt(value: unknown, fallback: number): number {
  return Math.max(0, Math.trunc(finiteOr(value, fallback)));
}

function clampTier(value: unknown): 0 | 1 | 2 {
  const tier = Math.trunc(finiteOr(value, 0));
  if (tier <= 0) return 0;
  if (tier >= 2) return 2;
  return 1;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function coerceViewport(value: unknown): Viewport {
  if (!isObject(value)) return { ...IDENTITY_VIEWPORT };
  const scale = finiteOr(value.scale, 1);
  return {
    scale: scale > 0 ? scale : 1,
    tx: finiteOr(value.tx, 0),
    ty: finiteOr(value.ty, 0),
  };
}

function coercePoint(value: unknown): InkPoint | null {
  if (!isObject(value)) return null;
  if (typeof value.x !== 'number' || typeof value.y !== 'number') return null;
  if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) return null;
  return { x: value.x, y: value.y, p: finiteOr(value.p, 0.5), t: finiteOr(value.t, 0) };
}

function coerceStroke(value: unknown): Stroke | null {
  if (!isObject(value)) return null;
  const id = stringOrNull(value.id);
  if (!id || !Array.isArray(value.points)) return null;

  const points: InkPoint[] = [];
  for (const raw of value.points) {
    const point = coercePoint(raw);
    if (point) points.push(point);
  }
  if (points.length === 0) return null;

  return { id, points };
}

function coerceStrokes(value: unknown): Stroke[] {
  if (!Array.isArray(value)) return [];
  const strokes: Stroke[] = [];
  for (const raw of value) {
    const stroke = coerceStroke(raw);
    if (stroke) strokes.push(stroke);
  }
  return strokes;
}

function coerceGradeResult(value: unknown): GradeResult | null {
  if (!isObject(value) || typeof value.isCorrect !== 'boolean') return null;
  const result: GradeResult = {
    isCorrect: value.isCorrect,
    transcribedSteps: stringArray(value.transcribedSteps),
    firstErrorLineId: stringOrNull(value.firstErrorLineId),
    misconceptionId: stringOrNull(value.misconceptionId),
    explanation: typeof value.explanation === 'string' ? value.explanation : '',
  };
  if (Array.isArray(value.correctSolution)) {
    result.correctSolution = stringArray(value.correctSolution);
  }
  return result;
}

function coerceHintResult(value: unknown): HintResult | null {
  if (!isObject(value) || typeof value.text !== 'string') return null;
  return { tier: clampTier(value.tier), text: value.text, targetLineId: stringOrNull(value.targetLineId) };
}

function coercePhase(value: unknown): ProblemPhase {
  return value === 'incorrect' || value === 'correct' ? value : 'solving';
}

function coerceWork(value: unknown): ProblemWork | null {
  if (!isObject(value)) return null;
  return {
    strokes: coerceStrokes(value.strokes),
    viewport: coerceViewport(value.viewport),
    phase: coercePhase(value.phase),
    attempts: nonNegativeInt(value.attempts, 0),
    hintTier: clampTier(value.hintTier),
    hintsUsed: nonNegativeInt(value.hintsUsed, 0),
    result: coerceGradeResult(value.result),
    hint: coerceHintResult(value.hint),
    recorded: value.recorded === true,
  };
}

function coerceSetSession(value: unknown): ProblemSetSession | null {
  if (!isObject(value)) return null;

  const work: Record<string, ProblemWork> = {};
  if (isObject(value.work)) {
    for (const [problemId, raw] of Object.entries(value.work)) {
      const entry = coerceWork(raw);
      if (entry) work[problemId] = entry;
    }
  }

  const index = nonNegativeInt(value.index, 0);
  const visitedCount = Math.max(nonNegativeInt(value.visitedCount, 1), index + 1, 1);
  return {
    index,
    visitedCount,
    solvedProblemIds: stringArray(value.solvedProblemIds),
    problemIds: stringArray(value.problemIds),
    work,
  };
}

/**
 * Coerces an untrusted persisted value (e.g. a Firestore field) into a safe
 * {@link ProblemSessionState}. Malformed sets and problems are dropped rather
 * than throwing, matching the lesson session loader.
 */
export function normalizeProblemSessions(raw: unknown): ProblemSessionState {
  if (!isObject(raw)) return EMPTY_PROBLEM_SESSION_STATE;

  const normalized: ProblemSessionState = {};
  for (const [setId, value] of Object.entries(raw)) {
    const session = coerceSetSession(value);
    if (session) normalized[setId] = session;
  }
  return normalized;
}

export function selectProblemSetSession(
  sessions: ProblemSessionState,
  setId: string,
): ProblemSetSession | null {
  return sessions[setId] ?? null;
}

/**
 * Returns a new sessions map with `setId` set to `session`. The session is run
 * through a JSON round trip so it never carries an `undefined` value (e.g. an
 * absent `correctSolution`) that the Firestore SDK would reject.
 */
export function mergeProblemSetSession(
  sessions: ProblemSessionState,
  setId: string,
  session: ProblemSetSession,
): ProblemSessionState {
  const safe = JSON.parse(JSON.stringify(session)) as ProblemSetSession;
  return { ...sessions, [setId]: safe };
}

export function removeProblemSetSession(
  sessions: ProblemSessionState,
  setId: string,
): ProblemSessionState {
  if (!(setId in sessions)) return sessions;
  const { [setId]: _removed, ...rest } = sessions;
  return rest;
}
