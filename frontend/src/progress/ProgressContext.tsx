import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '../auth/AuthContext';
import {
  DAILY_XP_GOAL,
  LIVE_LESSON_LIMIT,
  XP_PER_LESSON,
  calculateStreakDays,
  markLessonCompleted,
  markLessonOpened as applyMarkLessonOpened,
  markProblemSetComplete as applyMarkProblemSetComplete,
  markQuestionAnswered,
  xpEarnedToday,
  type DashboardProgress,
  type ProblemAttempt,
} from './dashboardProgress';
import { recordGradedAttempt } from '../mastery/masteryModel';
import { applyCatch, applyConceptMiss, type ConceptMatch } from '../mastery/misconceptionGraph';
import {
  mergeLessonStep,
  selectLessonStepIndex,
  selectVisitedStepCount,
  type LessonSessionState,
} from './lessonSessionProgress';
import {
  mergeProblemSetSession,
  removeProblemSetSession,
  selectProblemSetSession,
  type ProblemSetSession,
} from './problemSessionProgress';
import {
  EMPTY_CLOUD_STATE,
  saveUserCloudState,
  subscribeUserCloudState,
  type UserCloudState,
} from './cloudStore';

type ProgressContextValue = {
  progress: DashboardProgress;
  lessonSessions: LessonSessionState;
  isLoading: boolean;
  totalXp: number;
  todayXp: number;
  dailyGoal: number;
  completedCount: number;
  lessonLimit: number;
  streakDays: number;
  markLessonOpened: (lessonId: string) => void;
  completeLesson: (lessonId: string) => number;
  answerQuestion: (lessonId: string, stepNumber: number) => number;
  getLessonStepIndex: (lessonId: string, totalSteps: number) => number;
  getVisitedStepCount: (lessonId: string, totalSteps: number) => number;
  setLessonStep: (lessonId: string, stepIndex: number, totalSteps: number, maxVisitedStepIndex?: number) => void;
  getProblemSetSession: (setId: string) => ProblemSetSession | null;
  saveProblemSetSession: (setId: string, session: ProblemSetSession) => void;
  clearProblemSetSession: (setId: string) => void;
  markProblemSetComplete: (setId: string) => void;
  recordProblemResult: (input: {
    problemId: string;
    misconceptionIds: string[];
    caught: boolean;
    solved: boolean;
    hintsUsed: number;
    attempts?: number;
  }) => void;
  recordConceptMiss: (match: ConceptMatch) => void;
  recordNodeCatch: (nodeId: string) => void;
};

const ProgressContext = createContext<ProgressContextValue | null>(null);

