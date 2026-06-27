import type { MasteryMap, MisconceptionMastery } from '../mastery/types';
import type { MisconceptionGraph, MisconceptionNode } from '../mastery/misconceptionGraph';

export type LiveLesson = {
  lessonId: string;
  sequence: number;
  title: string;
};

export type ProblemAttempt = {
  attempts: number;
  solvedISO?: string;
  hintsUsed: number;
};

export type DashboardProgress = {
  completedLessonIds: string[];
  // Lesson ids whose post-lesson problem set the learner has finished. The set is
  // composed dynamically (template variants and generated review problems), so its
  // solved ids never match a fixed authored bank; this explicit marker is the
  // durable "set complete" signal that gates the next lesson.
  completedProblemSetIds: string[];
  completionDates: Record<string, string>;
  lastOpenedLessonId: string | null;
  answeredQuestionIds: string[];
  questionXp: number;
  dailyXp: Record<string, number>;
  misconceptions: MasteryMap;
  problemAttempts: Record<string, ProblemAttempt>;
  misconceptionGraph: MisconceptionGraph;
};

export const LIVE_LESSONS: LiveLesson[] = [
  {
    lessonId: 'coulombs-law',
    sequence: 1,
    title: "Coulomb's Law",
  },
  {
    lessonId: 'charging-conductors-insulators',
    sequence: 2,
    title: 'Charging, Conductors & Insulators',
  },
];

export const LIVE_LESSON_IDS = LIVE_LESSONS.map((lesson) => lesson.lessonId);
export const LIVE_LESSON_LIMIT = LIVE_LESSON_IDS.length;
export const XP_PER_LESSON = 120;
export const XP_PER_QUESTION = 10;
export const DAILY_XP_GOAL = 500;

export const EMPTY_PROGRESS: DashboardProgress = {
  completedLessonIds: [],
  completedProblemSetIds: [],
  completionDates: {},
  lastOpenedLessonId: null,
  answeredQuestionIds: [],
  questionXp: 0,
  dailyXp: {},
  misconceptions: {},
  problemAttempts: {},
  misconceptionGraph: {},
};

function toLocalDateStamp(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Whole calendar days from date stamp `from` to `to` (both YYYY-MM-DD). Computed
// in UTC so it stays exact across daylight saving boundaries: two local midnights
// can be 23 or 25 hours apart, which corrupts a milliseconds-per-day count and
// can drop or invent a day in a streak.
function calendarDaySpan(from: string, to: string): number {
  const [fromYear, fromMonth, fromDay] = from.split('-').map(Number);
  const [toYear, toMonth, toDay] = to.split('-').map(Number);
  return Math.round(
    (Date.UTC(toYear, toMonth - 1, toDay) - Date.UTC(fromYear, fromMonth - 1, fromDay)) / 86_400_000,
  );
}

export function normalizeCompletedLessonIds(lessonIds: string[]) {
  const completedSet = new Set(lessonIds);
  const normalized: string[] = [];

  for (const lessonId of LIVE_LESSON_IDS) {
    if (!completedSet.has(lessonId)) {
      break;
    }
    normalized.push(lessonId);
  }

  return normalized;
}

// Problem-set completion is not sequential (a learner can finish any unlocked
// lesson's set), so unlike completedLessonIds this keeps every valid live id,
// deduped, with no prefix or order constraint. Unknown or non-string ids drop.
function normalizeCompletedProblemSetIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const id of value) {
    if (typeof id === 'string' && LIVE_LESSON_IDS.includes(id)) {
      seen.add(id);
    }
  }
  return [...seen];
}

/** Mark a lesson's post-lesson problem set finished. Idempotent; live ids only. */
export function markProblemSetComplete(progress: DashboardProgress, setId: string): DashboardProgress {
  if (!LIVE_LESSON_IDS.includes(setId) || progress.completedProblemSetIds.includes(setId)) {
    return progress;
  }
  return {
    ...progress,
    completedProblemSetIds: [...progress.completedProblemSetIds, setId],
  };
}

