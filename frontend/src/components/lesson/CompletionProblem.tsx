import type { FadedItem } from '../../content';
import { getProblemById } from '../../content/problems';
import type { ProblemSetSession } from '../../progress/problemSessionProgress';
import { ProblemPlayer } from '../problem/ProblemPlayer';
import { MathText } from './RichText';
import './CompletionProblem.css';

type CompletionProblemProps = {
  item: FadedItem;
  onComplete: () => void;
  // The Apply ladder's rung label ("Worked example N of M"), forwarded to the
  // embedded ProblemPlayer so a completion/skeleton rung reads as a ladder rung
  // instead of the single-problem "Problem 1 of 1".
  eyebrow?: string;
  // Optional persistence of the whiteboard work for this rung, so leaving and
  // re-entering the lesson restores the in-progress handwriting and feedback.
  initialSession?: ProblemSetSession | null;
  onSessionChange?: (session: ProblemSetSession) => void;
  onSessionClear?: () => void;
};

// Phase 4 completion and skeleton rungs: the student finishes a partially worked
// problem at full AP difficulty on the whiteboard. A 'completion' rung shows the
// first steps already worked above the work area; a 'skeleton' rung shows none
// (near independent). The whiteboard, grader, hints, and ask are reused wholesale
// from ProblemPlayer with a single-problem set, so no grading logic is duplicated
// here. onComplete fires when the student solves the problem and finishes the set.
export function CompletionProblem({
  item,
  onComplete,
  eyebrow,
  initialSession,
  onSessionChange,
  onSessionClear,
}: CompletionProblemProps) {
  const problem = getProblemById(item.problemId);

  // An unresolved id is an authoring bug. Rather than crash the lesson, surface a
  // quiet fallback that still lets the student move on.
  if (!problem) {
    return (
      <section className="panel lesson-phase" data-testid="completion-problem">
        <p className="eyebrow">{item.mode === 'skeleton' ? 'Try it' : 'Finish it'}</p>
        <h2>Practice problem</h2>
        <p>This problem is unavailable right now.</p>
        <button type="button" className="secondary-button" onClick={onComplete}>
          Continue
        </button>
      </section>
    );
  }

  // Seeded steps belong to the completion rung; the skeleton rung is independent.
  const prefilledSteps = item.mode === 'completion' ? item.prefilledSteps ?? [] : [];

  // The seeded steps ride inside the problem drawer (below the statement) rather
  // than as a card above the canvas, so the whiteboard fills the screen to the top
  // like the Review and Solve phases.
  const preface =
    prefilledSteps.length > 0 ? (
      <section
        className="completion-prefilled"
        data-testid="completion-prefilled"
        aria-label="Steps already worked"
      >
        <p className="eyebrow">Worked so far</p>
        <ol className="completion-prefilled-steps">
          {prefilledSteps.map((step, stepIndex) => (
            <li key={stepIndex}><MathText text={step} /></li>
          ))}
        </ol>
      </section>
    ) : null;

  return (
    <div className="completion-problem" data-testid="completion-problem">
      <ProblemPlayer
        key={item.problemId}
        problems={[problem]}
        title={item.mode === 'skeleton' ? 'Try it' : 'Finish it'}
        eyebrow={eyebrow}
        onComplete={onComplete}
        drawerPreface={preface}
        initialSession={initialSession}
        onSessionChange={onSessionChange}
        onSessionClear={onSessionClear}
        celebrateOnComplete={false}
      />
    </div>
  );
}
