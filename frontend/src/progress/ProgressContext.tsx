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
  markQuestionAnswered,
  xpEarnedToday,
  type DashboardProgress,
} from './dashboardProgress';
import {
  mergeLessonStep,
  removeLessonSession,
  selectLessonStepIndex,
  selectVisitedStepCount,
  type LessonSessionState,
} from './lessonSessionProgress';
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
        const nextSessions = removeLessonSession(previous.lessonSessions, lessonId);
        if (nextProgress === previous.progress && nextSessions === previous.lessonSessions) {
          return previous;
        }
        return { progress: nextProgress, lessonSessions: nextSessions };
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

  const getLessonStepIndex = useCallback(
    (lessonId: string, totalSteps: number) => selectLessonStepIndex(stateRef.current.lessonSessions, lessonId, totalSteps),
    [],
  );

  const getVisitedStepCount = useCallback(
    (lessonId: string, totalSteps: number) =>
      selectVisitedStepCount(stateRef.current.lessonSessions, lessonId, totalSteps),
    [],
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
      streakDays: calculateStreakDays(state.progress.completionDates),
      markLessonOpened,
      completeLesson,
      answerQuestion,
      getLessonStepIndex,
      getVisitedStepCount,
      setLessonStep,
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
