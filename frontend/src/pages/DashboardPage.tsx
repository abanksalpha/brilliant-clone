import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Lock, Play } from 'lucide-react';
import { AppShell } from '../components/shell/AppShell';
import { LoadingScreen } from '../components/shell/LoadingScreen';
import { Avatar } from '../components/Avatar';
import { COURSE_LESSON_TOTAL, COURSE_TITLE, COURSE_UNITS, type CourseLesson } from '../content/courseMap';
import { getProblemsForLesson } from '../content/problems';
import { canAccessLesson } from '../mastery/gating';
import { LIVE_LESSON_IDS, LIVE_LESSON_LIMIT } from '../progress/dashboardProgress';
import { resolveDevMode } from '../dev/devMode';
import { useProgress } from '../progress/ProgressContext';
import { useSocial } from '../social/SocialContext';
import type { FriendView } from '../social/types';

// The dashboard intro animation should play whenever the learner arrives at the
// course (login, first visit, returning from the landing page, or a full
// reload) but NOT when they come back from a lesson they were in. We raise this
// module-scoped flag when a lesson is opened (it survives client-side route
// changes) and consume it on the next dashboard mount.
let returningFromLesson = false;

function CheckeredFlag({ size = 22 }: { size?: number }) {
  const startX = 7;
  const startY = 4;
  const cell = 3.4;
  const cols = 4;
  const rows = 3;
  const squares = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if ((row + col) % 2 === 0) {
        squares.push(
          <rect
            key={`${row}-${col}`}
            x={startX + col * cell}
            y={startY + row * cell}
            width={cell}
            height={cell}
            fill="currentColor"
          />,
        );
      }
    }
  }

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <line x1="5" y1="3" x2="5" y2="21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <rect x={startX} y={startY} width={cols * cell} height={rows * cell} fill="none" stroke="currentColor" strokeWidth="1.3" />
      {squares}
    </svg>
  );
}

