export type LessonSessionEntry = {
  stepIndex: number;
  maxVisitedStepIndex: number;
};

export type LessonSessionState = Record<string, LessonSessionEntry>;

export const EMPTY_SESSION_STATE: LessonSessionState = {};

function clampStepIndex(stepIndex: number, totalSteps: number) {
  if (!Number.isFinite(stepIndex) || totalSteps <= 0) {
    return 0;
  }

  return Math.min(Math.max(Math.trunc(stepIndex), 0), totalSteps - 1);
}

/**
 * Coerces an untrusted persisted value into a normalized session entry.
 * Accepts both the legacy numeric form and the `{ stepIndex, maxVisitedStepIndex }`
 * object form. Returns `null` when the value can't represent a step.
 */
function coerceEntry(value: unknown): LessonSessionEntry | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const stepIndex = Math.max(0, Math.trunc(value));
    return { stepIndex, maxVisitedStepIndex: stepIndex };
  }

  if (value && typeof value === 'object') {
    const candidate = value as { stepIndex?: unknown; maxVisitedStepIndex?: unknown };
    const hasStep = typeof candidate.stepIndex === 'number' && Number.isFinite(candidate.stepIndex);
    const hasMax =
      typeof candidate.maxVisitedStepIndex === 'number' && Number.isFinite(candidate.maxVisitedStepIndex);
    if (!hasStep && !hasMax) {
      return null;
    }

    const stepIndex = hasStep ? Math.max(0, Math.trunc(candidate.stepIndex as number)) : 0;
    const maxVisitedStepIndex = hasMax ? Math.max(0, Math.trunc(candidate.maxVisitedStepIndex as number)) : stepIndex;
    return { stepIndex, maxVisitedStepIndex: Math.max(stepIndex, maxVisitedStepIndex) };
  }

  return null;
}

/**
 * Normalizes an untrusted lesson-sessions object (e.g. a Firestore field) into a
 * safe {@link LessonSessionState}. Clamping to a lesson's step count happens in
 * the selectors below, where the total step count is known.
 */
export function normalizeLessonSessions(raw: unknown): LessonSessionState {
  if (!raw || typeof raw !== 'object') {
    return EMPTY_SESSION_STATE;
  }

  const normalized: LessonSessionState = {};
  for (const [lessonId, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof lessonId !== 'string') {
      continue;
    }
    const entry = coerceEntry(value);
    if (entry) {
      normalized[lessonId] = entry;
    }
  }

  return normalized;
}

export function selectLessonStepIndex(sessions: LessonSessionState, lessonId: string, totalSteps: number): number {
  const entry = sessions[lessonId];
  if (!entry) {
    return 0;
  }
  return clampStepIndex(entry.stepIndex, totalSteps);
}

export function selectVisitedStepCount(sessions: LessonSessionState, lessonId: string, totalSteps: number): number {
  if (totalSteps <= 0) {
    return 0;
  }

  const entry = sessions[lessonId];
  if (!entry) {
    return 1;
  }

  const stepIndex = clampStepIndex(entry.stepIndex, totalSteps);
  const maxVisitedStepIndex = Math.max(stepIndex, clampStepIndex(entry.maxVisitedStepIndex, totalSteps));
  return maxVisitedStepIndex + 1;
}

/**
 * Returns a new sessions map with `lessonId` advanced to `stepIndex` (tracking
 * the furthest-visited step). Returns the same reference when nothing changes so
 * callers can skip redundant cloud writes.
 */
export function mergeLessonStep(
  sessions: LessonSessionState,
  lessonId: string,
  stepIndex: number,
  totalSteps: number,
  maxVisitedStepIndex?: number,
): LessonSessionState {
  const existing = sessions[lessonId];
  const existingStepIndex = existing ? clampStepIndex(existing.stepIndex, totalSteps) : 0;
  const existingMaxVisited = existing
    ? Math.max(existingStepIndex, clampStepIndex(existing.maxVisitedStepIndex, totalSteps))
    : 0;

  const nextStepIndex = clampStepIndex(stepIndex, totalSteps);
  const requestedMaxVisited = clampStepIndex(
    typeof maxVisitedStepIndex === 'number' ? maxVisitedStepIndex : nextStepIndex,
    totalSteps,
  );
  const nextMaxVisited = Math.max(existingMaxVisited, nextStepIndex, requestedMaxVisited);

  if (existing && existing.stepIndex === nextStepIndex && existing.maxVisitedStepIndex === nextMaxVisited) {
    return sessions;
  }

  return {
    ...sessions,
    [lessonId]: { stepIndex: nextStepIndex, maxVisitedStepIndex: nextMaxVisited },
  };
}
