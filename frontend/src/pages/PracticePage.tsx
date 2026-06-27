import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { buildReviewAssignment, rehydrateAssignment } from '../assign/buildAssignment';
import { ProblemPlayer } from '../components/problem/ProblemPlayer';
import type { Problem } from '../content/problems';
import { useProgress } from '../progress/ProgressContext';
import type { ProblemSetSession } from '../progress/problemSessionProgress';

// Practice is not tied to a lesson, so its in-progress work persists under one
// fixed session key, separate from the per-lesson problem sets.
const PRACTICE_SET_KEY = 'practice';

export function PracticePage() {
  const navigate = useNavigate();
  const { isLoading, progress, getProblemSetSession, saveProblemSetSession, clearProblemSetSession } =
    useProgress();

  // The resume snapshot and a saved-session rehydrate are captured once,
  // synchronously, after cloud progress loads. A saved session resumes the exact
  // same practice problems and handwriting with no async needed, so we resolve it
  // here in render and never flash the loading panel for it. `synced` holds the
  // restored set, or null when there is no saved set and a fresh review
  // assignment must be drawn asynchronously below.
  const initialRef = useRef<{ session: ProblemSetSession | null } | null>(null);
  const syncedRef = useRef<Problem[] | null>(null);
  if (!isLoading && initialRef.current === null) {
    const saved = getProblemSetSession(PRACTICE_SET_KEY);
    initialRef.current = { session: saved };
    if (saved && saved.problemIds.length > 0) {
      // rehydrateAssignment throws by design when a saved id no longer resolves.
      // An uncaught throw in render would white-screen the page, so a failed
      // restore degrades to the empty state below (break loud, never fabricate).
      try {
        syncedRef.current = rehydrateAssignment(saved.problemIds, progress.misconceptionGraph);
      } catch {
        syncedRef.current = [];
      }
    } else {
      syncedRef.current = null;
    }
  }

  // buildReviewAssignment now generates its review slots via the backend, so it
  // resolves asynchronously. Build once after the load and hold the result stable
  // for the session, so recordProblemResult mutating progress mid-set never
  // rebuilds or reshuffles it. Guarding on a ref (not a per-effect flag) keeps the
  // single build intact under React StrictMode's double-invoke.
  const [built, setBuilt] = useState<Problem[] | null>(null);
  const buildStartedRef = useRef(false);
  useEffect(() => {
    if (isLoading) return;
    if (syncedRef.current !== null) return;
    if (buildStartedRef.current) return;
    buildStartedRef.current = true;
    // A rejected build degrades to the empty state (break loud, never fabricate);
    // store an empty set so the page shows the "Nothing to practice yet" state.
    void (async () => {
      try {
        const problems = await buildReviewAssignment(progress, new Date());
        setBuilt(problems);
      } catch {
        setBuilt([]);
      }
    })();
  }, [isLoading, progress]);

  const resolved = syncedRef.current !== null ? syncedRef.current : built;

  if (isLoading || resolved === null) {
    return (
      <main className="lesson-shell theme-handdrawn theme-handdrawn--lesson">
        <section className="panel lesson-loading">
          <p className="eyebrow" role="status">
            Loading…
          </p>
        </section>
      </main>
    );
  }

  const problems = resolved;

  return (
    <main className="lesson-shell theme-handdrawn theme-handdrawn--lesson">
      {problems.length === 0 ? (
        <section className="panel lesson-missing">
          <p className="eyebrow">Practice</p>
          <h1>Nothing to practice yet</h1>
          <p>Finish a lesson to unlock practice problems.</p>
          <Link className="secondary-button" to="/dashboard">
            Back to dashboard
          </Link>
        </section>
      ) : (
        <ProblemPlayer
          problems={problems}
          title="Practice"
          initialSession={initialRef.current?.session ?? null}
          onSessionChange={(session) => saveProblemSetSession(PRACTICE_SET_KEY, session)}
          onSessionClear={() => clearProblemSetSession(PRACTICE_SET_KEY)}
          onAllComplete={() => navigate('/dashboard')}
        />
      )}
    </main>
  );
}
