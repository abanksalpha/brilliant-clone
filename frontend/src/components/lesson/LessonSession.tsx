import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import type { LessonModule } from '../../content';
import type { Problem } from '../../content/problems';
import {
  buildGeneratedReview,
  type BuildOptions,
  type BuildResult,
} from '../../assign/buildGeneratedReview';
import { buildPersonalizedSolveSet } from '../../assign/buildPersonalizedSolveSet';
import { planProblemSet, generatePlannedProblem } from '../../lib/grading';
import { useProgress } from '../../progress/ProgressContext';
import { resolveDevMode } from '../../dev/devMode';
import { celebrate } from '../../lib/confetti';
import { ProblemPlayer } from '../problem/ProblemPlayer';
import { LoadingScreen } from '../shell/LoadingScreen';
import { PhaseBar, type PhaseDescriptor } from './PhaseBar';
import { InquiryPrompt } from './InquiryPrompt';
import { ExplanationSlides } from './ExplanationSlides';
import { WorkedExample } from './WorkedExample';
import { CompletionProblem } from './CompletionProblem';

// The five phases, 0-indexed to match the persisted lessonPhase position:
// 0 review, 1 inquiry, 2 explanation, 3 worked-to-faded, 4 independent.
const LAST_PHASE = 4;

// The Solve set always carries three generated slots (two topic, one synthesis).
const SOLVE_GENERATED_COUNT = 3;
// The Solve set is curated to at most three authored problems before the generated ones.
const SOLVE_AUTHORED_CAP = 3;

type LessonSessionProps = {
  module: LessonModule;
  initialPhase: number;
  initialWithin: number;
  onPhaseChange: (phase: number, within: number) => void;
  onLessonComplete: () => void;
  onQuestionAnswered?: (stepNumber: number) => void;
};

function clampPhase(phase: number): number {
  if (!Number.isFinite(phase) || phase < 0) return 0;
  if (phase > LAST_PHASE) return LAST_PHASE;
  return Math.trunc(phase);
}

// Place ready problems into a slot-indexed display array. A problem with no
// planSlotIndex is an authored lead and keeps the front in arrival order; each
// generated success sits at its planSlotIndex. Empty positions are holes the
// player shows as still generating or (when reported) failed, so a failed slot in
// the middle never shifts the slots after it.
function displayFromReady(ready: Problem[], slotCount: number): (Problem | undefined)[] {
  const lead = ready.filter((problem) => problem.planSlotIndex === undefined);
  const generated = ready.filter(
    (problem): problem is Problem & { planSlotIndex: number } => typeof problem.planSlotIndex === 'number',
  );
  let length = Math.max(slotCount, 0);
  for (const problem of generated) {
    length = Math.max(length, problem.planSlotIndex + 1);
  }
  const bySlot: (Problem | undefined)[] = new Array<Problem | undefined>(length).fill(undefined);
  for (const problem of generated) {
    bySlot[problem.planSlotIndex] = problem;
  }
  return [...lead, ...bySlot];
}

type GeneratedSet = {
  // The slot-indexed view, or null while the first plan/problem is still pending.
  display: (Problem | undefined)[] | null;
  // The planner failed: a whole-set, loud error (the only throw the builder makes).
  planError: boolean;
  // Plan slot indices whose generation failed all attempts (component state only;
  // on reload a failed slot is simply missing and regenerates).
  failedSlots: Set<number>;
  // Whole-set retry, for a planner failure.
  retry: () => void;
  // Per-slot retry: regenerate exactly the given (missing) plan slot.
  retrySlot: (slotIndex: number) => void;
};

/**
 * Drives one generated set (Review or Solve): a slot-indexed display built from
 * the cached plan and successes, the per-slot failure set, a whole-set retry (for
 * a planner failure), and a per-slot retry that regenerates the missing slot from
 * its cached description. Generation is identity-based, so a fulfilled slot is
 * placed at its planSlotIndex and a failed one is left as a retryable hole;
 * nothing is ever substituted. The build is guarded by a key so React 19
 * StrictMode's double-invoked effect does not double-build, and a stale build's
 * callbacks are ignored via a token (no cancel-on-cleanup flag, which would
 * deadlock the double-invoked mount).
 */
