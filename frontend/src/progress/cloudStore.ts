import { deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { EMPTY_PROGRESS, normalizeProgress, type DashboardProgress } from './dashboardProgress';
import {
  EMPTY_SESSION_STATE,
  normalizeLessonSessions,
  type LessonSessionState,
} from './lessonSessionProgress';

/**
 * The complete cloud-backed state for a single learner. Persisted as one
 * Firestore document at `users/{uid}` so progress, XP, streak, and in-lesson
 * position follow the account across devices and sessions.
 */
export type UserCloudState = {
  progress: DashboardProgress;
  lessonSessions: LessonSessionState;
};

export const EMPTY_CLOUD_STATE: UserCloudState = {
  progress: EMPTY_PROGRESS,
  lessonSessions: EMPTY_SESSION_STATE,
};

const USERS_COLLECTION = 'users';

function userDocRef(userId: string) {
  if (!db) {
    throw new Error('Firestore is not configured.');
  }
  return doc(db, USERS_COLLECTION, userId);
}

function toCloudState(raw: unknown): UserCloudState {
  const data = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    progress: normalizeProgress(data),
    lessonSessions: normalizeLessonSessions(data.lessonSessions),
  };
}

/** Serializes in-memory state into the exact Firestore document shape. */
function toDocument(state: UserCloudState): Record<string, unknown> {
  return {
    completedLessonIds: state.progress.completedLessonIds,
    completionDates: state.progress.completionDates,
    lastOpenedLessonId: state.progress.lastOpenedLessonId,
    answeredQuestionIds: state.progress.answeredQuestionIds,
    questionXp: state.progress.questionXp,
    dailyXp: state.progress.dailyXp,
    lessonSessions: state.lessonSessions,
  };
}

/**
 * Subscribes to the user's cloud document and reports normalized state on every
 * change (including remote updates from other devices). Returns an unsubscribe
 * function. When Firestore is unconfigured it reports empty state once.
 */
export function subscribeUserCloudState(
  userId: string,
  onChange: (state: UserCloudState) => void,
  onError?: (error: Error) => void,
): () => void {
  if (!db) {
    onChange(EMPTY_CLOUD_STATE);
    return () => {};
  }

  return onSnapshot(
    userDocRef(userId),
    (snapshot) => {
      onChange(snapshot.exists() ? toCloudState(snapshot.data()) : EMPTY_CLOUD_STATE);
    },
    (error) => {
      onError?.(error);
    },
  );
}

/** Writes the full state to the user's cloud document (overwrites, no merge). */
export async function saveUserCloudState(userId: string, state: UserCloudState): Promise<void> {
  if (!db) {
    return;
  }
  await setDoc(userDocRef(userId), toDocument(state));
}

/** Deletes the user's cloud document, resetting all progress/XP/streak. */
export async function resetUserCloudState(userId: string): Promise<void> {
  if (!db) {
    return;
  }
  await deleteDoc(userDocRef(userId));
}
