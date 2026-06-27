// Dev-only console helpers for repositioning the signed-in learner's progress
// while testing. Exposed on `window` in dev builds only (see main.tsx), so it is
// never shipped to production. Progress lives in one Firestore doc at
// `users/{uid}`; these write to it as the authenticated user.
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

declare global {
  interface Window {
    resetCoulombToLastScreen?: () => Promise<void>;
  }
}

// Put Coulomb's Law back to "in progress, on the last screen": remove it from the
// completed list and point its saved session at the final step (a large index is
// clamped to the last step on read).
async function resetCoulombToLastScreen(): Promise<void> {
  const user = auth?.currentUser;
  if (!db || !user) {
    console.error('[devReset] Sign in first — no authenticated Firestore.');
    return;
  }

  const ref = doc(db, 'users', user.uid);
  const snapshot = await getDoc(ref);
  const data = (snapshot.data() ?? {}) as Record<string, unknown>;

  const completed = Array.isArray(data.completedLessonIds) ? (data.completedLessonIds as string[]) : [];
  data.completedLessonIds = completed.filter((id) => id !== 'coulombs-law');

  const sessions =
    data.lessonSessions && typeof data.lessonSessions === 'object'
      ? (data.lessonSessions as Record<string, unknown>)
      : {};
  data.lessonSessions = {
    ...sessions,
    'coulombs-law': { stepIndex: 999, maxVisitedStepIndex: 999 },
  };

  if (data.completionDates && typeof data.completionDates === 'object') {
    delete (data.completionDates as Record<string, unknown>)['coulombs-law'];
  }
  data.lastOpenedLessonId = 'coulombs-law';

  await setDoc(ref, data);
  console.info('[devReset] Coulomb\u2019s Law reset to in-progress (last screen). Reloading\u2026');
  window.location.reload();
}

window.resetCoulombToLastScreen = resetCoulombToLastScreen;