function useGeneratedSet(params: {
  enabled: boolean;
  cacheKey: string;
  expectedGeneratedCount: number;
  runBuilder: (options: BuildOptions) => Promise<BuildResult>;
}): GeneratedSet {
  const { enabled, cacheKey, expectedGeneratedCount } = params;
  const { getGeneratedSet, saveGeneratedSet, getGeneratedPlan, saveGeneratedPlan } = useProgress();

  const [display, setDisplay] = useState<(Problem | undefined)[] | null>(null);
  const [planError, setPlanError] = useState(false);
  const [failedSlots, setFailedSlots] = useState<Set<number>>(() => new Set());
  const [attempt, setAttempt] = useState(0);

  // The latest builder thunk, kept in a ref so its changing identity (it closes
  // over progress) never re-runs the build effect.
  const runBuilderRef = useRef(params.runBuilder);
  runBuilderRef.current = params.runBuilder;

  // The accumulated ready problems (authored lead plus generated successes) and
  // the slot count, kept in refs so streaming callbacks and per-slot retry share
  // one source of truth. The token guards against a stale build writing state.
  const readyRef = useRef<Problem[]>([]);
  const slotCountRef = useRef(expectedGeneratedCount);
  const buildTokenRef = useRef(0);

  const runBuild = useCallback(() => {
    const token = (buildTokenRef.current += 1);
    const cachedPlan = getGeneratedPlan(cacheKey) ?? undefined;
    const cached = getGeneratedSet(cacheKey) ?? [];
    readyRef.current = [...cached];
    slotCountRef.current = cachedPlan?.length ?? expectedGeneratedCount;
    setPlanError(false);
    setDisplay(cached.length > 0 ? displayFromReady(cached, slotCountRef.current) : null);

    const render = () => setDisplay(displayFromReady(readyRef.current, slotCountRef.current));
    const persistAndRender = () => {
      saveGeneratedSet(cacheKey, readyRef.current);
      render();
    };

    void (async () => {
      try {
        const result = await runBuilderRef.current({
          prebuilt: cached,
          prebuiltPlan: cachedPlan,
          onPlan: (plans) => {
            if (buildTokenRef.current !== token) return;
            // Persist the plan so resume regenerates the same missing problems.
            saveGeneratedPlan(cacheKey, plans);
            slotCountRef.current = Math.max(slotCountRef.current, plans.length);
            render();
          },
          onProblem: (problem) => {
            if (buildTokenRef.current !== token) return;
            // Accumulate the success (deduped) and clear any failed mark on its slot.
            if (!readyRef.current.some((entry) => entry.problemId === problem.problemId)) {
              readyRef.current = [...readyRef.current, problem];
            }
            const slot = problem.planSlotIndex;
            if (typeof slot === 'number') {
              setFailedSlots((prev) => {
                if (!prev.has(slot)) return prev;
                const next = new Set(prev);
                next.delete(slot);
                return next;
              });
            }
            persistAndRender();
          },
          onSlotError: (slotIndex) => {
            if (buildTokenRef.current !== token) return;
            // Size the display to include the failed slot's hole, then mark it.
            slotCountRef.current = Math.max(slotCountRef.current, slotIndex + 1);
            render();
            setFailedSlots((prev) => {
              if (prev.has(slotIndex)) return prev;
              const next = new Set(prev);
              next.add(slotIndex);
              return next;
            });
          },
        });
        if (buildTokenRef.current !== token) return;
        readyRef.current = result.problems;
        const maxFailed = result.failedSlotIndices.reduce((max, index) => Math.max(max, index + 1), 0);
        slotCountRef.current = Math.max(slotCountRef.current, maxFailed);
        saveGeneratedSet(cacheKey, result.problems);
        render();
        setFailedSlots(new Set(result.failedSlotIndices));
      } catch {
        if (buildTokenRef.current !== token) return;
        // A planner failure is the only whole-set, loud error.
        setPlanError(true);
      }
    })();
  }, [cacheKey, expectedGeneratedCount, getGeneratedPlan, getGeneratedSet, saveGeneratedPlan, saveGeneratedSet]);

  const builtKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const key = `${cacheKey}#${attempt}`;
    if (builtKeyRef.current === key) return;
    builtKeyRef.current = key;
    runBuild();
  }, [enabled, cacheKey, attempt, runBuild]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  const retrySlot = useCallback(
    (slotIndex: number) => {
      // Clear the slot so it shows as generating, then rebuild from the cached
      // successes (which lack this slot), so the builder regenerates just it.
      setFailedSlots((prev) => {
        if (!prev.has(slotIndex)) return prev;
        const next = new Set(prev);
        next.delete(slotIndex);
        return next;
      });
      runBuild();
    },
    [runBuild],
  );

  return { display, planError, failedSlots, retry, retrySlot };
}