export function DashboardPage() {
  const {
    progress,
    completedCount,
    totalXp,
    todayXp,
    dailyGoal,
    streakDays,
    isLoading,
    markLessonOpened,
  } = useProgress();
  const { friends } = useSocial();

  // Place each friend on the lesson they are currently on, keyed by node id
  // ("lesson:G" or "end"): a learner who has completed N lessons is working on
  // lesson index N (the next one), so they sit on that lesson's node. Once the
  // whole course is done they sit at the End. This matches the "On: <lesson>"
  // label the friends list shows from the same completedCount.
  const friendsByNode = useMemo(() => {
    const map = new Map<string, FriendView[]>();
    for (const friend of friends) {
      const completed = Math.min(Math.max(0, friend.profile?.completedCount ?? 0), COURSE_LESSON_TOTAL);
      const key = completed >= COURSE_LESSON_TOTAL ? 'end' : `lesson:${completed}`;
      const existing = map.get(key);
      if (existing) {
        existing.push(friend);
      } else {
        map.set(key, [friend]);
      }
    }
    return map;
  }, [friends]);

  // Play the intro unless this mount is a return trip from a lesson. Captured in
  // a lazy initializer so the value stays stable across the loading→loaded
  // re-render (and the StrictMode double render reads the same flag value).
  const [playIntro] = useState(() => !returningFromLesson);

  useEffect(() => {
    // Consume the one-shot flag once this mount has read it. Done in an effect
    // (not during render) so React StrictMode's throwaway render can't clear it
    // before the committed mount captures playIntro.
    returningFromLesson = false;
  }, []);

  // On a return trip from a lesson, the full intro is suppressed; instead, center
  // the page on the lesson just left and play a one-time locate ping on its node,
  // so the learner lands oriented on where they were.
  const returnLessonId = playIntro ? null : progress.lastOpenedLessonId;
  const returnNodeRef = useRef<HTMLLIElement | null>(null);
  const centeredOnReturnRef = useRef(false);
  useLayoutEffect(() => {
    if (centeredOnReturnRef.current || isLoading || !returnLessonId) return;
    const node = returnNodeRef.current;
    if (!node) return;
    centeredOnReturnRef.current = true;
    // Land directly on the lesson just left, with no visible scroll: an instant
    // scroll inside a layout effect happens before paint, so the page simply
    // appears already centered instead of animating downward.
    node.scrollIntoView?.({ block: 'center', behavior: 'instant' });
  }, [isLoading, returnLessonId]);

  // Dev mode (?dev=1) unlocks every live lesson for testing. Read once per mount
  // from the real URL; resolveDevMode persists the toggle so it stays on (sticky)
  // when navigating into a lesson and back without the param, and ?dev=0 turns it
  // off. It never changes stored progress.
  const devMode = useMemo(
    () => resolveDevMode(typeof window !== 'undefined' ? window.location.search : ''),
    [],
  );

  if (isLoading) {
    return <LoadingScreen />;
  }

  const completedSet = new Set(progress.completedLessonIds);
  const unlockedCount = Math.min(completedCount + 1, LIVE_LESSON_LIMIT);
  const hasMetDailyGoal = todayXp >= dailyGoal;

  // Evaluated against the current moment because mastery strength decays with
  // time; used by the soft mastery gate below.
  const masteryNow = new Date();

  function renderFriendCluster(nodeFriends: FriendView[] | undefined) {
    if (!nodeFriends || nodeFriends.length === 0) {
      return null;
    }
    const shown = nodeFriends.slice(0, 4);
    const extra = nodeFriends.length - shown.length;
    return (
      <div
        className="path-node-friends"
        aria-label={`${nodeFriends.length} friend${nodeFriends.length === 1 ? '' : 's'} here`}
      >
        {shown.map((friend) => (
          <Avatar
            key={friend.uid}
            className="friend-avatar"
            name={friend.profile?.displayName || 'A friend'}
            photoURL={friend.profile?.photoURL ?? null}
            size={34}
            // Empty title suppresses the native "… is here" hover tooltip; the
            // cluster's aria-label still conveys who's here for screen readers.
            title=""
          />
        ))}
        {extra > 0 ? (
          <span className="friend-avatar friend-avatar--more" aria-hidden="true">
            +{extra}
          </span>
        ) : null}
      </div>
    );
  }

  // One step per lesson: the whole five-phase loop lives inside the single lesson
  // box, so the course total is one per lesson and completion advances one step.
  const progressTotal = COURSE_LESSON_TOTAL;
  const progressDone = completedCount;

  function renderNode(lesson: CourseLesson, side: 'left' | 'right', globalIndex: number) {
    const liveIndex = lesson.lessonId ? LIVE_LESSON_IDS.indexOf(lesson.lessonId) : -1;
    const isLive = liveIndex >= 0;
    // Dev mode marks every live (built) lesson complete so the whole path reads as
    // done and is freely navigable. It's a view-only override: stored progress is
    // never touched. Faux/mock lessons (no lessonId) are never live, so they stay
    // locked even in dev.
    const isCompleted = isLive && (devMode || completedSet.has(lesson.lessonId!));
    // Access combines the sequential completion window with the soft mastery
    // gate. The first live lesson is always open (isFirstLesson short-circuits
    // the gate); a later live lesson also requires the prior lesson's
    // misconceptions to be mastered before it unlocks.
    const withinUnlockWindow = isLive && liveIndex < unlockedCount;
    const priorLiveLessonId = liveIndex > 0 ? LIVE_LESSON_IDS[liveIndex - 1] : null;
    const lessonGate = isLive
      ? canAccessLesson({
          masteryMap: progress.misconceptions ?? {},
          priorLessonProblems: priorLiveLessonId ? getProblemsForLesson(priorLiveLessonId) : [],
          isFirstLesson: liveIndex === 0,
          peekAhead: false,
          now: masteryNow,
        })
      : null;
    const devUnlocked = devMode && isLive;
    const realUnlocked = withinUnlockWindow && (lessonGate?.unlocked ?? false);
    const isUnlocked = devUnlocked || realUnlocked;
    // Only live lessons can be complete (blue) or active (red); faux/mock lessons
    // are always locked, in every mode. In dev every live lesson is complete, so
    // the whole built path is blue.
    const state = isCompleted ? 'complete' : realUnlocked ? 'active' : 'locked';

    const actionLabel = isCompleted
      ? 'Review lesson'
      : progress.lastOpenedLessonId === lesson.lessonId
        ? 'Resume lesson'
        : 'Start lesson';

    const isReturnNode = lesson.lessonId != null && lesson.lessonId === returnLessonId;

    return (
      <li
        className={`path-node path-node--${state} path-node--${side}${isReturnNode ? ' path-node--returned' : ''}`}
        key={lesson.title}
        ref={isReturnNode ? returnNodeRef : undefined}
      >
        {isUnlocked || isCompleted ? (
          <Link
            className="path-node-btn"
            to={`/lesson/${lesson.lessonId}`}
            aria-label={actionLabel}
            onClick={() => {
              // Opening a lesson: don't replay the course intro when we return.
              returningFromLesson = true;
              markLessonOpened(lesson.lessonId!);
            }}
          >
            {isCompleted ? (
              <Check size={30} strokeWidth={2.6} aria-hidden="true" />
            ) : (
              <Play size={26} strokeWidth={2.6} aria-hidden="true" />
            )}
          </Link>
        ) : (
          <span
            className="path-node-btn"
            aria-label={isLive ? `Lesson ${liveIndex + 1} is locked` : `${lesson.title}, locked`}
          >
            <Lock size={22} strokeWidth={2.4} aria-hidden="true" />
          </span>
        )}

        <span className="path-node-label">{lesson.title}</span>
        {renderFriendCluster(friendsByNode.get(`lesson:${globalIndex}`))}
      </li>
    );
  }

  return (
    <AppShell className="app-shell--handdrawn">
      <div className={`home${playIntro ? ' home--intro' : ''}`}>
        <section className="home-hero">
          <h1 className="home-title">{COURSE_TITLE}</h1>
          <p className="home-lede">
            {completedCount === 0
              ? `Welcome to AP Physics C: E&M! In this course, you'll learn about electric charges and the fields they create, electric potential and circuits, magnetism, and how changing fields induce currents.`
              : 'Pick up where you left off in Unit 1.'}
          </p>

          <dl className="home-stats">
            <div className="home-stat">
              <dt>Progress</dt>
              <dd>
                {progressDone}/{progressTotal}
              </dd>
            </div>
            <div className="home-stat">
              <dt>Streak</dt>
              <dd>
                {streakDays} day{streakDays === 1 ? '' : 's'}
              </dd>
            </div>
            <div className="home-stat">
              <dt>Total XP</dt>
              <dd>{totalXp}</dd>
            </div>
            <div className={`home-stat home-stat--goal${hasMetDailyGoal ? ' home-stat--goal-met' : ''}`}>
              <dt>Today's goal</dt>
              <dd>
                {todayXp}/{dailyGoal}
              </dd>
            </div>
          </dl>
        </section>

        {COURSE_UNITS.map((unit, unitIndex) => {
          const unitOpen = unit.lessons.some(
            (lesson) => lesson.lessonId && LIVE_LESSON_IDS.indexOf(lesson.lessonId) < unlockedCount,
          );
          const completedInUnit = unit.lessons.filter(
            (lesson) => lesson.lessonId && completedSet.has(lesson.lessonId),
          ).length;
          const priorUnits = COURSE_UNITS.slice(0, unitIndex);
          const lessonsBefore = priorUnits.reduce((total, prior) => total + prior.lessons.length, 0);
          const completedBefore = priorUnits.reduce(
            (total, prior) =>
              total + prior.lessons.filter((lesson) => lesson.lessonId && completedSet.has(lesson.lessonId)).length,
            0,
          );
          const lessonsToUnlock = Math.max(lessonsBefore - completedBefore, 0);
          const headingId = `unit-${unit.id}-title`;

          return (
            <section className="unit" key={unit.id} aria-labelledby={headingId}>
              <div className={`unit-header${unitOpen ? '' : ' unit-header--soon'}`}>
                <div>
                  <p className="unit-kicker">Unit {unitIndex + 1}</p>
                  <h2 id={headingId}>{unit.name}</h2>
                </div>
                <span className="unit-count">
                  {unitOpen ? (
                    `${completedInUnit} / ${unit.lessons.length}`
                  ) : (
                    <>
                      <Lock size={14} strokeWidth={2.4} aria-hidden="true" /> {lessonsToUnlock}
                    </>
                  )}
                </span>
              </div>

              <ol className="path" aria-label={`${unit.name} lessons`}>
                {unit.lessons.map((lesson, lessonIndex) => {
                  const side = (lessonsBefore + lessonIndex) % 2 === 0 ? 'left' : 'right';
                  return renderNode(lesson, side, lessonsBefore + lessonIndex);
                })}
                {unitIndex === COURSE_UNITS.length - 1 ? (
                  <li className="path-node path-node--end" key="course-end">
                    <span className="path-end-box">
                      <CheckeredFlag size={22} />
                      <span className="path-end-label">End</span>
                    </span>
                    {renderFriendCluster(friendsByNode.get('end'))}
                  </li>
                ) : null}
              </ol>
            </section>
          );
        })}
      </div>
    </AppShell>
  );
}