export function ProgressProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useAuth();
  const userId = currentUser?.uid ?? null;

  const [state, setState] = useState<UserCloudState>(EMPTY_CLOUD_STATE);
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(userId));
  const stateRef = useRef<UserCloudState>(state);
  stateRef.current = state;

  useEffect(() => {
    if (!userId) {
      stateRef.current = EMPTY_CLOUD_STATE;
      setState(EMPTY_CLOUD_STATE);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const unsubscribe = subscribeUserCloudState(
      userId,
      (next) => {
        stateRef.current = next;
        setState(next);
        setIsLoading(false);
      },
      (error) => {
        console.error('Failed to load cloud progress', error);
        setIsLoading(false);
      },
    );

    return unsubscribe;
  }, [userId]);

  // Optimistically updates in-memory state and mirrors the change to Firestore.
  const applyAndPersist = useCallback(
    (produce: (previous: UserCloudState) => UserCloudState) => {
      const previous = stateRef.current;
      const next = produce(previous);
      if (next === previous) {
        return previous;
      }

      stateRef.current = next;
      setState(next);

      if (userId) {
        void saveUserCloudState(userId, next).catch((error) => {
          console.error('Failed to save cloud progress', error);
        });
      }

      return next;
    },
    [userId],
  );

  const markLessonOpened = useCallback(
    (lessonId: string) => {
      applyAndPersist((previous) => {
        const nextProgress = applyMarkLessonOpened(previous.progress, lessonId);
        if (nextProgress === previous.progress) {
          return previous;
        }
        return { ...previous, progress: nextProgress };
      });
    },
    [applyAndPersist],
  );

  const completeLesson = useCallback(
    (lessonId: string) => {
      let awardedXp = 0;
      applyAndPersist((previous) => {
        const nextProgress = markLessonCompleted(previous.progress, lessonId);
        awardedXp =
          (nextProgress.completedLessonIds.length - previous.progress.completedLessonIds.length) * XP_PER_LESSON;
        // Keep the lesson session so re-entering a finished lesson resumes on the
        // page the learner was last on instead of resetting to the first screen.
        if (nextProgress === previous.progress) {
          return previous;
        }
        return { ...previous, progress: nextProgress };
      });
      return awardedXp;
    },
    [applyAndPersist],
  );

  const answerQuestion = useCallback(
    (lessonId: string, stepNumber: number) => {
      let awardedXp = 0;
      applyAndPersist((previous) => {
        const result = markQuestionAnswered(previous.progress, lessonId, stepNumber);
        awardedXp = result.awardedXp;
        if (result.awardedXp <= 0) {
          return previous;
        }
        return { ...previous, progress: result.nextProgress };
      });
      return awardedXp;
    },
    [applyAndPersist],
  );

  const setLessonStep = useCallback(
    (lessonId: string, stepIndex: number, totalSteps: number, maxVisitedStepIndex?: number) => {
      applyAndPersist((previous) => {
        const nextSessions = mergeLessonStep(
          previous.lessonSessions,
          lessonId,
          stepIndex,
          totalSteps,
          maxVisitedStepIndex,
        );
        if (nextSessions === previous.lessonSessions) {
          return previous;
        }
        return { ...previous, lessonSessions: nextSessions };
      });
    },
    [applyAndPersist],
  );

  const recordProblemResult = useCallback(
    (input: {
      problemId: string;
      misconceptionIds: string[];
      caught: boolean;
      solved: boolean;
      hintsUsed: number;
      attempts?: number;
    }) => {
      const { problemId, misconceptionIds, caught, solved, hintsUsed, attempts } = input;
      const now = new Date();

      applyAndPersist((previous) => {
        // Credit every misconception the problem exercises. A correct grade is a
        // catch on each of them; a miss decays each of them. Dedupe so a tag that
        // appears twice on one problem is not double counted in a single result.
        const uniqueMisconceptionIds = [...new Set(misconceptionIds)];
        const nextMisconceptions = uniqueMisconceptionIds.reduce(
          (map, id) => recordGradedAttempt(map, id, caught, now),
          previous.progress.misconceptions,
        );

        const priorAttempt = previous.progress.problemAttempts[problemId];
        const nextSolvedISO = solved ? (priorAttempt?.solvedISO ?? now.toISOString()) : priorAttempt?.solvedISO;
        const nextAttempt: ProblemAttempt = {
          attempts: (priorAttempt?.attempts ?? 0) + (attempts ?? 1),
          hintsUsed: (priorAttempt?.hintsUsed ?? 0) + hintsUsed,
          // Omit solvedISO entirely when there is no solve time so the persisted
          // document never carries an undefined value (matches the loader shape).
          ...(nextSolvedISO !== undefined ? { solvedISO: nextSolvedISO } : {}),
        };

        return {
          ...previous,
          progress: {
            ...previous.progress,
            misconceptions: nextMisconceptions,
            problemAttempts: {
              ...previous.progress.problemAttempts,
              [problemId]: nextAttempt,
            },
          },
        };
      });
    },
    [applyAndPersist],
  );

  const recordConceptMiss = useCallback(
    (match: ConceptMatch) => {
      const now = new Date();
      applyAndPersist((previous) => {
        const nextGraph = applyConceptMiss(previous.progress.misconceptionGraph, match, now);
        if (nextGraph === previous.progress.misconceptionGraph) {
          return previous;
        }
        return {
          ...previous,
          progress: { ...previous.progress, misconceptionGraph: nextGraph },
        };
      });
    },
    [applyAndPersist],
  );

  const recordNodeCatch = useCallback(
    (nodeId: string) => {
      const now = new Date();
      applyAndPersist((previous) => {
        const nextGraph = applyCatch(previous.progress.misconceptionGraph, nodeId, now);
        if (nextGraph === previous.progress.misconceptionGraph) {
          return previous;
        }
        return {
          ...previous,
          progress: { ...previous.progress, misconceptionGraph: nextGraph },
        };
      });
    },
    [applyAndPersist],
  );

  const getLessonStepIndex = useCallback(
    (lessonId: string, totalSteps: number) => selectLessonStepIndex(stateRef.current.lessonSessions, lessonId, totalSteps),
    [],
  );

  const getVisitedStepCount = useCallback(
    (lessonId: string, totalSteps: number) =>
      selectVisitedStepCount(stateRef.current.lessonSessions, lessonId, totalSteps),
    [],
  );

  const getProblemSetSession = useCallback(
    (setId: string) => selectProblemSetSession(stateRef.current.problemSessions, setId),
    [],
  );

  const saveProblemSetSession = useCallback(
    (setId: string, session: ProblemSetSession) => {
      applyAndPersist((previous) => {
        const nextSessions = mergeProblemSetSession(previous.problemSessions, setId, session);
        if (nextSessions === previous.problemSessions) {
          return previous;
        }
        return { ...previous, problemSessions: nextSessions };
      });
    },
    [applyAndPersist],
  );

  const clearProblemSetSession = useCallback(
    (setId: string) => {
      applyAndPersist((previous) => {
        const nextSessions = removeProblemSetSession(previous.problemSessions, setId);
        if (nextSessions === previous.problemSessions) {
          return previous;
        }
        return { ...previous, problemSessions: nextSessions };
      });
    },
    [applyAndPersist],
  );

  const markProblemSetComplete = useCallback(
    (setId: string) => {
      applyAndPersist((previous) => {
        const nextProgress = applyMarkProblemSetComplete(previous.progress, setId);
        if (nextProgress === previous.progress) {
          return previous;
        }
        return { ...previous, progress: nextProgress };
      });
    },
    [applyAndPersist],
  );

  const value = useMemo<ProgressContextValue>(() => {
    const completedCount = state.progress.completedLessonIds.length;
    return {
      progress: state.progress,
      lessonSessions: state.lessonSessions,
      isLoading,
      completedCount,
      lessonLimit: LIVE_LESSON_LIMIT,
      totalXp: completedCount * XP_PER_LESSON + state.progress.questionXp,
      todayXp: xpEarnedToday(state.progress),
      dailyGoal: DAILY_XP_GOAL,
      streakDays: calculateStreakDays(state.progress),
      markLessonOpened,
      completeLesson,
      answerQuestion,
      getLessonStepIndex,
      getVisitedStepCount,
      setLessonStep,
      getProblemSetSession,
      saveProblemSetSession,
      clearProblemSetSession,
      markProblemSetComplete,
      recordProblemResult,
      recordConceptMiss,
      recordNodeCatch,
    };
  }, [
    state,
    isLoading,
    markLessonOpened,
    completeLesson,
    answerQuestion,
    getLessonStepIndex,
    getVisitedStepCount,
    setLessonStep,
    getProblemSetSession,
    saveProblemSetSession,
    clearProblemSetSession,
    markProblemSetComplete,
    recordProblemResult,
    recordConceptMiss,
    recordNodeCatch,
  ]);

  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>;
}

export function useProgress(): ProgressContextValue {
  const context = useContext(ProgressContext);
  if (!context) {
    throw new Error('useProgress must be used inside ProgressProvider.');
  }

  return context;
}
