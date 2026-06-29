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
  // The escalating hints given so far, in order. Length is both the count used
  // and the next hint's level; there is no ceiling.
  hints: HintResult[];
  result: GradeResult | null;
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
  // `level` is the current field; `tier` is the legacy name from the 3-tier era.
  return {
    level: nonNegativeInt(value.level ?? value.tier, 0),
    text: value.text,
    targetLineId: stringOrNull(value.targetLineId),
  };
}

function coerceHints(value: Record<string, unknown>): HintResult[] {
  if (Array.isArray(value.hints)) {
    const hints: HintResult[] = [];
    for (const raw of value.hints) {
      const hint = coerceHintResult(raw);
      if (hint) hints.push(hint);
    }
    return hints;
  }
  // Back-compat with the old single-hint shape (one `hint` plus `hintTier`).
  const legacy = coerceHintResult(value.hint);
  return legacy ? [legacy] : [];
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
    hints: coerceHints(value),
    result: coerceGradeResult(value.result),
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

// Round a captured sample to a fixed number of decimals, normalizing a -0 to 0
// so a rounded zero stays a plain 0 in the persisted document.
function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  const rounded = Math.round(value * factor) / factor;
  return rounded === 0 ? 0 : rounded;
}

// Shrink a stroke to the precision persistence actually needs. The live canvas
// captures full double-precision pointer samples (about 17 significant digits
// per coordinate) plus a high-resolution capture timestamp, but redrawing
// resumed work only needs sub-pixel geometry and a coarse pressure. Storing the
// raw samples makes a dense page serialize several times larger than necessary.
function compactStroke(stroke: Stroke): Stroke {
  return {
    id: stroke.id,
    points: stroke.points.map((point) => ({
      x: roundTo(point.x, 2),
      y: roundTo(point.y, 2),
      p: roundTo(point.p, 2),
      t: Math.round(point.t),
    })),
  };
}

/**
 * Returns a new sessions map with `setId` set to `session`. The session is run
 * through a JSON round trip so it never carries an `undefined` value (e.g. an
 * absent `correctSolution`) that the Firestore SDK would reject, and its strokes
 * are compacted to sub-pixel precision. The whole learner state is persisted as
 * one Firestore document with a hard 1 MiB limit; raw full-precision handwriting
 * pushes a dense page past that limit, and Firestore silently rolls the rejected
 * write back, so the work is lost on return. Compacting keeps it well under.
 */
export function mergeProblemSetSession(
  sessions: ProblemSessionState,
  setId: string,
  session: ProblemSetSession,
): ProblemSessionState {
  const safe = JSON.parse(JSON.stringify(session)) as ProblemSetSession;
  const work: Record<string, ProblemWork> = {};
  for (const [problemId, entry] of Object.entries(safe.work)) {
    work[problemId] = { ...entry, strokes: entry.strokes.map(compactStroke) };
  }
  return { ...sessions, [setId]: { ...safe, work } };
}

export function removeProblemSetSession(
  sessions: ProblemSessionState,
  setId: string,
): ProblemSessionState {
  if (!(setId in sessions)) return sessions;
  const { [setId]: _removed, ...rest } = sessions;
  return rest;
}
