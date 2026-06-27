import { useEffect, useRef, useState } from 'react';
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
  generateReviewProblem,
  type GradeInput,
  type GradeResult,
  type HintResult,
} from '../../lib/grading';
import { useProgress } from '../../progress/ProgressContext';
import { knownSignatures } from '../../mastery/misconceptionGraph';
import { PRINCIPLES } from '../../content/principles';
import type { Problem } from '../../content/problems';
import type {
  ProblemPhase,
  ProblemSetSession,
  ProblemWork,
} from '../../progress/problemSessionProgress';

type Phase = 'solving' | 'grading' | 'incorrect' | 'correct' | 'error' | 'generating' | 'genError';

// Everything that makes one problem's working state. Snapshotted when the
// student leaves a problem and restored when they return, so handwriting and
// feedback persist across back and forth navigation within a set.
type Session = {
  strokes: Stroke[];
  viewport: Viewport;
  phase: Phase;
  attempts: number;
  hintTier: 0 | 1 | 2;
  hintsUsed: number;
  result: GradeResult | null;
  hint: HintResult | null;
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
    hintTier: session.hintTier,
    hintsUsed: session.hintsUsed,
    result: session.result,
    hint: session.hint,
    recorded: session.recorded,
  };
}

function sessionFromWork(work: ProblemWork): Session {
  return {
    strokes: work.strokes,
    viewport: work.viewport,
    phase: work.phase,
    attempts: work.attempts,
    hintTier: work.hintTier,
    hintsUsed: work.hintsUsed,
    result: work.result,
    hint: work.hint,
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

function computeSeed(initial: ProblemSetSession | null | undefined, problems: Problem[]): Seed {
  const total = problems.length;
  if (!initial) {
    return { index: 0, visited: 1, work: new Map(), solved: new Set(), current: null };
  }

  const work = new Map<string, Session>();
  for (const [problemId, entry] of Object.entries(initial.work)) {
    work.set(problemId, sessionFromWork(entry));
  }

  const index = clampIndex(initial.index, total);
  const visited = Math.min(Math.max(initial.visitedCount, index + 1, 1), Math.max(total, 1));
  const current = work.get(problems[index]?.problemId ?? '') ?? null;
  // Keep only solved ids that belong to the set that actually resolved this load.
  // A resumed set can be smaller than when it was saved (rehydrate drops ids it
  // cannot rebuild, like a backend-only review problem), so an unfiltered solved
  // set would over-count and show an impossible tally such as "7 of 6".
  const problemIdSet = new Set(problems.map((problem) => problem.problemId));
  const solved = new Set([...initial.solvedProblemIds].filter((id) => problemIdSet.has(id)));
  return { index, visited, work, solved, current };
}

type ProblemPlayerProps = {
  problems: Problem[];
  title?: string;
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
  onAllComplete,
  initialSession,
  onSessionChange,
  onSessionClear,
  onComplete,
}: ProblemPlayerProps) {
  const inkRef = useRef<InkCanvasHandle>(null);
  const { progress, recordProblemResult, recordConceptMiss, recordNodeCatch } = useProgress();

  // The resume snapshot is read exactly once. Everything below initializes from
  // it, so reopening a set lands on the saved problem with the saved work.
  const seedRef = useRef<Seed | null>(null);
  if (seedRef.current === null) {
    seedRef.current = computeSeed(initialSession, problems);
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
  const [hintTier, setHintTier] = useState<0 | 1 | 2>(seed.current?.hintTier ?? 0);
  const [hintsUsed, setHintsUsed] = useState(seed.current?.hintsUsed ?? 0);
  const [result, setResult] = useState<GradeResult | null>(seed.current?.result ?? null);
  const [hint, setHint] = useState<HintResult | null>(seed.current?.hint ?? null);
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

  // Review-slot placeholders are generated on demand when the student reaches
  // them, never up front. A materialized review problem is kept here keyed by its
  // stable placeholder id, so navigating back to it does not regenerate.
  const [materialized, setMaterialized] = useState<Map<string, Problem>>(new Map());
  const materializedRef = useRef(materialized);
  materializedRef.current = materialized;
  // Bumped to retry a failed on-demand generation; the generation effect re-runs.
  const [genAttempt, setGenAttempt] = useState(0);
  const [genError, setGenError] = useState<string | null>(null);

  const rawProblem = problems[index];
  // What the student actually sees and is graded on: the materialized version
  // once a review placeholder has been generated, otherwise the raw set entry.
  // Its problemId is the stable placeholder id either way, so set order, the
  // progress segments, and resume never shift across the lazy generation.
  const problem = (rawProblem && materialized.get(rawProblem.problemId)) || rawProblem;
  const total = problems.length;

  // Mirrors of render state so the save-on-change effect and the unmount handler
  // can read the latest values without being torn down and rebuilt each change.
  const indexRef = useRef(index);
  const visitedRef = useRef(visitedCount);
  const doneRef = useRef(done);
  const metaRef = useRef({ phase, attempts, hintTier, hintsUsed, result, hint, recorded: recordedRef.current });
  indexRef.current = index;
  visitedRef.current = visitedCount;
  doneRef.current = done;
  metaRef.current = { phase, attempts, hintTier, hintsUsed, result, hint, recorded: recordedRef.current };

  const hydratedCanvasRef = useRef(false);
  const reportedOnceRef = useRef(false);

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
        hintTier: meta.hintTier,
        hintsUsed: meta.hintsUsed,
        result: meta.result,
        hint: meta.hint,
        hintError: null,
        gradeError: null,
        recorded: meta.recorded,
      });
    }

    const work: Record<string, ProblemWork> = {};
    for (const [problemId, session] of sessionsRef.current) {
      // A review problem regenerates on demand each load, so persisting its
      // handwriting or solved state would attach it to a different generated
      // problem on resume. Keep review placeholders out of the saved session;
      // their slot is rebuilt from the set's problemIds and regenerated on reach.
      if (problemId.startsWith('review:')) continue;
      work[problemId] = workFromSession(session);
    }
    return {
      index: indexRef.current,
      visitedCount: visitedRef.current,
      solvedProblemIds: [...solvedIds].filter((id) => !id.startsWith('review:')),
      problemIds: problems.map((entry) => entry.problemId),
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

  // Load the resumed problem's handwriting into the canvas once after mount. The
  // guard keeps later index changes (navigation) from re-running it.
  useEffect(() => {
    if (hydratedCanvasRef.current) return;
    hydratedCanvasRef.current = true;
    const work = sessionsRef.current.get(problems[index]?.problemId ?? '');
    if (!work) return;
    inkRef.current?.setStrokes(work.strokes);
    inkRef.current?.setViewport(work.viewport);
    inkRef.current?.annotate(work.phase === 'incorrect' ? work.result?.firstErrorLineId ?? null : null);
  }, [index, problems]);

  // Persist whenever the durable state changes (navigation, grade, hint). The
  // first run is the just-hydrated state, so it is skipped to avoid a redundant
  // write. Handwriting drawn without any such change is captured on unmount.
  useEffect(() => {
    if (!reportedOnceRef.current) {
      reportedOnceRef.current = true;
      return;
    }
    reportRef.current();
  }, [index, visitedCount, phase, attempts, hintTier, hintsUsed, result, hint, solvedIds]);

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

  // Generate a review-slot placeholder's real problem on demand, only once the
  // student reaches it. Nothing is generated up front, so a problem the student
  // never reaches is never generated. Break-loud: a failure shows a retryable
  // error rather than fabricating a problem.
  useEffect(() => {
    const raw = problems[index];
    if (!raw?.pendingReview) return;
    if (materializedRef.current.has(raw.problemId)) return;
    const pending = raw.pendingReview;
    let cancelled = false;
    setGenError(null);
    setPhase('generating');
    void (async () => {
      try {
        const generated = await generateReviewProblem(pending);
        if (cancelled) return;
        // Keep the stable placeholder problemId; grading targets the generated
        // key via gradeId, so set order and progress never shift.
        const full: Problem = {
          ...raw,
          skillIds: generated.skillIds,
          principleIds: generated.principleIds,
          misconceptionTags: generated.misconceptionTags,
          difficulty: generated.difficultyBand,
          difficultyBand: generated.difficultyBand,
          prompt: generated.statement,
          gradeId: generated.problemId,
          targetMisconceptionNodeId: generated.targetMisconceptionNodeId,
          pendingReview: undefined,
        };
        setMaterialized((prev) => new Map(prev).set(raw.problemId, full));
        setPhase('solving');
      } catch (error) {
        if (cancelled) return;
        setGenError(toErrorMessage(error));
        setPhase('genError');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [index, problems, genAttempt]);

  if (done) {
    return (
      <ProblemSetComplete
        title={title ?? 'Problem set'}
        solved={solvedIds.size}
        total={total}
        onBack={() => onAllComplete?.()}
      />
    );
  }

  if (!problem) {
    return null;
  }

  const isLast = index >= total - 1;
  const busy = phase === 'grading';
  const showActions =
    phase === 'solving' || phase === 'grading' || phase === 'incorrect' || phase === 'error';

  function resetForProblem() {
    setPhase('solving');
    setAttempts(0);
    setHintTier(0);
    setHintsUsed(0);
    setResult(null);
    setHint(null);
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
    sessionsRef.current.set(problem.problemId, {
      strokes: inkRef.current?.getStrokes() ?? [],
      viewport: inkRef.current?.getViewport() ?? IDENTITY_VIEW,
      phase,
      attempts,
      hintTier,
      hintsUsed,
      result,
      hint,
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

    const saved = sessionsRef.current.get(problems[target].problemId);
    if (saved) {
      setPhase(saved.phase);
      setAttempts(saved.attempts);
      setHintTier(saved.hintTier);
      setHintsUsed(saved.hintsUsed);
      setResult(saved.result);
      setHint(saved.hint);
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
      // never counts as completion.
      if (problems.every((entry) => solvedIds.has(entry.problemId))) {
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
      // A materialized review problem keeps its placeholder problemId for set
      // order but is graded against the freshly generated key (gradeId).
      problemId: problem.gradeId ?? problem.problemId,
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
          recordProblemResult({
            problemId: problem.problemId,
            misconceptionIds: problem.misconceptionTags,
            caught: true,
            solved: true,
            hintsUsed,
            attempts: attemptCount,
          });
          setSolvedIds((prev) => {
            if (prev.has(problem.problemId)) return prev;
            const next = new Set(prev);
            next.add(problem.problemId);
            return next;
          });
          // A generated review problem carries the emergent node it targets;
          // solving it is a spaced catch on that node. The recordedRef guard
          // keeps a re-check of an already solved problem from double counting.
          if (problem.targetMisconceptionNodeId) {
            recordNodeCatch(problem.targetMisconceptionNodeId);
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
      const next = await getHint({ ...input, tier: hintTier });
      setHint(next);
      setHintsUsed((count) => count + 1);
      setHintTier((tier) => (tier < 2 ? ((tier + 1) as 0 | 1 | 2) : 2));
    } catch (error) {
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

      <SessionChrome
        current={index + 1}
        total={total}
        title={title}
        allowAllSteps
        solvedSteps={problems
          .map((entry, entryIndex) => (solvedIds.has(entry.problemId) ? entryIndex + 1 : 0))
          .filter((segment) => segment > 0)}
        onStepSelect={goTo}
      />

      <div className="problem-stage">
        <aside className={drawerOpen ? 'problem-drawer' : 'problem-drawer problem-drawer--collapsed'}>
          <div className="problem-drawer-clip">
            <div className="experience-panel experience-panel-concept problem-prompt problem-drawer-panel">
              <p className="eyebrow">
                Problem {index + 1} of {total}
              </p>
              <h2>{problem.title}</h2>
              {phase === 'generating' ? (
                <p className="problem-prompt-pending" role="status">
                  Preparing this problem...
                </p>
              ) : (
                <>
                  <p>{problem.prompt}</p>
                  {problem.figure ? <p className="problem-figure">{problem.figure}</p> : null}
                </>
              )}
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

            {hint ? (
              <section className="feedback-panel notice problem-feedback" aria-live="polite">
                <button
                  type="button"
                  className="session-close problem-feedback-dismiss"
                  onClick={() => setHint(null)}
                  aria-label="Dismiss hint"
                >
                  <X size={16} aria-hidden="true" />
                </button>
                <h3>Hint</h3>
                <p>{hint.text}</p>
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
                {result?.explanation ? <p>{result.explanation}</p> : null}
                {result?.errorType === 'concept' && result.conceptMatch ? (
                  <p className="problem-misconception">{result.conceptMatch.specificNote}</p>
                ) : null}
              </section>
            ) : null}

            {phase === 'correct' ? (
              <section className="feedback-panel notice problem-feedback" aria-live="polite">
                <h3>
                  <CircleCheck size={18} aria-hidden="true" /> Solved
                </h3>
                {result?.explanation ? <p>{result.explanation}</p> : null}
                {result?.correctSolution && result.correctSolution.length > 0 ? (
                  <ol className="problem-solution">
                    {result.correctSolution.map((step, stepIndex) => (
                      <li key={stepIndex}>{step}</li>
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

            {phase === 'genError' ? (
              <section className="feedback-panel error problem-feedback" role="alert">
                <h3>
                  <TriangleAlert size={18} aria-hidden="true" /> Could not load problem
                </h3>
                <p>{genError}</p>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setGenAttempt((attempt) => attempt + 1)}
                >
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
                  {hintPending ? 'Thinking' : 'Need a hint'}
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

      {confirmClear ? (
        <div
          className="confirm-overlay"
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
        </div>
      ) : null}
    </section>
  );
}
