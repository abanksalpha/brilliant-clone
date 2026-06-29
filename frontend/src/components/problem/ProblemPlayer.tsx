import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Eraser,
  Lightbulb,
  MessageCircleQuestion,
  Pen,
  Redo2,
  RotateCcw,
  Send,
  Sigma,
  Trash2,
  TriangleAlert,
  Undo2,
  X,
} from 'lucide-react';
import { SessionChrome } from '../lesson/session/SessionChrome';
import { MathText } from '../lesson/RichText';
import { FloatingWindow } from './FloatingWindow';
import PdfViewer from './PdfViewer';
import { ProblemSetComplete } from './ProblemSetComplete';
import { InkCanvas, type InkCanvasHandle, type Tool } from './InkCanvas';
import type { Stroke } from './inkGeometry';
import type { Viewport } from './inkViewport';
import {
  gradeAttempt,
  getHint,
  askQuestion,
  type GradeInput,
  type GradeResult,
  type HintResult,
} from '../../lib/grading';
import { celebrateSmall } from '../../lib/confetti';
import { useProgress } from '../../progress/ProgressContext';
import { knownSignatures } from '../../mastery/misconceptionGraph';
import { PRINCIPLES } from '../../content/principles';
import type { Problem } from '../../content/problems';
import type {
  ProblemPhase,
  ProblemSetSession,
  ProblemWork,
} from '../../progress/problemSessionProgress';

type Phase = 'solving' | 'grading' | 'incorrect' | 'correct' | 'error';

// Everything that makes one problem's working state. Snapshotted when the
// student leaves a problem and restored when they return, so handwriting and
// feedback persist across back and forth navigation within a set.
type Session = {
  strokes: Stroke[];
  viewport: Viewport;
  phase: Phase;
  attempts: number;
  hints: HintResult[];
  result: GradeResult | null;
  hintError: string | null;
  gradeError: string | null;
  recorded: boolean;
};

const IDENTITY_VIEW: Viewport = { scale: 1, tx: 0, ty: 0 };

// Collapse the live (full) phase to the narrow phase that is persisted: a save
// that lands mid grade or mid error resumes cleanly in 'solving'.
function persistablePhase(phase: Phase): ProblemPhase {
  return phase === 'incorrect' || phase === 'correct' ? phase : 'solving';
}

// Convert between the in-memory session (carries transient error strings) and
// the persisted work entry (only durable fields).
function workFromSession(session: Session): ProblemWork {
  return {
    strokes: session.strokes,
    viewport: session.viewport,
    phase: persistablePhase(session.phase),
    attempts: session.attempts,
    hints: session.hints,
    result: session.result,
    recorded: session.recorded,
  };
}

function sessionFromWork(work: ProblemWork): Session {
  return {
    strokes: work.strokes,
    viewport: work.viewport,
    phase: work.phase,
    attempts: work.attempts,
    hints: work.hints,
    result: work.result,
    hintError: null,
    gradeError: null,
    recorded: work.recorded,
  };
}

function clampIndex(value: number, total: number): number {
  if (total <= 0) return 0;
  const truncated = Number.isFinite(value) ? Math.trunc(value) : 0;
  return Math.min(Math.max(truncated, 0), total - 1);
}

// The starting point the player builds its state from. Derived once from the
// resumed session (or empty defaults when there is none).
type Seed = {
  index: number;
  visited: number;
  work: Map<string, Session>;
  solved: Set<string>;
  current: Session | null;
};

function computeSeed(
  initial: ProblemSetSession | null | undefined,
  problems: (Problem | undefined)[],
  startIndexOverride?: number,
): Seed {
  const total = problems.length;
  const hasOverride = startIndexOverride != null && Number.isFinite(startIndexOverride);
  if (!initial) {
    const index = hasOverride ? clampIndex(startIndexOverride!, total) : 0;
    return { index, visited: Math.max(1, index + 1), work: new Map(), solved: new Set(), current: null };
  }

  const work = new Map<string, Session>();
  for (const [problemId, entry] of Object.entries(initial.work)) {
    work.set(problemId, sessionFromWork(entry));
  }

  const index = hasOverride ? clampIndex(startIndexOverride!, total) : clampIndex(initial.index, total);
  const visited = Math.min(Math.max(initial.visitedCount, index + 1, 1), Math.max(total, 1));
  const current = work.get(problems[index]?.problemId ?? '') ?? null;
  // Keep only solved ids that belong to the set that actually resolved this load.
  // A resumed set can be smaller than when it was saved (rehydrate drops ids it
  // cannot rebuild, like a backend-only review problem), so an unfiltered solved
  // set would over-count and show an impossible tally such as "7 of 6". A
  // progressively revealed set may also have holes (a slot still generating or
  // failed), which carry no id.
  const problemIdSet = new Set(
    problems.filter((problem): problem is Problem => problem != null).map((problem) => problem.problemId),
  );
  const solved = new Set([...initial.solvedProblemIds].filter((id) => problemIdSet.has(id)));
  return { index, visited, work, solved, current };
}

