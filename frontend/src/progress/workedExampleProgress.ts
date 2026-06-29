import type { ExplainFeedbackResult } from '../lib/grading';

// The persisted working state of a Phase 4 worked example, so a learner who
// leaves the lesson tab mid-rung returns with the steps they had uncovered, the
// self-explanation they were typing, and the AI feedback they had received
// intact. Stored in the user's cloud document alongside lesson and problem-set
// sessions.

export type WorkedExampleSession = {
  // How many solution steps have been uncovered. A worked example always shows
  // at least its first step, so this is clamped to a positive integer.
  revealedCount: number;
  // The learner's in-progress self-explanation.
  explanation: string;
  // The last resolved AI feedback, or null before any check. The transient
  // "checking" (feedbackPending) state is never persisted.
  feedback: ExplainFeedbackResult | null;
  // A soft, student-friendly error from the last failed check (an AI outage must
  // never trap the learner), or null when the last check succeeded / none ran.
  feedbackError: string | null;
  // Whether the explanation has been checked at least once; drives the
  // "Check again" label when the rung is resumed.
  checked: boolean;
};

// Keyed by rung id ("<lessonId>:apply:<index>").
export type WorkedExampleSessionState = Record<string, WorkedExampleSession>;

export const EMPTY_WORKED_EXAMPLE_SESSION_STATE: WorkedExampleSessionState = {};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function finiteOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

// A worked example always shows at least its first step, so a bad or absent
// revealedCount clamps up to 1 rather than to 0.
function positiveInt(value: unknown, fallback: number): number {
  return Math.max(1, Math.trunc(finiteOr(value, fallback)));
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function coerceFeedback(value: unknown): ExplainFeedbackResult | null {
  if (!isObject(value)) return null;
  if (typeof value.isOnTrack !== 'boolean' || typeof value.feedback !== 'string') return null;
  return { isOnTrack: value.isOnTrack, feedback: value.feedback };
}

/**
 * Coerces an untrusted persisted value into a safe {@link WorkedExampleSession},
 * or null when it is not even an object. Malformed fields fall back to safe
 * defaults rather than throwing, matching the problem-set session loader; the
 * transient feedbackPending flag is dropped entirely.
 */
export function normalizeWorkedExampleSession(value: unknown): WorkedExampleSession | null {
  if (!isObject(value)) return null;
  return {
    revealedCount: positiveInt(value.revealedCount, 1),
    explanation: typeof value.explanation === 'string' ? value.explanation : '',
    feedback: coerceFeedback(value.feedback),
    feedbackError: stringOrNull(value.feedbackError),
    checked: value.checked === true,
  };
}

/**
 * Coerces an untrusted persisted map (e.g. a Firestore field) into a safe
 * {@link WorkedExampleSessionState}. Malformed entries are dropped rather than
 * throwing, matching the problem-set session loader.
 */
export function normalizeWorkedExampleSessions(raw: unknown): WorkedExampleSessionState {
  if (!isObject(raw)) return EMPTY_WORKED_EXAMPLE_SESSION_STATE;

  const normalized: WorkedExampleSessionState = {};
  for (const [key, value] of Object.entries(raw)) {
    const session = normalizeWorkedExampleSession(value);
    if (session) normalized[key] = session;
  }
  return normalized;
}

export function selectWorkedExampleSession(
  sessions: WorkedExampleSessionState,
  key: string,
): WorkedExampleSession | null {
  return sessions[key] ?? null;
}

/**
 * Returns a new sessions map with `key` set to `session`. The session is run
 * through a JSON round trip so it never carries an `undefined` value that the
 * Firestore SDK would reject (an absent feedback collapses to null on reload).
 */
export function mergeWorkedExampleSession(
  sessions: WorkedExampleSessionState,
  key: string,
  session: WorkedExampleSession,
): WorkedExampleSessionState {
  const safe = JSON.parse(JSON.stringify(session)) as WorkedExampleSession;
  return { ...sessions, [key]: safe };
}

export function removeWorkedExampleSession(
  sessions: WorkedExampleSessionState,
  key: string,
): WorkedExampleSessionState {
  if (!(key in sessions)) return sessions;
  const { [key]: _removed, ...rest } = sessions;
  return rest;
}
