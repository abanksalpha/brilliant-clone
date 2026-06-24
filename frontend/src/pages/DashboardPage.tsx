import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Lock, Play } from 'lucide-react';
import { AppShell } from '../components/shell/AppShell';
import { Avatar } from '../components/Avatar';
import { COURSE_LESSON_TOTAL, COURSE_TITLE, COURSE_UNITS, type CourseLesson } from '../content/courseMap';
import { LIVE_LESSON_IDS, LIVE_LESSON_LIMIT } from '../progress/dashboardProgress';
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

  // Group friends by the timeline node they're currently on (their completed
  // lesson count == the flattened lesson index of their "next up" node).
  const friendsByIndex = useMemo(() => {
    const map = new Map<number, FriendView[]>();
    for (const friend of friends) {
      const index = Math.min(Math.max(0, friend.profile?.completedCount ?? 0), COURSE_LESSON_TOTAL);
      const existing = map.get(index);
      if (existing) {
        existing.push(friend);
      } else {
        map.set(index, [friend]);
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
  const hasSurpassedDailyGoal = todayXp > dailyGoal;

  // The first not-yet-completed lesson is the learner's "next up". Once the live
  // lesson(s) are done this lands on mock content; we still surface that node in
  // the active (red) style as a teaser, even though it isn't interactive yet.
  const nextUpLesson = COURSE_UNITS.flatMap((unit) => unit.lessons).find((candidate) => {
    const candidateIndex = candidate.lessonId ? LIVE_LESSON_IDS.indexOf(candidate.lessonId) : -1;
    return !(candidateIndex >= 0 && completedSet.has(candidate.lessonId!));
  });

  function renderFriendCluster(index: number) {
    const nodeFriends = friendsByIndex.get(index);
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
            title={`${friend.profile?.displayName || 'A friend'} is here`}
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

  function renderNode(lesson: CourseLesson, side: 'left' | 'right', globalIndex: number) {
    const liveIndex = lesson.lessonId ? LIVE_LESSON_IDS.indexOf(lesson.lessonId) : -1;
    const isLive = liveIndex >= 0;
    const isCompleted = isLive && completedSet.has(lesson.lessonId!);
    const isUnlocked = isLive && liveIndex < unlockedCount;
    // A mock lesson that is the learner's next step is shown active (red) as a
    // teaser, but stays inert (no navigation) like the rest of the demo content.
    const isNextDemo = !isLive && lesson === nextUpLesson;
    const state = isCompleted ? 'complete' : isUnlocked || isNextDemo ? 'active' : 'locked';

    const actionLabel = isCompleted
      ? 'Review lesson'
      : progress.lastOpenedLessonId === lesson.lessonId
        ? 'Resume lesson'
        : 'Start lesson';

    return (
      <li className={`path-node path-node--${state} path-node--${side}`} key={lesson.title}>
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
        {renderFriendCluster(globalIndex)}
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
                {completedCount}/{COURSE_LESSON_TOTAL}
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
            <div className={`home-stat home-stat--goal${hasSurpassedDailyGoal ? ' home-stat--goal-met' : ''}`}>
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
                  <p className="unit-kicker">
                    Unit {unitIndex + 1} · {unit.topic}
                  </p>
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
                    {renderFriendCluster(COURSE_LESSON_TOTAL)}
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