type ProblemPlayerProps = {
  // A slot-indexed view: each position is a ready Problem, or undefined when its
  // slot is still generating or has failed. The lesson passes a sparse array so a
  // failed/generating slot in the middle keeps every other slot at its position.
  problems: (Problem | undefined)[];
  title?: string;
  // Overrides the problem drawer's "Problem n of total" eyebrow. The Apply-phase
  // worked ladder passes "Worked example N of M" so its single-problem rungs read
  // as ladder rungs; Review/Solve omit it and keep the within-set count.
  eyebrow?: string;
  onAllComplete?: () => void;
  // Optional persistence: the saved set state to resume from, a sink to report
  // the latest state to, and a way to drop it once the set is finished. When
  // omitted (e.g. the randomized Practice quiz) the player runs without saving.
  initialSession?: ProblemSetSession | null;
  onSessionChange?: (session: ProblemSetSession) => void;
  onSessionClear?: () => void;
  // Fired once when the learner finishes the set with every problem solved. The
  // page uses it to mark the set complete (which gates the next lesson), separate
  // from onAllComplete (navigation) and onSessionClear (dropping the resume state).
  onComplete?: () => void;
  // The lesson hides this player's own within-set progress bar (the blue/red
  // "N / N" SessionChrome) because the lesson's PhaseBar already shows that
  // granularity. The exit control moves to the lesson chrome alongside it.
  hideProgressChrome?: boolean;
  // Reports the current problem index (and set size) up to the lesson so the
  // PhaseBar can show within-Review / within-Solve granularity. Fires on mount
  // and whenever the active problem changes.
  onProblemIndexChange?: (index: number, total: number) => void;
  // The problem index to open on, overriding the resumed session's saved index.
  // The lesson's PhaseBar uses it (with a remount) to jump straight to a chosen
  // subpart in dev / free-navigation mode. Read once on mount.
  initialProblemIndex?: number;
  // Extra reference content rendered inside the left problem drawer, below the
  // statement. The Apply completion rung uses it for its "worked so far" steps so
  // the whiteboard still fills the screen instead of being pushed down by a card.
  drawerPreface?: ReactNode;
  // During progressive reveal the set streams in over time, so this is the count
  // the player displays and treats as the real length. It keeps a partially
  // arrived set from finishing early. Defaults to problems.length.
  expectedTotal?: number;
  // Whether the set-complete screen bursts confetti. Defaults on for a standalone
  // set; the lesson passes false so its only celebrations are a correct answer,
  // first reaching Learn, and finishing the whole lesson.
  celebrateOnComplete?: boolean;
  // Display indices whose slot failed all generation attempts. A failed position
  // shows a retry instead of a never-ending "Generating..." state, so a slot is
  // always ready, visibly generating, or visibly retryable.
  failedSlots?: Set<number>;
  // Regenerate the slot shown at the given display index. The lesson maps the
  // index back to the plan slot and regenerates just that one.
  onRetrySlot?: (index: number) => void;
  // Escape hatch shown on a failed slot for a formative set (Review): advances past
  // the whole set so a persistently failing slot can never trap the learner. Solve
  // omits it, so each generated Solve problem must eventually succeed.
  onSkip?: () => void;
};

// Turn a boundary error into a short, student-friendly message. Provider errors
// (e.g. an OpenAI quota/billing 429) and backend-wrapped failures are mapped to
// clean copy so the learner never sees raw API text; already-friendly messages
// (like local validation) pass through unchanged.
function toErrorMessage(error: unknown): string {
  const raw = error instanceof Error && error.message ? error.message : '';
  const lower = raw.toLowerCase();

  if (
    lower.includes('quota') ||
    lower.includes('429') ||
    lower.includes('billing') ||
    lower.includes('insufficient') ||
    lower.includes('rate limit')
  ) {
    return 'The AI tutor is temporarily unavailable. Please try again in a little while.';
  }
  if (
    lower.includes('grading failed') ||
    lower.includes('hint failed') ||
    lower.includes('openai') ||
    lower.includes('internal')
  ) {
    return 'The AI tutor ran into a problem. Please try again.';
  }
  if (lower.includes('unauthenticated') || lower.includes('sign in')) {
    return 'Please sign in again to continue.';
  }
  return raw || 'Something went wrong. Please try again.';
}

