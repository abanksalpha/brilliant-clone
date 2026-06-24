export type LiveLesson = {
  lessonId: string;
  sequence: number;
  title: string;
};

export type DashboardProgress = {
  completedLessonIds: string[];
  completionDates: Record<string, string>;
  lastOpenedLessonId: string | null;
  answeredQuestionIds: string[];
  questionXp: number;
  dailyXp: Record<string, number>;
};

export const LIVE_LESSONS: LiveLesson[] = [
  {
    lessonId: 'coulombs-law',
    sequence: 1,
    title: "Coulomb's Law",
  },
];

export const LIVE_LESSON_IDS = LIVE_LESSONS.map((lesson) => lesson.lessonId);
export const LIVE_LESSON_LIMIT = LIVE_LESSON_IDS.length;
export const XP_PER_LESSON = 120;
export const XP_PER_QUESTION = 10;
export const DAILY_XP_GOAL = 500;

export const EMPTY_PROGRESS: DashboardProgress = {
  completedLessonIds: [],
  completionDates: {},
  lastOpenedLessonId: null,
  answeredQuestionIds: [],
  questionXp: 0,
  dailyXp: {},
};

function toLocalDateStamp(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function fromDateStamp(dateStamp: string) {
  return new Date(`${dateStamp}T00:00:00`);
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
    completionDates: {
      ...progress.completionDates,
      [lessonId]: toLocalDateStamp(at),
    },
    lastOpenedLessonId: progress.lastOpenedLessonId,
    answeredQuestionIds: progress.answeredQuestionIds,
    questionXp: progress.questionXp,
    dailyXp: addDailyXp(progress.dailyXp, XP_PER_LESSON, at),
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

export function calculateStreakDays(completionDates: Record<string, string>) {
  const uniqueDays = [...new Set(Object.values(completionDates))].sort();
  if (uniqueDays.length === 0) {
    return 0;
  }

  const today = fromDateStamp(toLocalDateStamp(new Date()));
  const latestCompletion = fromDateStamp(uniqueDays[uniqueDays.length - 1]!);
  const daySpanSinceLatest = Math.floor((today.getTime() - latestCompletion.getTime()) / 86_400_000);
  if (daySpanSinceLatest > 1) {
    return 0;
  }

  let streak = 1;
  for (let index = uniqueDays.length - 2; index >= 0; index -= 1) {
    const previous = fromDateStamp(uniqueDays[index]!);
    const next = fromDateStamp(uniqueDays[index + 1]!);
    const daySpan = Math.floor((next.getTime() - previous.getTime()) / 86_400_000);

    if (daySpan !== 1) {
      break;
    }
    streak += 1;
  }

  return streak;
}
