import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Dumbbell, ListChecks, Lock, Play, Target } from 'lucide-react';
import { AppShell } from '../components/shell/AppShell';
import { Avatar } from '../components/Avatar';
import { COURSE_LESSON_TOTAL, COURSE_TITLE, COURSE_UNITS, friendNodeKey, type CourseLesson } from '../content/courseMap';
import { getProblemsForLesson } from '../content/problems';
import { LIVE_LESSON_IDS, LIVE_LESSON_LIMIT } from '../progress/dashboardProgress';
import { isProblemSetComplete } from '../progress/problemSetStatus';
import { resolveDevMode } from '../dev/devMode';
import { useProgress } from '../progress/ProgressContext';
import { useSocial } from '../social/SocialContext';
import type { FriendView } from '../social/types';

// The dashboard intro animation should play whenever the learner arrives at the
// course — login, first visit, returning from the landing page, or a full
// reload — but NOT when they come back from a lesson they were in. We raise this
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

  // Place each friend on the node they are currently on, keyed by node id
  // ("lesson:G", "pset:G", or "end"). A learner sits on the problem set of their
  // last completed lesson while that set is open, and on the next lesson once it
  // is done; this matches the "On: <node>" label the friends list shows from the
  // same two counts.
  const friendsByNode = useMemo(() => {
    const map = new Map<string, FriendView[]>();
    for (const friend of friends) {
      const key = friendNodeKey(friend.profile?.completedCount ?? 0, friend.profile?.completedPsetCount ?? 0);
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

  // Dev mode (?dev=1) unlocks every live lesson and problem set for testing.
  // Read once per mount from the real URL; resolveDevMode persists the toggle so
  // it stays on (sticky) when navigating into a lesson and back without the
  // param, and ?dev=0 turns it off. It never changes stored progress.
  const devMode = useMemo(
    () => resolveDevMode(typeof window !== 'undefined' ? window.location.search : ''),
    [],
  );

  if (isLoading) {
    return (
      <AppShell className="app-shell--handdrawn">
        <div className="home">
          <p className="home-loading" role="status">
            Loading your progress…
          </p>
        </div>
      </AppShell>
    );
  }

  const completedSet = new Set(progress.completedLessonIds);
  const unlockedCount = Math.min(completedCount + 1, LIVE_LESSON_LIMIT);
  const hasMetDailyGoal = todayXp >= dailyGoal;

  // Flattened lesson order, used both to find "next up" and to look up a node's
  // immediately preceding lesson for the problem-set gate.
  const allLessons = COURSE_UNITS.flatMap((unit) => unit.lessons);
  // The first not-yet-completed lesson is the learner's "next up". Once the live
  // lesson(s) are done this lands on mock content; we still surface that node in
  // the active (red) style as a teaser, even though it isn't interactive yet.
  const nextUpLesson = allLessons.find((candidate) => {
    const candidateIndex = candidate.lessonId ? LIVE_LESSON_IDS.indexOf(candidate.lessonId) : -1;
    return !(candidateIndex >= 0 && completedSet.has(candidate.lessonId!));
  });

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

  // Progress counts both lessons and their problem sets: the course path is a
  // lesson then its set throughout, so the total is two steps per lesson and the
  // completed count adds every solved set on top of every finished lesson.
  const completedProblemSetCount = allLessons.filter((lesson) =>
    isProblemSetComplete(progress, lesson.lessonId),
  ).length;
  const progressTotal = COURSE_LESSON_TOTAL * 2;
  const progressDone = completedCount + completedProblemSetCount;

  function renderNode(lesson: CourseLesson, side: 'left' | 'right', globalIndex: number) {
    const liveIndex = lesson.lessonId ? LIVE_LESSON_IDS.indexOf(lesson.lessonId) : -1;
    const isLive = liveIndex >= 0;
    const isCompleted = isLive && completedSet.has(lesson.lessonId!);
    // Access is sequential: a live lesson opens once it is within the unlock
    // window (every prior live lesson completed) and the prior lesson's problem
    // set is finished. An implemented lesson is reachable as soon as the prior
    // lesson and its set are done; the first live lesson is always open.
    const withinUnlockWindow = isLive && liveIndex < unlockedCount;
    const priorLiveLessonId = liveIndex > 0 ? LIVE_LESSON_IDS[liveIndex - 1] : null;
    // Hard gate: the next live lesson stays locked until the prior lesson's
    // problem set is fully solved (skipped when the prior lesson has no set).
    const priorHasPset = !!priorLiveLessonId && getProblemsForLesson(priorLiveLessonId).length > 0;
    const priorPsetComplete =
      liveIndex <= 0 ? true : !priorHasPset || isProblemSetComplete(progress, priorLiveLessonId);
    // Dev mode opens every live lesson (and its set below) regardless of gates.
    const devUnlocked = devMode && isLive;
    const isUnlocked = devUnlocked || (withinUnlockWindow && priorPsetComplete);
    // A mock lesson that is the learner's next step is shown active (red) as a
    // teaser, but stays inert (no navigation) like the rest of the demo content.
    // It only lights up once the previous lesson's problem set is finished;
    // until then the next lesson stays gray/locked.
    const priorLesson = globalIndex > 0 ? allLessons[globalIndex - 1] : null;
    const priorLessonPsetDone =
      !priorLesson?.lessonId ||
      getProblemsForLesson(priorLesson.lessonId).length === 0 ||
      isProblemSetComplete(progress, priorLesson.lessonId);
    const isNextDemo = !isLive && lesson === nextUpLesson && priorLessonPsetDone;
    const state = isCompleted ? 'complete' : isUnlocked || isNextDemo ? 'active' : 'locked';

    const actionLabel = isCompleted
      ? 'Review lesson'
      : progress.lastOpenedLessonId === lesson.lessonId
        ? 'Resume lesson'
        : 'Start lesson';

    // Every lesson shows a problem-set node under it (offset to the lesson's
    // side, off the spine): gray until the lesson is finished, red until every
    // problem is solved, then green. Finishing it unlocks the next lesson.
    // Lessons without an authored set (mock/future) show an inert gray
    // placeholder, so the path reads lesson -> set -> lesson throughout.
    const psetExists = !!lesson.lessonId && getProblemsForLesson(lesson.lessonId).length > 0;
    const psetDone = isCompleted && psetExists && isProblemSetComplete(progress, lesson.lessonId);
    const psetClickable = devUnlocked || (isCompleted && psetExists);
    const psetState = psetDone
      ? 'complete'
      : psetClickable
        ? 'active'
        : !isCompleted
          ? 'locked'
          : 'complete';
    // The final lesson's set caps the course, so its node reads as Final Review.
    const psetLabel = globalIndex === allLessons.length - 1 ? 'Final Review' : 'Problem Set';
    // Match the lesson-node language: lock when locked, checkmark when complete,
    // and the checklist for the active (to-do) set.
    const psetIcon =
      psetState === 'locked' ? (
        <Lock size={20} strokeWidth={2.4} aria-hidden="true" />
      ) : psetState === 'complete' ? (
        <Check size={26} strokeWidth={2.6} aria-hidden="true" />
      ) : (
        <ListChecks size={22} strokeWidth={2.4} aria-hidden="true" />
      );

    return (
      <Fragment key={lesson.title}>
        <li className={`path-node path-node--${state} path-node--${side}`}>
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
          ) : isNextDemo ? (
            <span className="path-node-btn" aria-label={`${lesson.title}, coming soon`}>
              <Play size={26} strokeWidth={2.6} aria-hidden="true" />
            </span>
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

        <li className={`path-node path-node--set path-node--${psetState} path-node--${side}`}>
          {psetClickable ? (
            <Link
              className="path-node-btn path-node-set-btn"
              to={`/problem-set/${lesson.lessonId}`}
              aria-label={`Problem set for ${lesson.title}`}
            >
              {psetIcon}
            </Link>
          ) : (
            <span
              className="path-node-btn path-node-set-btn"
              aria-label={
                psetExists ? `Problem set for ${lesson.title}, finish the lesson first` : `Problem set, locked`
              }
            >
              {psetIcon}
            </span>
          )}
            <span className="path-node-label">
              {psetLabel}
            </span>
            {renderFriendCluster(friendsByNode.get(`pset:${globalIndex}`))}
          </li>
        </Fragment>
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

          <div className="home-hero-actions">
            <Link className="secondary-button" to="/practice">
              <Dumbbell size={18} strokeWidth={2.2} aria-hidden="true" /> Practice
            </Link>
            <Link className="secondary-link" to="/mastery">
              <Target size={18} strokeWidth={2.2} aria-hidden="true" /> Misconception map
            </Link>
          </div>
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