export function ProblemPlayer({
  problems,
  title,
  eyebrow,
  onAllComplete,
  initialSession,
  onSessionChange,
  onSessionClear,
  onComplete,
  hideProgressChrome,
  onProblemIndexChange,
  initialProblemIndex,
  drawerPreface,
  expectedTotal,
  celebrateOnComplete = true,
  failedSlots,
  onRetrySlot,
  onSkip,
}: ProblemPlayerProps) {
  const inkRef = useRef<InkCanvasHandle>(null);
  const { progress, recordProblemResult, recordConceptMiss, recordNodeCatch } = useProgress();

  // The resume snapshot is read exactly once. Everything below initializes from
  // it, so reopening a set lands on the saved problem with the saved work.
  const seedRef = useRef<Seed | null>(null);
  if (seedRef.current === null) {
    seedRef.current = computeSeed(initialSession, problems, initialProblemIndex);
  }
  const seed = seedRef.current;

  const [index, setIndex] = useState(seed.index);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [tool, setTool] = useState<Tool>('pen');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [done, setDone] = useState(false);
  // Furthest problem reached (1-based), so the progress segments only let the
  // student jump to problems they have already seen, like the lesson chrome.
  const [visitedCount, setVisitedCount] = useState(seed.visited);

  // Per-problem saved work, keyed by problemId. A ref because it is imperative
  // session memory, not render state. Seeded from the resumed session.
  const sessionsRef = useRef<Map<string, Session>>(seed.work);
  // The set of solved problems drives the green progress segments and the
  // completion summary, so it is render state (seeded from the resumed session).
  const [solvedIds, setSolvedIds] = useState<Set<string>>(() => new Set(seed.solved));
  const [phase, setPhase] = useState<Phase>(seed.current?.phase ?? 'solving');
  const [attempts, setAttempts] = useState(seed.current?.attempts ?? 0);
  // The escalating hints given so far. Its length is the next hint's level and
  // the count of hints used; there is no ceiling.
  const [hints, setHints] = useState<HintResult[]>(seed.current?.hints ?? []);
  const [result, setResult] = useState<GradeResult | null>(seed.current?.result ?? null);
  const [hintPending, setHintPending] = useState(false);
  const [hintError, setHintError] = useState<string | null>(null);
  const [gradeError, setGradeError] = useState<string | null>(null);
  // Transient "Ask the AI" state. Unlike the tiered hint, an ask is never part
  // of the persisted Session: it is tied to the current problem view, so it is
  // cleared on navigation and is never read by buildSessionFromRefs.
  const [askOpen, setAskOpen] = useState(false);
  const [askText, setAskText] = useState('');
  const [askAnswer, setAskAnswer] = useState<string | null>(null);
  const [askPending, setAskPending] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  // Lets the student clear the "Look again" feedback off the canvas without
  // having to revise or recheck. Reset whenever a fresh result could appear.
  const [feedbackDismissed, setFeedbackDismissed] = useState(false);
  // Guards the destructive "clear canvas" action behind a confirmation, since a
  // clear wipes every stroke and cannot be undone.
  const [confirmClear, setConfirmClear] = useState(false);

  // One recorded outcome per problem: a later Skip must not double count a
  // problem that was already solved (or already skipped).
  const recordedRef = useRef(seed.current?.recorded ?? false);
  // One conceptual miss recorded per problem: a re-check that still returns a
  // concept error for the same problem must not log a second miss to the graph.
  const conceptRecordedRef = useRef(false);

  const problem = problems[index];
  // During progressive reveal the set streams in, so use the expected length for
  // the count and completion check; a partially arrived set must not finish early.
  const total = Math.max(problems.length, expectedTotal ?? problems.length);

  // Mirrors of render state so the save-on-change effect and the unmount handler
  // can read the latest values without being torn down and rebuilt each change.
  const indexRef = useRef(index);
  const visitedRef = useRef(visitedCount);
  const doneRef = useRef(done);
  const metaRef = useRef({ phase, attempts, hints, result, recorded: recordedRef.current });
  indexRef.current = index;
  visitedRef.current = visitedCount;
  doneRef.current = done;
  metaRef.current = { phase, attempts, hints, result, recorded: recordedRef.current };

  const hydratedCanvasRef = useRef(false);
  const reportedOnceRef = useRef(false);

  // Report the active problem index up to the lesson PhaseBar. Held in a ref so a
  // changing callback identity never refires the effect; it fires on mount and
  // whenever the index or set size changes.
  const onProblemIndexChangeRef = useRef(onProblemIndexChange);
  onProblemIndexChangeRef.current = onProblemIndexChange;

  // The current problem's live handwriting and view, mirrored out of the canvas
  // via its change callbacks. React detaches the canvas ref before this player's
  // unmount cleanup runs, so reading the handle on the way out yields nothing;
  // these parent-owned refs survive and let the exit save keep the work.
  const liveStrokesRef = useRef<Stroke[]>(seed.current?.strokes ?? []);
  const liveViewportRef = useRef<Viewport>(seed.current?.viewport ?? IDENTITY_VIEW);

  // Build the full set session from the latest refs, folding in the current
  // problem's live handwriting. Reads the canvas handle while mounted (exact),
  // and falls back to the mirrored refs once the handle is gone (on unmount).
  function buildSessionFromRefs(): ProblemSetSession {
    const currentId = problems[indexRef.current]?.problemId;
    if (currentId) {
      const meta = metaRef.current;
      const ink = inkRef.current;
      sessionsRef.current.set(currentId, {
        strokes: ink ? ink.getStrokes() : liveStrokesRef.current,
        viewport: ink ? ink.getViewport() : liveViewportRef.current,
        phase: meta.phase,
        attempts: meta.attempts,
        hints: meta.hints,
        result: meta.result,
        hintError: null,
        gradeError: null,
        recorded: meta.recorded,
      });
    }

    const work: Record<string, ProblemWork> = {};
    for (const [problemId, session] of sessionsRef.current) {
      work[problemId] = workFromSession(session);
    }
    return {
      index: indexRef.current,
      visitedCount: visitedRef.current,
      solvedProblemIds: [...solvedIds],
      problemIds: problems.filter((entry): entry is Problem => entry != null).map((entry) => entry.problemId),
      work,
    };
  }

  // Always points at the latest reporter so a single mount-time unmount effect
  // can still persist the freshest state when the student leaves.
  const reportRef = useRef<() => void>(() => {});
  reportRef.current = () => {
    if (!onSessionChange || !hydratedCanvasRef.current || doneRef.current) return;
    onSessionChange(buildSessionFromRefs());
  };

  // Drawing and pan/zoom are not part of the "durable state" effect below, so on
  // their own they would only persist on navigation/unmount. Debounce a save
  // while the student works so handwriting is captured shortly after each stroke
  // (a flush on tab hide/close below catches anything still pending).
  const saveTimerRef = useRef<number | null>(null);
  const scheduleSave = () => {
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      reportRef.current();
    }, 700);
  };

  // Load the resumed problem's handwriting into the canvas before paint, so a
  // remount (e.g. a same-phase subpart jump) shows the board at its saved view
  // and strokes on the first frame instead of flashing the default view and then
  // snapping to it (the vertical "slide"). The guard keeps later index changes
  // (navigation) from re-running it.
  useLayoutEffect(() => {
    if (hydratedCanvasRef.current) return;
    hydratedCanvasRef.current = true;
    const work = sessionsRef.current.get(problems[index]?.problemId ?? '');
    if (!work) return;
    inkRef.current?.setStrokes(work.strokes);
    inkRef.current?.setViewport(work.viewport);
    inkRef.current?.annotate(work.phase === 'incorrect' ? work.result?.firstErrorLineId ?? null : null);
  }, [index, problems]);

  useEffect(() => {
    onProblemIndexChangeRef.current?.(index, total);
  }, [index, total]);

  // Persist whenever the durable state changes (navigation, grade, hint). The
  // first run is the just-hydrated state, so it is skipped to avoid a redundant
  // write. Handwriting drawn without any such change is captured on unmount.
  useEffect(() => {
    if (!reportedOnceRef.current) {
      reportedOnceRef.current = true;
      return;
    }
    reportRef.current();
  }, [index, visitedCount, phase, attempts, hints, result, solvedIds]);

  // Flush the latest work whenever the player goes away: in-app navigation
  // (unmount), the tab being hidden or backgrounded (visibilitychange, e.g.
  // switching apps on an iPad), and the page being closed or refreshed
  // (pagehide). React cleanup alone does not run on a page unload, so these
  // listeners are what make "exit and come back" keep the handwriting.
  useEffect(() => {
    const flush = () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      reportRef.current();
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, []);

  if (done) {
    return (
      <ProblemSetComplete
        title={title ?? 'Problem set'}
        solved={solvedIds.size}
        total={total}
        onBack={() => onAllComplete?.()}
        celebrateOnMount={celebrateOnComplete}
      />
    );
  }

  // A progressively revealed set may not have a problem at this index yet. The
  // slot is in one of two states: failed all attempts (a retry in place) or still
  // generating in the background (a brief pending state). There is no
  // stuck-forever case: a failed slot is always visibly retryable.
  if (!problem) {
    if (failedSlots?.has(index)) {
      return (
        <section className="problem-pending" data-testid="problem-failed">
          <div className="problem-pending__content panel lesson-phase">
            <p className="eyebrow">{eyebrow ?? title ?? 'Problem'}</p>
            <p className="problem-prompt-pending">
              We could not generate this problem. You can try again.
            </p>
            <div className="lesson-phase__actions">
              <button type="button" className="secondary-button" onClick={() => onRetrySlot?.(index)}>
                <RotateCcw size={18} aria-hidden="true" />
                Try again
              </button>
              {onSkip ? (
                <button type="button" className="secondary-link" onClick={onSkip}>
                  Skip review
                </button>
              ) : null}
            </div>
          </div>
        </section>
      );
    }
    return (
      <section className="problem-pending" data-testid="problem-pending">
        <div className="problem-pending__content">
          <p className="eyebrow">{eyebrow ?? title ?? 'Problem'}</p>
          <p className="problem-prompt-pending" role="status">
            Generating the next problem...
          </p>
        </div>
      </section>
    );
  }

  // The guard above narrows `problem` to a defined Problem, but TypeScript drops
  // that narrowing inside the handler closures below; capture it once as a
  // non-optional binding so they read the ready problem without re-checking.
  const activeProblem: Problem = problem;

  const isLast = index >= total - 1;
  const busy = phase === 'grading';
  const showActions =
    phase === 'solving' || phase === 'grading' || phase === 'incorrect' || phase === 'error';

  function resetForProblem() {
    setPhase('solving');
    setAttempts(0);
    setHints([]);
    setResult(null);
    setHintPending(false);
    setHintError(null);
    setGradeError(null);
    setFeedbackDismissed(false);
    resetAsk();
    recordedRef.current = false;
    conceptRecordedRef.current = false;
  }

  // The ask is transient and tied to the current problem view, so it is cleared
  // both when a problem is reset and on every navigation (saved or unsaved).
  function resetAsk() {
    setAskOpen(false);
    setAskText('');
    setAskAnswer(null);
    setAskPending(false);
    setAskError(null);
  }

  // Save the current problem's full working state so it can be restored later.
  function snapshotCurrent() {
    sessionsRef.current.set(activeProblem.problemId, {
      strokes: inkRef.current?.getStrokes() ?? [],
      viewport: inkRef.current?.getViewport() ?? IDENTITY_VIEW,
      phase,
      attempts,
      hints,
      result,
      hintError,
      gradeError,
      recorded: recordedRef.current,
    });
  }

  // Move to another problem in the set, snapshotting the one being left and
  // restoring the target's saved work (or starting it clean on first visit).
  function goTo(target: number) {
    if (busy || hintPending || askPending) return;
    if (target < 0 || target >= total || target === index) return;

    snapshotCurrent();

    const saved = sessionsRef.current.get(problems[target]?.problemId ?? '');
    if (saved) {
      setPhase(saved.phase);
      setAttempts(saved.attempts);
      setHints(saved.hints);
      setResult(saved.result);
      setHintPending(false);
      setHintError(saved.hintError);
      setGradeError(saved.gradeError);
      setFeedbackDismissed(false);
      resetAsk();
      recordedRef.current = saved.recorded;
      conceptRecordedRef.current = false;
      inkRef.current?.setStrokes(saved.strokes);
      inkRef.current?.setViewport(saved.viewport);
      inkRef.current?.annotate(
        saved.phase === 'incorrect' ? saved.result?.firstErrorLineId ?? null : null,
      );
    } else {
      resetForProblem();
      inkRef.current?.setStrokes([]);
      inkRef.current?.setViewport(IDENTITY_VIEW);
      inkRef.current?.annotate(null);
    }

    setVisitedCount((count) => Math.max(count, target + 1));
    setIndex(target);
  }

  function advance() {
    if (isLast) {
      // The set is finished, so drop the saved session: reopening starts fresh
      // instead of resuming on the last solved problem. doneRef (set on the next
      // render) also stops the unmount handler from rewriting it.
      setDone(true);
      onSessionClear?.();
      // Finishing with every problem solved completes the set (which unlocks the
      // next lesson). Gated on all-solved so advancing past a skipped problem
      // never counts as completion. A hole (a still-generating or failed slot)
      // is not solved, so a set with one can never complete.
      if (problems.every((entry) => entry != null && solvedIds.has(entry.problemId))) {
        onComplete?.();
      }
      return;
    }
    goTo(index + 1);
  }

  function buildCanvasSnapshot(): Pick<GradeInput, 'problemId' | 'imagePngBase64' | 'lines'> {
    const ink = inkRef.current;
    if (!ink) {
      throw new Error('The workspace is still loading. Please try again.');
    }
    return {
      // A generated problem is graded against its server key (gradeId); an
      // authored problem has no gradeId, so it grades against its problemId.
      problemId: activeProblem.gradeId ?? activeProblem.problemId,
      imagePngBase64: ink.toPngBase64(),
      lines: ink.getStrokeLines().map((line) => ({ id: line.id, bbox: line.bbox })),
    };
  }

  function buildGradeInput(): GradeInput {
    return {
      ...buildCanvasSnapshot(),
      knownMisconceptions: knownSignatures(progress.misconceptionGraph),
      allowedPrincipleIds: PRINCIPLES.map((principle) => principle.id),
    };
  }

  async function handleCheck() {
    setGradeError(null);
    setFeedbackDismissed(false);
    setPhase('grading');

    let input: GradeInput;
    try {
      input = buildGradeInput();
    } catch (error) {
      setGradeError(toErrorMessage(error));
      setPhase('error');
      return;
    }

    try {
      const next = await gradeAttempt(input);
      // This submission counts now; the attempts state has not yet reflected it.
      const attemptCount = attempts + 1;
      setAttempts(attemptCount);
      setResult(next);

      if (next.isCorrect) {
        setPhase('correct');
        // Record the outcome once per problem. Returning to a solved problem and
        // checking again must not double count mastery or the solved tally.
        if (!recordedRef.current) {
          // A correct solve is a celebration moment. Fire inside this guard so a
          // re-check of an already solved problem never bursts a second time.
          celebrateSmall();
          recordProblemResult({
            problemId: activeProblem.problemId,
            misconceptionIds: activeProblem.misconceptionTags,
            caught: true,
            solved: true,
            hintsUsed: hints.length,
            attempts: attemptCount,
          });
          setSolvedIds((prev) => {
            if (prev.has(activeProblem.problemId)) return prev;
            const next = new Set(prev);
            next.add(activeProblem.problemId);
            return next;
          });
          // A generated problem can trap more than one emergent node, so solving
          // it is a spaced catch on every targeted node. The recordedRef guard
          // keeps a re-check of an already solved problem from double counting.
          for (const nodeId of activeProblem.targetMisconceptionNodeIds ?? []) {
            recordNodeCatch(nodeId);
          }
          recordedRef.current = true;
        }
      } else {
        inkRef.current?.annotate(next.firstErrorLineId);
        // Record a conceptual miss at most once per problem. A re-check that still
        // returns a concept error for the same problem must not log a second miss,
        // mirroring the once-per-problem solve guard above.
        if (next.errorType === 'concept' && next.conceptMatch && !conceptRecordedRef.current) {
          recordConceptMiss(next.conceptMatch);
          conceptRecordedRef.current = true;
        }
        setPhase('incorrect');
      }
    } catch (error) {
      setGradeError(toErrorMessage(error));
      setPhase('error');
    }
  }

  function handleRevise() {
    inkRef.current?.annotate(null);
    setPhase('solving');
  }

  function handleRetry() {
    setGradeError(null);
    setPhase('solving');
  }

  async function handleHint() {
    setHintError(null);
    setHintPending(true);

    let input: GradeInput;
    try {
      input = buildCanvasSnapshot();
    } catch (error) {
      setHintError(toErrorMessage(error));
      setHintPending(false);
      return;
    }

    try {
      // The next hint's level is how many were already given, and the prior hint
      // texts let the model go strictly deeper without repeating. No ceiling.
      const next = await getHint({ ...input, level: hints.length, priorHints: hints.map((h) => h.text) });
      setHints((prev) => [...prev, next]);
    } catch (error) {
      console.error('getHint failed', error);
      setHintError(toErrorMessage(error));
    } finally {
      setHintPending(false);
    }
  }

  async function handleAsk() {
    const question = askText.trim();
    if (question === '') return;
    setAskError(null);
    setAskPending(true);

    let input: GradeInput;
    try {
      input = buildCanvasSnapshot();
    } catch (error) {
      setAskError(toErrorMessage(error));
      setAskPending(false);
      return;
    }

    try {
      const res = await askQuestion({ ...input, question });
      setAskAnswer(res.answer);
    } catch (error) {
      // Surface the raw cause for debugging; the user-facing copy stays clean.
      console.error('askQuestion failed', error);
      setAskError(toErrorMessage(error));
    } finally {
      setAskPending(false);
    }
  }

  return (
    <section className="lesson-player problem-player" aria-label={`${title ?? 'Problems'} workspace`}>
      <div className="problem-canvas-host">
        <InkCanvas
          ref={inkRef}
          tool={tool}
          onStrokesChange={(strokes) => {
            liveStrokesRef.current = strokes;
            scheduleSave();
          }}
          onViewportChange={(viewport) => {
            liveViewportRef.current = viewport;
            scheduleSave();
          }}
        />
      </div>

      {hideProgressChrome ? null : (
        <SessionChrome
          current={index + 1}
          total={total}
          title={title}
          allowAllSteps
          solvedSteps={problems
            .map((entry, entryIndex) => (entry != null && solvedIds.has(entry.problemId) ? entryIndex + 1 : 0))
            .filter((segment) => segment > 0)}
          onStepSelect={goTo}
        />
      )}

      <div className="problem-stage">
        <aside className={drawerOpen ? 'problem-drawer' : 'problem-drawer problem-drawer--collapsed'}>
          <div className="problem-drawer-clip">
            <div className="experience-panel experience-panel-concept problem-prompt problem-drawer-panel">
              <p className="eyebrow">
                {eyebrow ?? `Problem ${index + 1} of ${total}`}
              </p>
              <h2>{problem.title}</h2>
              <p><MathText text={problem.prompt} /></p>
              {problem.figure ? (
                <p className="problem-figure"><MathText text={problem.figure} /></p>
              ) : null}
              {drawerPreface}
            </div>
          </div>
          <button
            type="button"
            className="problem-drawer-toggle"
            onClick={() => setDrawerOpen((open) => !open)}
            aria-expanded={drawerOpen}
            aria-label={drawerOpen ? 'Collapse problem panel' : 'Expand problem panel'}
          >
            {drawerOpen ? (
              <ChevronLeft size={18} aria-hidden="true" />
            ) : (
              <ChevronRight size={18} aria-hidden="true" />
            )}
          </button>
        </aside>

        <div className="problem-workspace">
          <div
            className={
              drawerOpen
                ? 'problem-toolbar'
                : 'problem-toolbar problem-toolbar--drawer-collapsed'
            }
            role="toolbar"
            aria-label="Ink tools"
          >
            <button
              type="button"
              className="secondary-link ink-tool"
              aria-pressed={tool === 'pen'}
              aria-label="Pen"
              onClick={() => setTool('pen')}
            >
              <Pen size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="secondary-link ink-tool"
              aria-label="Undo last stroke"
              onClick={() => inkRef.current?.undo()}
            >
              <Undo2 size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="secondary-link ink-tool"
              aria-label="Redo last stroke"
              onClick={() => inkRef.current?.redo()}
            >
              <Redo2 size={18} aria-hidden="true" />
            </button>

            <button
              type="button"
              className="secondary-link ink-tool"
              aria-pressed={tool === 'eraser'}
              aria-label="Eraser"
              onClick={() => setTool('eraser')}
            >
              <Eraser size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="secondary-link ink-tool"
              aria-label="Clear canvas"
              onClick={() => setConfirmClear(true)}
            >
              <Trash2 size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="secondary-link ink-tool"
              aria-pressed={sheetOpen}
              aria-label="Equation sheet"
              onClick={() => setSheetOpen((open) => !open)}
            >
              <Sigma size={18} aria-hidden="true" />
            </button>
          </div>

          <div className="problem-dock">
            {attempts > 0 && (phase === 'solving' || phase === 'incorrect') ? (
              <p className="eyebrow problem-attempt" aria-live="polite">
                Attempt {attempts + 1}
              </p>
            ) : null}

            {hints.length > 0 ? (
              <section className="feedback-panel notice problem-feedback" aria-live="polite">
                <button
                  type="button"
                  className="session-close problem-feedback-dismiss"
                  onClick={() => setHints([])}
                  aria-label={hints.length > 1 ? 'Dismiss hints' : 'Dismiss hint'}
                >
                  <X size={16} aria-hidden="true" />
                </button>
                <h3>{hints.length > 1 ? 'Hints' : 'Hint'}</h3>
                {hints.map((entry, i) => (
                  <p key={i} className="problem-hint">
                    {hints.length > 1 ? <strong className="problem-hint-step">{i + 1}. </strong> : null}
                    <span><MathText text={entry.text} /></span>
                  </p>
                ))}
              </section>
            ) : null}

            {hintError ? (
              <section className="feedback-panel error problem-feedback" role="alert">
                <button
                  type="button"
                  className="session-close problem-feedback-dismiss"
                  onClick={() => setHintError(null)}
                  aria-label="Dismiss message"
                >
                  <X size={16} aria-hidden="true" />
                </button>
                <h3>Hint unavailable</h3>
                <p>{hintError}</p>
              </section>
            ) : null}

            {askAnswer ? (
              <section className="feedback-panel notice problem-feedback" aria-live="polite">
                <button
                  type="button"
                  className="session-close problem-feedback-dismiss"
                  onClick={() => setAskAnswer(null)}
                  aria-label="Dismiss answer"
                >
                  <X size={16} aria-hidden="true" />
                </button>
                <h3>Answer</h3>
                <p>{askAnswer}</p>
              </section>
            ) : null}

            {askError ? (
              <section className="feedback-panel error problem-feedback" role="alert">
                <button
                  type="button"
                  className="session-close problem-feedback-dismiss"
                  onClick={() => setAskError(null)}
                  aria-label="Dismiss message"
                >
                  <X size={16} aria-hidden="true" />
                </button>
                <h3>Answer unavailable</h3>
                <p>{askError}</p>
              </section>
            ) : null}

            {phase === 'incorrect' && !feedbackDismissed ? (
              <section className="feedback-panel error problem-feedback" aria-live="polite">
                <button
                  type="button"
                  className="session-close problem-feedback-dismiss"
                  onClick={() => setFeedbackDismissed(true)}
                  aria-label="Dismiss feedback"
                >
                  <X size={16} aria-hidden="true" />
                </button>
                <h3>
                  <TriangleAlert size={18} aria-hidden="true" /> Look again
                </h3>
                {result?.explanation ? <p><MathText text={result.explanation} /></p> : null}
                {result?.errorType === 'concept' && result.conceptMatch ? (
                  <p className="problem-misconception"><MathText text={result.conceptMatch.specificNote} /></p>
                ) : null}
              </section>
            ) : null}

            {phase === 'correct' ? (
              <section className="feedback-panel notice problem-feedback" aria-live="polite">
                <h3>
                  <CircleCheck size={18} aria-hidden="true" /> Solved
                </h3>
                {result?.explanation ? <p><MathText text={result.explanation} /></p> : null}
                {result?.correctSolution && result.correctSolution.length > 0 ? (
                  <ol className="problem-solution">
                    {result.correctSolution.map((step, stepIndex) => (
                      <li key={stepIndex}><MathText text={step} /></li>
                    ))}
                  </ol>
                ) : null}
                <button type="button" className="secondary-button" onClick={advance}>
                  <ArrowRight size={18} aria-hidden="true" />
                  {isLast ? 'Finish' : 'Continue'}
                </button>
              </section>
            ) : null}

            {phase === 'error' ? (
              <section className="feedback-panel error problem-feedback" role="alert">
                <h3>
                  <TriangleAlert size={18} aria-hidden="true" /> Grading failed
                </h3>
                <p>{gradeError}</p>
                <button type="button" className="secondary-button" onClick={handleRetry}>
                  <RotateCcw size={18} aria-hidden="true" />
                  Retry
                </button>
              </section>
            ) : null}

            {askOpen ? (
              <div className="feedback-panel problem-feedback problem-ask">
                <textarea
                  id="problem-ask-input"
                  className="problem-ask-input"
                  rows={2}
                  value={askText}
                  placeholder="Ask about this problem"
                  aria-label="Ask about this problem"
                  onChange={(event) => setAskText(event.target.value)}
                />
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleAsk}
                  disabled={askPending || askText.trim() === ''}
                >
                  <Send size={18} aria-hidden="true" />
                  {askPending ? 'Thinking' : 'Send'}
                </button>
              </div>
            ) : null}

            {showActions ? (
              <div className="problem-actions">
                <button
                  type="button"
                  className="secondary-link"
                  onClick={handleHint}
                  disabled={busy || hintPending}
                >
                  <Lightbulb size={18} aria-hidden="true" />
                  {hintPending ? 'Thinking' : hints.length === 0 ? 'Need a hint' : 'Another hint'}
                </button>

                <button
                  type="button"
                  className="secondary-link problem-ask-trigger"
                  onClick={() => setAskOpen((open) => !open)}
                  disabled={busy || hintPending || askPending}
                  aria-expanded={askOpen}
                >
                  <MessageCircleQuestion size={18} aria-hidden="true" />
                  Ask a question
                </button>

                {phase === 'incorrect' ? (
                  <>
                    <button type="button" className="secondary-link" onClick={handleRevise} disabled={busy}>
                      <RotateCcw size={18} aria-hidden="true" />
                      Revise
                    </button>
                    <button type="button" className="secondary-button" onClick={handleCheck} disabled={busy}>
                      <Check size={18} aria-hidden="true" />
                      I think this is right
                    </button>
                  </>
                ) : (
                  <button type="button" className="secondary-button" onClick={handleCheck} disabled={busy}>
                    <Check size={18} aria-hidden="true" />
                    {busy ? 'Checking' : 'Check work'}
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {sheetOpen ? (
        <FloatingWindow title="Equation sheet" onClose={() => setSheetOpen(false)}>
          <PdfViewer src="/equation-sheet.pdf" initialPage={3} />
        </FloatingWindow>
      ) : null}

      {confirmClear
        ? createPortal(
            // Portaled to document.body (mirroring FloatingWindow) so the dialog escapes
            // the problem player's transformed/nested stacking context. Rendered inline it
            // was trapped there and painted at its ancestor's level, so it sat BELOW the
            // body-level equation-sheet FloatingWindow (z-index 60) no matter how high its
            // own z-index was. At the document root, .confirm-overlay (z-index 80) reliably
            // wins over the sheet. theme-handdrawn travels with it so the Cancel/Clear
            // buttons keep their sketch look (from .theme-handdrawn .secondary-*).
            <div
              className="confirm-overlay theme-handdrawn"
              role="presentation"
              onClick={() => setConfirmClear(false)}
            >
              <div
                className="confirm-card"
                role="alertdialog"
                aria-modal="true"
                aria-labelledby="confirm-clear-title"
                aria-describedby="confirm-clear-body"
                onClick={(event) => event.stopPropagation()}
              >
                <h3 id="confirm-clear-title">Clear all your work?</h3>
                <p id="confirm-clear-body">
                  This erases everything on the canvas and can&rsquo;t be undone.
                </p>
                <div className="confirm-actions">
                  <button
                    type="button"
                    className="secondary-link"
                    onClick={() => setConfirmClear(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => {
                      inkRef.current?.clear();
                      setConfirmClear(false);
                    }}
                  >
                    Clear canvas
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </section>
  );
}