function normalizeAnsweredQuestionIds(questionIds: string[]) {
  return [...new Set(questionIds)].filter((questionId) => {
    const [lessonId, stepToken] = questionId.split(':');
    const stepNumber = Number.parseInt(stepToken ?? '', 10);
    return LIVE_LESSON_IDS.includes(lessonId ?? '') && Number.isFinite(stepNumber) && stepNumber > 0;
  });
}

function questionProgressId(lessonId: string, stepNumber: number) {
  return `${lessonId}:${stepNumber}`;
}

/**
 * Normalizes an untrusted progress object (e.g. a Firestore document payload)
 * into a safe {@link DashboardProgress}. Invalid/missing fields fall back to the
 * empty defaults so corrupt cloud data can never crash the dashboard.
 */
export function normalizeProgress(raw: unknown): DashboardProgress {
  if (!raw || typeof raw !== 'object') {
    return EMPTY_PROGRESS;
  }

  try {
    const parsed = raw as Partial<DashboardProgress>;
    const completedLessonIds = normalizeCompletedLessonIds(
      Array.isArray(parsed.completedLessonIds)
        ? parsed.completedLessonIds.filter((lessonId): lessonId is string => typeof lessonId === 'string')
        : [],
    );

    const completedProblemSetIds = normalizeCompletedProblemSetIds(parsed.completedProblemSetIds);

    const completionDates =
      parsed.completionDates && typeof parsed.completionDates === 'object'
        ? Object.fromEntries(
            Object.entries(parsed.completionDates)
              .filter(([lessonId, dateStamp]) => LIVE_LESSON_IDS.includes(lessonId) && typeof dateStamp === 'string')
              .map(([lessonId, dateStamp]) => [lessonId, dateStamp.slice(0, 10)]),
          )
        : {};

    return {
      completedLessonIds,
      completedProblemSetIds,
      completionDates,
      lastOpenedLessonId:
        parsed.lastOpenedLessonId && LIVE_LESSON_IDS.includes(parsed.lastOpenedLessonId) ? parsed.lastOpenedLessonId : null,
      answeredQuestionIds: normalizeAnsweredQuestionIds(
        Array.isArray(parsed.answeredQuestionIds)
          ? parsed.answeredQuestionIds.filter((questionId): questionId is string => typeof questionId === 'string')
          : [],
      ),
      questionXp:
        typeof parsed.questionXp === 'number' && Number.isFinite(parsed.questionXp) && parsed.questionXp >= 0
          ? Math.trunc(parsed.questionXp)
          : 0,
      dailyXp: normalizeDailyXp(parsed.dailyXp),
      misconceptions: normalizeMisconceptions(parsed.misconceptions),
      problemAttempts: normalizeProblemAttempts(parsed.problemAttempts),
      misconceptionGraph: normalizeMisconceptionGraph(parsed.misconceptionGraph),
    };
  } catch {
    return EMPTY_PROGRESS;
  }
}

function normalizeDailyXp(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object') {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).filter(
      ([dateStamp, xp]) => typeof dateStamp === 'string' && typeof xp === 'number' && Number.isFinite(xp) && xp >= 0,
    ),
  ) as Record<string, number>;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Coerces one untrusted persisted entry into a {@link MisconceptionMastery}.
 * Returns null when any required field is missing or the wrong type so the
 * caller can drop the malformed entry. Values that pass are preserved verbatim
 * so a save then load round-trips exactly.
 */
function coerceMisconceptionMastery(value: unknown): MisconceptionMastery | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  if (
    !isFiniteNumber(candidate.caught) ||
    !isFiniteNumber(candidate.missed) ||
    !isFiniteNumber(candidate.strength) ||
    typeof candidate.lastSeenISO !== 'string'
  ) {
    return null;
  }

  return {
    caught: candidate.caught,
    missed: candidate.missed,
    strength: candidate.strength,
    lastSeenISO: candidate.lastSeenISO,
  };
}

/**
 * Normalizes an untrusted misconceptions field (e.g. a Firestore map) into a
 * safe {@link MasteryMap}. Missing or non-object input defaults to an empty map
 * (back-compatible with documents written before mastery tracking existed) and
 * malformed entries are dropped rather than throwing.
 */
