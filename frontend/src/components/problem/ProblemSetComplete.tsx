import { useEffect } from 'react';
import { CircleCheck, Trophy } from 'lucide-react';
import { celebrate } from '../../lib/confetti';

type ProblemSetCompleteProps = {
  title: string;
  solved: number;
  total: number;
  onBack: () => void;
  // Whether to burst confetti on mount. Off inside a lesson, where the only
  // end-of-lesson celebration is the single lesson-complete burst, so finishing
  // the Review or Solve set does not double up or fire mid-lesson.
  celebrateOnMount?: boolean;
};

// Mirrors the lesson's end screen (same complete-* classes and shell) so the
// problem set finishes on a celebration card instead of snapping back to the
// dashboard. The back action is owned by the caller through onBack.
export function ProblemSetComplete({ title, solved, total, onBack, celebrateOnMount = true }: ProblemSetCompleteProps) {
  useEffect(() => {
    if (celebrateOnMount) celebrate();
  }, [celebrateOnMount]);

  return (
    <section className="lesson-player lesson-complete" aria-labelledby="problem-set-complete-title">
      <div className="complete-card complete-card--rewarded">
        <div className="complete-badge" aria-hidden="true">
          <Trophy size={40} strokeWidth={1.8} />
        </div>

        <p className="eyebrow">{title} complete</p>
        <h2 id="problem-set-complete-title">Nice work</h2>
        <p className="complete-sub">You worked through every problem in this set.</p>

        <div className="complete-reward" role="status" aria-live="polite">
          <div className="complete-reward-row">
            <CircleCheck size={20} strokeWidth={2.2} />
            <span className="complete-reward-label">Solved</span>
          </div>
          <p className="complete-reward-value">
            {solved} / {total}
          </p>
        </div>

        <button type="button" className="secondary-button complete-cta" onClick={onBack}>
          Back to dashboard
        </button>
      </div>
    </section>
  );
}