/**
 * The five-phase guided lesson session. It walks Phase 1 (review, composed by the
 * assignment composer and solved on the whiteboard), Phase 2 (inquiry primer),
 * Phase 3 (static explanation), Phase 4 (the worked-to-faded ladder), and Phase 5
 * (independent problems), then fires onLessonComplete. The current phase and the
 * within-phase position persist via onPhaseChange so a learner resumes mid-lesson.
 * Phases 1 and 5 reuse ProblemPlayer; the other phases use the Wave 1 phase
 * components (stubbed in the Foundation). The only confetti this component fires
 * is the lesson-complete celebration; the smaller per-correct-answer bursts come
 * from the child components (a graded problem, a worked example), each gated on
 * reduced motion in lib/confetti.
 */
export function LessonSession({
  module,
  initialPhase,
  initialWithin,
  onPhaseChange,
  onLessonComplete,
  onQuestionAnswered,
}: LessonSessionProps) {
  const {
    progress,
    getProblemSetSession,
    saveProblemSetSession,
    clearProblemSetSession,
    getWorkedExampleSession,
    saveWorkedExampleSession,
    clearWorkedExampleSession,
  } = useProgress();

  const [phase, setPhase] = useState(() => clampPhase(initialPhase));
  const [workedIndex, setWorkedIndex] = useState(() => {
    if (clampPhase(initialPhase) !== 3) return 0;
    const max = Math.max(0, module.workedSequence.length - 1);
    const within = Math.max(0, Math.trunc(Number.isFinite(initialWithin) ? initialWithin : 0));
    return Math.min(within, max);
  });

  // Dev mode (?dev=1) unlocks every phase for free navigation so the whole lesson
  // can be inspected without working through it in order. Read once per mount,
  // matching the dashboard's lesson unlock; it never changes stored progress.
  const devMode = useMemo(
    () => resolveDevMode(typeof window !== 'undefined' ? window.location.search : ''),
    [],
  );

  // The furthest phase reached, so the PhaseBar can offer back navigation to any
  // phase the learner has already visited. Dev mode or a finished lesson unlocks
  // every phase for free navigation; an in-progress one unlocks up to the resume
  // point.
  const lessonComplete = (progress.completedLessonIds ?? []).includes(module.lessonId);
  const [maxVisited, setMaxVisited] = useState(() =>
    devMode || lessonComplete ? LAST_PHASE : clampPhase(initialPhase),
  );
  // Within-phase position for the phases the PhaseBar cannot read directly: the
  // current slide drives Learn, and the active ProblemPlayer's reported problem
  // index drives Review and Solve.
  const [slideIndex, setSlideIndex] = useState(() => {
    if (clampPhase(initialPhase) !== 2) return 0;
    const max = Math.max(0, module.explanationSlides.length - 1);
    const within = Math.max(0, Math.trunc(Number.isFinite(initialWithin) ? initialWithin : 0));
    return Math.min(within, max);
  });
  // The active Inquiry screen when the lesson uses the multi-screen pretest.
  // Resumes from initialWithin when the lesson opens on Phase 1.
  const [inquiryScreen, setInquiryScreen] = useState(() => {
    if (clampPhase(initialPhase) !== 1) return 0;
    const max = Math.max(0, (module.inquiry.screens?.length ?? 1) - 1);
    const within = Math.max(0, Math.trunc(Number.isFinite(initialWithin) ? initialWithin : 0));
    return Math.min(within, max);
  });
  const [problemIndex, setProblemIndex] = useState(0);
  // The problem index a Review/Solve player should open on after an explicit jump.
  // Undefined on a normal mount so resume uses the player's own saved index; set
  // to a number only when the learner jumps to a specific subpart.
  const [playerStartIndex, setPlayerStartIndex] = useState<number | undefined>(undefined);
  // Bumped on every explicit subpart jump so the target phase component remounts
  // and opens on the chosen subpart even when it is the phase already on screen.
  const [jumpNonce, setJumpNonce] = useState(0);

  // Free navigation (dev mode or a finished lesson) lets the learner jump to any
  // subpart of any phase, not just the start of a visited phase.
  const freeNavigation = devMode || lessonComplete;

  const reviewKey = `${module.lessonId}:review`;
  const independentKey = `${module.lessonId}:independent`;

  // Durable cache keys for the generated sets (progress.generatedSets) and their
  // plans (progress.generatedPlans), so a built set and its descriptions are
  // restored on resume instead of regenerated. Distinct from reviewKey and
  // independentKey above, which persist the in-progress index and whiteboard work.
  // The version suffix invalidates sets cached before a generation change, so a
  // stale cache never pins a learner to a short or differently shaped set. The
  // persisted shape now carries planSlotIndex (identity-based assembly), so review
  // is bumped to v8 and solve to v7 to drop pre-change caches.
  const reviewCacheKey = `${module.lessonId}:review:v8`;
  const solveCacheKey = `${module.lessonId}:solve:v7`;

  // The Solve cells the PhaseBar shows before the set is built: the authored
  // problems (capped to three) plus three generated ones.
  const solveAuthoredCount = Math.min(SOLVE_AUTHORED_CAP, module.independentProblemIds.length);
  const expectedSolveCount = solveAuthoredCount + SOLVE_GENERATED_COUNT;

  // The Review cells the PhaseBar shows before the set is built: P1 (all past
  // concepts) plus one per available prior review seed, mirroring
  // buildGeneratedReview, so the bar is segmented while loading instead of
  // collapsing to a single cell.
  const expectedReviewCount =
    1 +
    (module.reviewSkillIds[0] !== undefined ? 1 : 0) +
    (module.reviewSkillIds[1] !== undefined ? 1 : 0);

  // Phase 1 review: problems generated on the fly (a synthesis of all past
  // concepts, the previous lesson, and the lesson before that), each trapping the
  // learner's tracked misconceptions in scope. Built up front on mount (Review is
  // the first phase) and cached durably; the PhaseBar needs the length up front,
  // so this is not gated on the active phase. Generation is identity-based and
  // non-blocking: a failed slot shows its own retry, never a stuck "Generating".
  const reviewSet = useGeneratedSet({
    enabled: true,
    cacheKey: reviewCacheKey,
    expectedGeneratedCount: expectedReviewCount,
    runBuilder: (options) =>
      buildGeneratedReview(progress, module, new Date(), planProblemSet, generatePlannedProblem, options),
  });

  // Phase 5 solve: authored problems plus personalized generated ones. Built lazily
  // the first time Solve is reached (never up front, so a lesson the learner
  // abandons earlier never pays for generation) and cached for resume.
  const solveSet = useGeneratedSet({
    enabled: phase === LAST_PHASE,
    cacheKey: solveCacheKey,
    expectedGeneratedCount: SOLVE_GENERATED_COUNT,
    runBuilder: (options) =>
      buildPersonalizedSolveSet(progress, module, new Date(), planProblemSet, generatePlannedProblem, options),
  });

  const reviewProblems = reviewSet.display;
  const solveProblems = solveSet.display;

  function goToPhase(next: number) {
    setPhase(next);
    setWorkedIndex(0);
    setSlideIndex(0);
    setInquiryScreen(0);
    setProblemIndex(0);
    setPlayerStartIndex(undefined);
    setMaxVisited((reached) => Math.max(reached, next));
    onPhaseChange(next, 0);
  }

  // The learner's current within-phase index, mapped per phase (Inquiry has no
  // subparts). Drives both the PhaseBar fill and the same-subpart no-op below.
  function currentWithinStep(): number {
    if (phase === 0 || phase === 4) return problemIndex;
    if (phase === 1) return inquiryScreen;
    if (phase === 2) return slideIndex;
    if (phase === 3) return workedIndex;
    return 0;
  }

  // PhaseBar navigation: jump to a phase and, in free navigation, to a specific
  // subpart within it (a problem in Review/Solve, a slide in Learn, a rung in
  // Apply). The jump nonce forces the target component to remount on the chosen
  // subpart, including when it is a different subpart of the phase already on
  // screen. maxVisited is preserved so the learner can keep moving freely.
  function navigateTo(targetPhase: number, targetWithin: number) {
    const safeWithin = Math.max(0, Math.trunc(Number.isFinite(targetWithin) ? targetWithin : 0));
    // Jumping to the subpart already on screen is a no-op: re-running the jump
    // would bump the nonce and remount the current phase for no reason (a visible
    // refresh of the same content).
    if (targetPhase === phase && safeWithin === currentWithinStep()) {
      return;
    }
    setPhase(targetPhase);
    setMaxVisited((reached) => Math.max(reached, targetPhase));
    setWorkedIndex(targetPhase === 3 ? safeWithin : 0);
    setSlideIndex(targetPhase === 2 ? safeWithin : 0);
    setInquiryScreen(targetPhase === 1 ? safeWithin : 0);
    setProblemIndex(targetPhase === 0 || targetPhase === 4 ? safeWithin : 0);
    setPlayerStartIndex(targetPhase === 0 || targetPhase === 4 ? safeWithin : undefined);
    setJumpNonce((nonce) => nonce + 1);
    onPhaseChange(targetPhase, safeWithin);
  }

  function advance() {
    if (phase >= LAST_PHASE) {
      celebrate();
      onLessonComplete();
      return;
    }
    goToPhase(phase + 1);
  }

  function advanceWorked() {
    // Drop the leaving rung's worked-example session so a finished rung does not
    // restore stale revealed steps or feedback if it is revisited. The
    // completion/skeleton rungs persist into a separate problemSessions map and
    // clear their own whiteboard work inside the player, so this only affects the
    // 'worked' rungs.
    clearWorkedExampleSession(`${module.lessonId}:apply:${workedIndex}`);
    // Each completed rung is one in-lesson question answered (XP per step).
    onQuestionAnswered?.(workedIndex + 1);
    if (workedIndex < module.workedSequence.length - 1) {
      const nextWithin = workedIndex + 1;
      setWorkedIndex(nextWithin);
      onPhaseChange(phase, nextWithin);
    } else {
      advance();
    }
  }

  function renderPhase() {
    if (phase === 0) {
      if (reviewSet.planError) {
        return (
          <section className="panel lesson-phase lesson-card-rise" data-testid="phase-review-error">
            <p className="eyebrow">Review</p>
            <p>We could not build your review right now. You can try again or skip ahead to the new topic.</p>
            <div className="lesson-phase__actions">
              <button type="button" className="secondary-link" onClick={reviewSet.retry}>
                Try again
              </button>
              <button type="button" className="secondary-button" onClick={advance}>
                Skip review
              </button>
            </div>
          </section>
        );
      }
      if (reviewProblems === null || reviewProblems.length === 0) {
        return <LoadingScreen inset testId="phase-review-loading" />;
      }
      return (
        <ProblemPlayer
          key={`review-${jumpNonce}`}
          problems={reviewProblems}
          expectedTotal={Math.max(reviewProblems.length, expectedReviewCount)}
          title="Review"
          hideProgressChrome
          failedSlots={reviewSet.failedSlots}
          onRetrySlot={(index) => reviewSet.retrySlot(index)}
          onSkip={advance}
          onProblemIndexChange={(index) => setProblemIndex(index)}
          initialProblemIndex={playerStartIndex}
          initialSession={getProblemSetSession(reviewKey)}
          onSessionChange={(session) => saveProblemSetSession(reviewKey, session)}
          onSessionClear={() => clearProblemSetSession(reviewKey)}
          onAllComplete={advance}
          celebrateOnComplete={false}
        />
      );
    }

    if (phase === 1) {
      return (
        <InquiryPrompt
          key={`inquiry-${jumpNonce}`}
          inquiry={module.inquiry}
          initialScreen={inquiryScreen}
          onComplete={advance}
          onStepChange={(index) => {
            setInquiryScreen(index);
            onPhaseChange(1, index);
          }}
        />
      );
    }

    if (phase === 2) {
      return (
        <ExplanationSlides
          key={`learn-${jumpNonce}`}
          slides={module.explanationSlides}
          initialIndex={slideIndex}
          onComplete={advance}
          onStepChange={(index) => {
            // Persist the within-Learn slide so leaving and re-entering resumes
            // on the same slide instead of the first.
            setSlideIndex(index);
            onPhaseChange(2, index);
          }}
        />
      );
    }

    if (phase === 3) {
      const item = module.workedSequence[workedIndex];
      if (!item) {
        return (
          <section className="panel lesson-phase lesson-card-rise" data-testid="phase-worked-empty">
            <p className="eyebrow">Apply</p>
            <button type="button" className="secondary-button" onClick={advance}>
              Continue
            </button>
          </section>
        );
      }
      // Per-rung key so each worked/completion rung mounts fresh (and loads its
      // own saved whiteboard work) instead of leaking state across rungs.
      const applyKey = `${module.lessonId}:apply:${workedIndex}`;
      // Every Apply rung (pure worked or completion/skeleton) reads as a numbered
      // ladder rung, so the shared label spans the whole worked sequence rather
      // than each single-problem rung counting itself "1 of 1".
      const workedLabel = `Worked example ${workedIndex + 1} of ${module.workedSequence.length}`;
      return item.mode === 'worked' ? (
        <WorkedExample
          key={workedIndex}
          item={item}
          eyebrow={workedLabel}
          onComplete={advanceWorked}
          initialSession={getWorkedExampleSession(applyKey)}
          onSessionChange={(session) => saveWorkedExampleSession(applyKey, session)}
          onSessionClear={() => clearWorkedExampleSession(applyKey)}
        />
      ) : (
        <CompletionProblem
          key={workedIndex}
          item={item}
          eyebrow={workedLabel}
          onComplete={advanceWorked}
          initialSession={getProblemSetSession(applyKey)}
          onSessionChange={(session) => saveProblemSetSession(applyKey, session)}
          onSessionClear={() => clearProblemSetSession(applyKey)}
        />
      );
    }

    if (solveSet.planError) {
      return (
        <section className="panel lesson-phase lesson-card-rise" data-testid="phase-solve-error">
          <p className="eyebrow">Solve</p>
          <p>We could not build your problem set right now. Please try again.</p>
          <div className="lesson-phase__actions">
            <button type="button" className="secondary-button" onClick={solveSet.retry}>
              Try again
            </button>
          </div>
        </section>
      );
    }
    if (solveProblems === null || solveProblems.length === 0) {
      return <LoadingScreen inset testId="phase-solve-loading" />;
    }
    return (
      <ProblemPlayer
        key={`solve-${jumpNonce}`}
        problems={solveProblems}
        expectedTotal={Math.max(solveProblems.length, expectedSolveCount)}
        title="Solve"
        hideProgressChrome
        // The generated slots sit after the authored lead, so a failed generated
        // slot's display index is offset by the authored count; the retry maps it
        // back to the plan slot the builder regenerates.
        failedSlots={new Set([...solveSet.failedSlots].map((slot) => slot + solveAuthoredCount))}
        onRetrySlot={(index) => solveSet.retrySlot(index - solveAuthoredCount)}
        onProblemIndexChange={(index) => setProblemIndex(index)}
        initialProblemIndex={playerStartIndex}
        initialSession={getProblemSetSession(independentKey)}
        onSessionChange={(session) => saveProblemSetSession(independentKey, session)}
        onSessionClear={() => clearProblemSetSession(independentKey)}
        onAllComplete={advance}
        celebrateOnComplete={false}
      />
    );
  }

  // The single progress indicator's shape: one segment per phase, each with one
  // sub-cell per within-phase step (review problems, the single inquiry, the
  // explanation slides, the worked ladder, the independent problems).
  const phases = useMemo<PhaseDescriptor[]>(
    () => [
      // Keep the segment at its expected count while problems stream in, so the
      // bar stays steady instead of growing cell by cell.
      { label: 'Review', steps: Math.max(reviewProblems?.length ?? 0, expectedReviewCount) },
      { label: 'Inquiry', steps: Math.max(1, module.inquiry.screens?.length ?? 1) },
      { label: 'Learn', steps: Math.max(1, module.explanationSlides.length) },
      { label: 'Apply', steps: Math.max(1, module.workedSequence.length) },
      { label: 'Solve', steps: Math.max(solveProblems?.length ?? 0, expectedSolveCount) },
    ],
    [
      reviewProblems,
      expectedReviewCount,
      module.inquiry.screens?.length,
      module.explanationSlides.length,
      module.workedSequence.length,
      solveProblems,
      expectedSolveCount,
    ],
  );

  // The within-phase step the learner is on: Review/Solve from the active
  // ProblemPlayer, Learn from the slide deck, Apply from the worked ladder, and
  // Inquiry is a single step.
  const withinStep = currentWithinStep();

  // The whiteboard phases fill the shell to y=0 so the paper reaches the top; the
  // card phases sit below the rail. Review (resolved, non-empty) and Solve are
  // always whiteboard; in Apply, the completion and skeleton rungs solve on the
  // whiteboard too (only the 'worked' rung is a card). A plan-failure error panel
  // is a card, not a whiteboard.
  const applyItem = phase === 3 ? module.workedSequence[workedIndex] : undefined;
  const isWhiteboard =
    (phase === 0 && !reviewSet.planError && reviewProblems !== null && reviewProblems.length > 0) ||
    (phase === 4 && !solveSet.planError && solveProblems !== null && solveProblems.length > 0) ||
    (applyItem != null && applyItem.mode !== 'worked');

  return (
    <main
      className={`lesson-shell theme-handdrawn theme-handdrawn--lesson${
        isWhiteboard ? '' : ' lesson-shell--card'
      }`}
    >
      <div className="lesson-rail">
        <PhaseBar
          phases={phases}
          current={phase}
          withinStep={withinStep}
          maxVisited={maxVisited}
          onNavigate={navigateTo}
          freeNavigation={freeNavigation}
        />
        <Link className="session-close lesson-exit" to="/dashboard" aria-label="Exit lesson">
          <X size={18} strokeWidth={2.4} aria-hidden="true" />
        </Link>
      </div>
      {/* Keyed by board type so the whiteboard rises in only when crossing from a
          card into the whiteboard. Navigating within the whiteboard (one problem
          to another) keeps the same key, so the stage stays mounted and does not
          re-animate. Card screens animate their own content, so the rise class is
          only on the whiteboard stage. */}
      <div
        key={isWhiteboard ? 'stage-whiteboard' : 'stage-card'}
        className={
          isWhiteboard ? 'lesson-stage lesson-stage--canvas lesson-card-rise' : 'lesson-stage'
        }
      >
        {renderPhase()}
      </div>
    </main>
  );
}
