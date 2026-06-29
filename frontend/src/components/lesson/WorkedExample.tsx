import { useEffect, useRef, useState } from 'react';
import { ArrowRight, CircleCheck, Lightbulb, Sparkles, TriangleAlert } from 'lucide-react';
import type { FadedItem } from '../../content';
import { getProblemById } from '../../content/problems';
import { getExplanationFeedback, type ExplainFeedbackResult } from '../../lib/grading';
import { celebrateSmall } from '../../lib/confetti';
import type { WorkedExampleSession } from '../../progress/workedExampleProgress';
import { MathText } from './RichText';
import './WorkedExample.css';

type WorkedExampleProps = {
  item: FadedItem;
  onComplete: () => void;
  // The Apply ladder's rung label ("Worked example N of M"). Falls back to the
  // plain "Worked example" eyebrow when unused so a standalone rung is unchanged.
  eyebrow?: string;
  // Optional persistence of the in-progress rung (revealed steps, the typed
  // self-explanation, and the resolved AI feedback) so leaving and re-entering
  // the lesson restores the worked example exactly where the learner left it.
  initialSession?: WorkedExampleSession | null;
  onSessionChange?: (session: WorkedExampleSession) => void;
  onSessionClear?: () => void;
};

// Shown when an authored worked item has no solutionSteps yet, so the rung still
// runs as a single revealed step rather than an empty solution.
const PLACEHOLDER_STEP = 'Work through the canonical method one step at a time.';
const FALLBACK_PROMPT = 'Explain the method in your own words.';

// Turn a feedback failure into short, student-friendly copy. The feedback is
// formative, never a gate, so every branch reassures the student they can still
// continue even when the AI tutor is unreachable.
function toFeedbackError(error: unknown): string {
  const raw = error instanceof Error && error.message ? error.message : '';
  const lower = raw.toLowerCase();
  if (
    lower.includes('quota') ||
    lower.includes('429') ||
    lower.includes('billing') ||
    lower.includes('rate limit')
  ) {
    return 'The AI tutor is busy right now. You can keep going and try feedback again later.';
  }
  if (lower.includes('unauthenticated') || lower.includes('sign in')) {
    return 'Please sign in again to get feedback. You can still continue.';
  }
  return 'Feedback is unavailable right now. You can still continue.';
}

/**
 * The 'worked' rung of Phase 4. It resolves the problem by id to show the
 * statement and givens, then uncovers the canonical solution one step at a time
 * so the learner watches the method unfold. Once every step is revealed it
 * requires a written self-explanation (active processing, not passive copying);
 * Continue stays disabled until the learner has written a response, then fires
 * onComplete to advance the ladder.
 */