function normalizeMisconceptions(value: unknown): MasteryMap {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const normalized: MasteryMap = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const mastery = coerceMisconceptionMastery(entry);
    if (mastery) {
      normalized[key] = mastery;
    }
  }

  return normalized;
}

/**
 * Coerces one untrusted persisted entry into a {@link ProblemAttempt}. Returns
 * null when `attempts` or `hintsUsed` are non-numeric, or when the optional
 * `solvedISO` is present but not a string, so the caller can drop the entry.
 */
function coerceProblemAttempt(value: unknown): ProblemAttempt | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  if (!isFiniteNumber(candidate.attempts) || !isFiniteNumber(candidate.hintsUsed)) {
    return null;
  }

  if (candidate.solvedISO !== undefined && typeof candidate.solvedISO !== 'string') {
    return null;
  }

  return candidate.solvedISO === undefined
    ? { attempts: candidate.attempts, hintsUsed: candidate.hintsUsed }
    : { attempts: candidate.attempts, hintsUsed: candidate.hintsUsed, solvedISO: candidate.solvedISO };
}

/**
 * Normalizes an untrusted problemAttempts field (e.g. a Firestore map) into a
 * safe record. Missing or non-object input defaults to an empty map and
 * malformed entries are dropped rather than throwing.
 */
function normalizeProblemAttempts(value: unknown): Record<string, ProblemAttempt> {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const normalized: Record<string, ProblemAttempt> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const attempt = coerceProblemAttempt(entry);
    if (attempt) {
      normalized[key] = attempt;
    }
  }

  return normalized;
}

function isNodeStatus(value: unknown): value is 'note' | 'tracked' {
  return value === 'note' || value === 'tracked';
}

/**
 * Coerces one untrusted persisted entry into a {@link MisconceptionNode}.
 * Returns null when any required field is missing or the wrong type so the
 * caller can drop the malformed entry. Values that pass are preserved verbatim
 * (the day stamps are copied into a fresh array) so a save then load round-trips
 * exactly.
 */
function coerceMisconceptionNode(value: unknown): MisconceptionNode | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const { id, status, principleId, wrongBelief, specificNote, caught, missed, strength, lastSeenISO, createdISO, caughtDayStamps } =
    candidate;

  if (
    typeof id !== 'string' ||
    !isNodeStatus(status) ||
    typeof principleId !== 'string' ||
    typeof wrongBelief !== 'string' ||
    typeof specificNote !== 'string' ||
    !isFiniteNumber(caught) ||
    !isFiniteNumber(missed) ||
    !isFiniteNumber(strength) ||
    typeof lastSeenISO !== 'string' ||
    typeof createdISO !== 'string' ||
    !Array.isArray(caughtDayStamps) ||
    !caughtDayStamps.every((stamp): stamp is string => typeof stamp === 'string')
  ) {
    return null;
  }

  return {
    id,
    status,
    principleId,
    wrongBelief,
    specificNote,
    caught,
    missed,
    strength,
    lastSeenISO,
    caughtDayStamps: [...caughtDayStamps],
    createdISO,
  };
}

/**
 * Normalizes an untrusted misconceptionGraph field (e.g. a Firestore map) into a
 * safe {@link MisconceptionGraph}. Missing or non-object input defaults to an
 * empty graph (back-compatible with documents written before the graph existed)
 * and malformed node entries are dropped rather than throwing.
 */
function normalizeMisconceptionGraph(value: unknown): MisconceptionGraph {
  if (!value || typeof value !== 'object') {
    return {};
  }

  const normalized: MisconceptionGraph = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const node = coerceMisconceptionNode(entry);
    if (node) {
      normalized[key] = node;
    }
  }

  return normalized;
}

function addDailyXp(dailyXp: Record<string, number>, amount: number, at: Date): Record<string, number> {
  const stamp = toLocalDateStamp(at);
  return {
    ...dailyXp,
    [stamp]: (dailyXp[stamp] ?? 0) + amount,
  };
}

