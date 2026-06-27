import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { buildPostLessonAssignment, rehydrateAssignment } from '../assign/buildAssignment';
import { ProblemPlayer } from '../components/problem/ProblemPlayer';
import type { Problem } from '../content/problems';
import { useProgress } from '../progress/ProgressContext';
import type { ProblemSetSession } from '../progress/problemSessionProgress';

export function ProblemSetPage() {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const {
    isLoading,
    progress,
    getProblemSetSession,
    saveProblemSetSession,
    clearProblemSetSession,
    markProblemSetComplete,
  } = useProgress();

  const setKey = lessonId ?? '';

  // The resume snapshot and a saved-session rehydrate are captured once per set,
  // synchronously, after cloud progress loads. A saved set resumes the exact same
  // problems with no async needed, so we resolve it here in render and never flash
  // the loading panel for it. Keying by setKey keeps the snapshot stable, so our
  // own saves never feed a fresh "initial" back into the player and bounce it off
  // the problem the student is on. `synced` holds the restored set, or null when
  // there is no saved set and the assignment must be built asynchronously below.
  const initialRef = useRef<{ key: string; session: ProblemSetSession | null } | null>(null);
  const syncedRef = useRef<{ key: string; problems: Problem[] } | null>(null);
  if (!isLoading && (initialRef.current === null || initialRef.current.key !== setKey)) {
    const saved = getProblemSetSession(setKey);
    initialRef.current = { key: setKey, session: saved };
    if (saved && saved.problemIds.length > 0) {
      // rehydrateAssignment throws by design when a saved id no longer resolves.
      // An uncaught throw in render would white-screen the page, so a failed
      // restore degrades to the empty state below (break loud, never fabricate).
      try {
        syncedRef.current = {
          key: setKey,
          problems: rehydrateAssignment(saved.problemIds, progress.misconceptionGraph),
        };
      } catch {
        syncedRef.current = { key: setKey, problems: [] };
      }
    } else {
      syncedRef.current = null;
    }
  }

  // buildPostLessonAssignment now generates its review slots via the backend, so
  // it resolves asynchronously. Build once per setKey after the load and hold the
  // result stable for the session, so recordProblemResult mutating progress
  // mid-set never rebuilds or reshuffles it. Guarding on the key (not a per-effect
  // flag) keeps the single build intact under React StrictMode's double-invoke.
  const [built, setBuilt] = useState<{ key: string; problems: Problem[] } | null>(null);
  const buildKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (isLoading) return;
    if (syncedRef.current && syncedRef.current.key === setKey) return;
    if (buildKeyRef.current === setKey) return;
    buildKeyRef.current = setKey;
    // A rejected build degrades to the empty state (break loud, never fabricate);
    // store an empty set so the page shows "No problems yet". The key guard drops
    // a stale resolution once the learner has navigated to a different set.
    void (async () => {
      try {
        const problems = await buildPostLessonAssignment(setKey, progress, new Date());
        if (buildKeyRef.current === setKey) setBuilt({ key: setKey, problems });
      } catch {
        if (buildKeyRef.current === setKey) setBuilt({ key: setKey, problems: [] });
      }
    })();
  }, [isLoading, setKey, progress]);

  const synced = syncedRef.current;
  const resolved =
    synced && synced.key === setKey
      ? synced.problems
      : built && built.key === setKey
        ? built.problems
        : null;

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
          <p className="eyebrow">Problem set</p>
          <h1>No problems yet</h1>
          <p>There are no practice problems for this topic right now.</p>
          <Link className="secondary-button" to="/dashboard">
            Back to dashboard
          </Link>
        </section>
      ) : (
        <ProblemPlayer
          problems={problems}
          title="Problem set"
          initialSession={initialRef.current?.session ?? null}
          onSessionChange={(session) => saveProblemSetSession(setKey, session)}
          onSessionClear={() => clearProblemSetSession(setKey)}
          onComplete={() => markProblemSetComplete(setKey)}
          onAllComplete={() => navigate('/dashboard')}
        />
      )}
    </main>
  );
}