export function WorkedExample({
  item,
  onComplete,
  eyebrow,
  initialSession,
  onSessionChange,
  onSessionClear,
}: WorkedExampleProps) {
  const problem = getProblemById(item.problemId);
  const steps =
    item.solutionSteps && item.solutionSteps.length > 0 ? item.solutionSteps : [PLACEHOLDER_STEP];

  // The first step is shown immediately so the worked example always models work;
  // each click uncovers the next, capped at the final step. A resumed rung opens
  // on the step the learner had reached (clamped to the current step count).
  const [revealedCount, setRevealedCount] = useState(() =>
    Math.min(Math.max(1, initialSession?.revealedCount ?? 1), steps.length),
  );
  const [explanation, setExplanation] = useState(initialSession?.explanation ?? '');

  // The self-explanation gets AI feedback, mirroring the hint/ask/check flow on
  // the problems. The student must iterate until the answer is accepted: Continue
  // unlocks only when the feedback comes back on-track. A backend error still
  // unlocks it (an AI outage must never trap the student), but a "keep building"
  // response keeps it locked so they revise and re-check.
  const question = item.selfExplainPrompt ?? FALLBACK_PROMPT;
  const [feedback, setFeedback] = useState<ExplainFeedbackResult | null>(
    initialSession?.feedback ?? null,
  );
  const [feedbackPending, setFeedbackPending] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(
    initialSession?.feedbackError ?? null,
  );
  const [checked, setChecked] = useState(initialSession?.checked ?? false);

  const allRevealed = revealedCount >= steps.length;
  const hasAnswer = explanation.trim().length > 0;
  const canContinue = feedback?.isOnTrack === true || feedbackError !== null;

  // Mirror the durable state into a ref so the debounced save, the tab-hide
  // flush, and the unmount handler can all read the freshest values without
  // being rebuilt on every change. feedbackPending is deliberately excluded: the
  // transient "checking" state must never be persisted.
  const durableRef = useRef<WorkedExampleSession>({
    revealedCount,
    explanation,
    feedback,
    feedbackError,
    checked,
  });
  durableRef.current = { revealedCount, explanation, feedback, feedbackError, checked };

  // Set once Continue fires so the flush below never re-saves a rung the learner
  // just finished (the parent clears it on advance).
  const completedRef = useRef(false);

  const onSessionChangeRef = useRef(onSessionChange);
  onSessionChangeRef.current = onSessionChange;

  // Always points at the latest reporter so a single mount-time flush effect can
  // still persist the freshest state when the learner leaves.
  const reportRef = useRef<() => void>(() => {});
  reportRef.current = () => {
    const report = onSessionChangeRef.current;
    if (!report || completedRef.current) return;
    report({ ...durableRef.current });
  };

  // The explanation is typed character by character, so it is not part of the
  // durable-state effect below; debounce a save while the learner writes (a flush
  // on tab hide/close/unmount catches anything still pending), copying the
  // ProblemPlayer handwriting-save pattern.
  const saveTimerRef = useRef<number | null>(null);
  const scheduleSave = () => {
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      reportRef.current();
    }, 700);
  };

  // Persist whenever the durable state changes (a revealed step, a resolved
  // check). The first run is the just-seeded state, so it is skipped to avoid a
  // redundant write for a rung the learner has not touched.
  const reportedOnceRef = useRef(false);
  useEffect(() => {
    if (!reportedOnceRef.current) {
      reportedOnceRef.current = true;
      return;
    }
    reportRef.current();
  }, [revealedCount, feedback, feedbackError, checked]);

  // Flush the latest work whenever the rung goes away: in-app navigation
  // (unmount), the tab being hidden or backgrounded (visibilitychange, e.g.
  // switching apps on an iPad), and the page being closed or refreshed
  // (pagehide). React cleanup alone does not run on a page unload, so these
  // listeners are what make "leave the tab and come back" keep the work.
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

  // Finishing the rung: stop the flush from rewriting it, drop its saved state,
  // then advance (the parent also clears this rung's session on advance).
  function handleComplete() {
    completedRef.current = true;
    onSessionClear?.();
    onComplete();
  }

  function revealNext() {
    setRevealedCount((count) => Math.min(count + 1, steps.length));
  }

  async function handleCheck() {
    const answer = explanation.trim();
    if (answer.length === 0 || feedbackPending) return;
    setFeedback(null);
    setFeedbackError(null);
    setFeedbackPending(true);
    try {
      const result = await getExplanationFeedback({ problemId: item.problemId, question, answer });
      setFeedback(result);
      // A correct self-explanation (the "Good thinking" state) is a small win, so
      // it bursts confetti. Firing here in the handler, not in an effect, means it
      // fires once per correct grading and never refires on a re-render; a "keep
      // building" result, a feedback error, and revealing steps all stay quiet.
      if (result.isOnTrack) {
        celebrateSmall();
      }
    } catch (error) {
      console.error('getExplanationFeedback failed', error);
      setFeedbackError(toFeedbackError(error));
    } finally {
      // Either outcome resolves the check, so Continue unlocks (a soft error must
      // not strand the student behind an unreachable tutor).
      setChecked(true);
      setFeedbackPending(false);
    }
  }

  return (
    <section className="panel lesson-phase worked-example lesson-card-rise" data-testid="worked-example">
      <p className="eyebrow">{eyebrow ?? 'Worked example'}</p>
      <h2>{problem?.title ?? 'Worked example'}</h2>
      {problem ? (
        <p className="worked-example__prompt"><MathText text={problem.prompt} /></p>
      ) : null}

      {problem?.givens && problem.givens.length > 0 ? (
        <dl className="worked-example__givens" data-testid="worked-givens">
          {problem.givens.map((given) => (
            <div className="worked-example__given" key={given.label}>
              <dt><MathText text={given.label} /></dt>
              <dd><MathText text={given.value} /></dd>
            </div>
          ))}
        </dl>
      ) : null}

      <ol className="worked-example__steps">
        {steps.slice(0, revealedCount).map((step, index) => (
          <li className="worked-example__step" data-testid="worked-step" key={index}>
            <MathText text={step} />
          </li>
        ))}
      </ol>

      {allRevealed ? (
        <div className="worked-example__explain">
          <label className="worked-example__label">
            <span>{question}</span>
            <textarea
              className="worked-example__textarea"
              rows={3}
              value={explanation}
              onChange={(event) => {
                setExplanation(event.target.value);
                scheduleSave();
              }}
              placeholder="Explain your reasoning in a sentence or two"
            />
          </label>

          {feedback ? (
            <section
              className={
                feedback.isOnTrack
                  ? 'feedback-panel notice worked-example__feedback'
                  : 'feedback-panel worked-example__feedback worked-example__feedback--building'
              }
              aria-live="polite"
            >
              <h3>
                {feedback.isOnTrack ? (
                  <CircleCheck size={18} aria-hidden="true" />
                ) : (
                  <Lightbulb size={18} aria-hidden="true" />
                )}
                <span className="worked-example__feedback-text">
                  {feedback.isOnTrack ? 'Good thinking' : 'Keep building'}
                </span>
              </h3>
              <p>
                <MathText text={feedback.feedback} />
              </p>
            </section>
          ) : null}

          {feedbackError ? (
            <section className="feedback-panel error worked-example__feedback" role="alert">
              <h3>
                <TriangleAlert size={18} aria-hidden="true" />
                <span className="worked-example__feedback-text">Feedback unavailable</span>
              </h3>
              <p>{feedbackError}</p>
            </section>
          ) : null}

          <div className="worked-example__actions">
            <button
              type="button"
              className="secondary-link worked-example__check"
              onClick={handleCheck}
              disabled={!hasAnswer || feedbackPending}
            >
              <Sparkles size={18} aria-hidden="true" />
              {feedbackPending ? 'Checking' : checked ? 'Check again' : 'Check explanation'}
            </button>
            <button
              type="button"
              className="secondary-button worked-example__continue"
              disabled={!canContinue}
              onClick={handleComplete}
            >
              <ArrowRight size={18} aria-hidden="true" />
              Continue
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="secondary-link worked-example__reveal" onClick={revealNext}>
          Reveal next step
        </button>
      )}
    </section>
  );
}