export function xpEarnedToday(progress: DashboardProgress, at = new Date()): number {
  return progress.dailyXp[toLocalDateStamp(at)] ?? 0;
}

export function markLessonOpened(progress: DashboardProgress, lessonId: string): DashboardProgress {
  if (!LIVE_LESSON_IDS.includes(lessonId)) {
    return progress;
  }

  return {
    ...progress,
    lastOpenedLessonId: lessonId,
  };
}

export function markLessonCompleted(progress: DashboardProgress, lessonId: string, at = new Date()): DashboardProgress {
  const lessonIndex = LIVE_LESSON_IDS.indexOf(lessonId);
  if (lessonIndex < 0) {
    return progress;
  }

  const completedLessonIds = normalizeCompletedLessonIds(progress.completedLessonIds);
  const unlockedCount = Math.min(completedLessonIds.length + 1, LIVE_LESSON_LIMIT);
  if (lessonIndex >= unlockedCount || completedLessonIds.includes(lessonId)) {
    return progress;
  }

  const nextCompletedLessonIds = normalizeCompletedLessonIds([...completedLessonIds, lessonId]);
  return {
    completedLessonIds: nextCompletedLessonIds,
    completedProblemSetIds: progress.completedProblemSetIds,
    completionDates: {
      ...progress.completionDates,
      [lessonId]: toLocalDateStamp(at),
    },
    lastOpenedLessonId: progress.lastOpenedLessonId,
    answeredQuestionIds: progress.answeredQuestionIds,
    questionXp: progress.questionXp,
    dailyXp: addDailyXp(progress.dailyXp, XP_PER_LESSON, at),
    misconceptions: progress.misconceptions,
    problemAttempts: progress.problemAttempts,
    misconceptionGraph: progress.misconceptionGraph,
  };
}

export function markQuestionAnswered(
  progress: DashboardProgress,
  lessonId: string,
  stepNumber: number,
  at = new Date(),
): { nextProgress: DashboardProgress; awardedXp: number } {
  if (!LIVE_LESSON_IDS.includes(lessonId)) {
    return {
      nextProgress: progress,
      awardedXp: 0,
    };
  }

  if (!Number.isFinite(stepNumber) || stepNumber < 1) {
    return {
      nextProgress: progress,
      awardedXp: 0,
    };
  }

  const questionId = questionProgressId(lessonId, Math.trunc(stepNumber));
  if (progress.answeredQuestionIds.includes(questionId)) {
    return {
      nextProgress: progress,
      awardedXp: 0,
    };
  }

  return {
    nextProgress: {
      ...progress,
      answeredQuestionIds: [...progress.answeredQuestionIds, questionId],
      questionXp: progress.questionXp + XP_PER_QUESTION,
      dailyXp: addDailyXp(progress.dailyXp, XP_PER_QUESTION, at),
    },
    awardedXp: XP_PER_QUESTION,
  };
}

export function calculateStreakDays(
  progress: Pick<DashboardProgress, 'completionDates' | 'dailyXp'>,
  now: Date = new Date(),
) {
  // A day counts toward the streak if a lesson was completed that day or the
  // daily XP goal was reached (or surpassed) that day.
  const qualifyingDays = new Set<string>(Object.values(progress.completionDates));
  for (const [day, xp] of Object.entries(progress.dailyXp)) {
    if (xp >= DAILY_XP_GOAL) {
      qualifyingDays.add(day);
    }
  }

  const uniqueDays = [...qualifyingDays].sort();
  if (uniqueDays.length === 0) {
    return 0;
  }

  // The streak is live only if the most recent qualifying day was today or
  // yesterday; a gap of two or more days breaks it.
  const todayStamp = toLocalDateStamp(now);
  const latest = uniqueDays[uniqueDays.length - 1]!;
  if (calendarDaySpan(latest, todayStamp) > 1) {
    return 0;
  }

  let streak = 1;
  for (let index = uniqueDays.length - 2; index >= 0; index -= 1) {
    if (calendarDaySpan(uniqueDays[index]!, uniqueDays[index + 1]!) !== 1) {
      break;
    }
    streak += 1;
  }

  return streak;
}
